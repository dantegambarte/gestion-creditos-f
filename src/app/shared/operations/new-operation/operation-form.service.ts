import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { Observable, finalize, map } from 'rxjs';
import { InterestRate } from '../../../features/admin/config/models/interfaces/interest-rate.model';
import { ProductRate } from '../../../features/admin/config/models/interfaces/product';
import { InterestRatesService } from '../../../features/admin/config/services/interest-rates.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import {
  PaymentFrequency,
  SimulatePayload,
  SimulateResult,
} from '../../../features/seller/models/credit.model';
import { CustomerCreatePayload } from '../../../features/seller/models/customer.model';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { ClientOperation } from '../../models/interface/client';
import { ProductOperation } from '../../models/interface/product';
import {
  calculateFinancedCapital,
  calculateInstallmentValue,
  calculateTotalToPay,
  findLoanInterestRate,
  findProductRate,
  rateToPercent,
} from '../../utils/financial-calculator.util';
import {
  CatalogProduct,
  CatalogVariant,
  OperationCatalogService,
  SaleInstallmentOption,
} from './operation-catalog.service';

export type { CatalogProduct, CatalogVariant, SaleInstallmentOption };

export type CartLine = {
  productoId: string;
  nombre: string;
  variantId: string;
  variantLabel: string;
  cantidad: number;
  precio: number;
  subtotal: number;
  stockDisponible: number;
  /** Todas las unidades disponibles de la variante (catálogo). */
  unitIds: string[];
  /** Códigos de las unidades disponibles, mismo orden e índice que `unitIds`. */
  unitCodes: string[];
  productIds: string[];
  /** Unidades realmente elegidas por el usuario para esta línea. La cantidad y
   * el subtotal se derivan de esta lista. El payload al backend usa esto. */
  selectedUnitIds: string[];
  rates: ProductRate[];
  selectedInstallments: number | null;
};

export type CartLineRef = {
  productoId: string;
  variantId: string;
};

export type FirstPaymentDateMode = 'APPROVAL_DATE' | 'CUSTOM_DATE';

@Injectable()
export class OperationFormService {
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly customersService = inject(CustomersService);
  private readonly creditsService = inject(CreditsService);
  private readonly interestRatesService = inject(InterestRatesService);
  readonly catalogSvc = inject(OperationCatalogService);

  // ── Form ──────────────────────────────────────────────────────────────────
  readonly operationForm = this.fb.group({
    customerId: this.fb.control<string | null>(null, [Validators.required]),
    operationType: this.fb.control<'SALE' | 'LOAN' | null>(null, [
      Validators.required,
    ]),
    totalAmount: this.fb.control<number | null>(null),
    initialPaymentType: this.fb.control<
      'NONE' | 'DOWN_PAYMENT' | 'ADVANCED_INSTALLMENTS'
    >('NONE'),
    downPayment: this.fb.control<number | null>(null, [Validators.min(0)]),
    downPaymentMethod: this.fb.control<'CASH' | 'TRANSFER' | null>(null),
    downPaymentTransferReference: this.fb.control<string | null>(null),
    advancedInstallmentsCount: this.fb.control<number | null>(null, [
      Validators.min(1),
    ]),
    advancedInstallmentsMethod: this.fb.control<'CASH' | 'TRANSFER' | null>(
      null,
    ),
    advancedInstallmentsTransferReference: this.fb.control<string | null>(null),
    paymentFrequency: this.fb.control<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null>(
      null,
      [Validators.required],
    ),
    installmentsCount: this.fb.control<number | null>(null, [
      Validators.required,
    ]),
    firstPaymentDateMode: this.fb.control<FirstPaymentDateMode>(
      'APPROVAL_DATE',
      [Validators.required],
    ),
    firstPaymentDate: this.fb.control<Date | null>(null, [
      Validators.required,
      this.notPastDateValidator(),
    ]),
    chkIdentity: this.fb.control(false, [Validators.requiredTrue]),
    chkConditions: this.fb.control(false, [Validators.requiredTrue]),
    chkDisbursement: this.fb.control(false, [Validators.requiredTrue]),
    chkCapacity: this.fb.control(false, [Validators.requiredTrue]),
  });

  // ── Server data ───────────────────────────────────────────────────────────
  readonly clients = signal<ClientOperation[]>([]);
  readonly interestRates = signal<InterestRate[]>([]);

  // ── Catalog state (delegated to OperationCatalogService) ─────────────────
  get availableProducts(): ProductOperation[] {
    return this.catalogSvc.availableProducts;
  }
  get catalogProducts(): CatalogProduct[] {
    return this.catalogSvc.catalogProducts;
  }
  get loadingProductRatesByCatalogId(): Record<string, boolean> {
    return this.catalogSvc.loadingProductRatesByCatalogId;
  }
  get loadingSaleData(): boolean {
    return this.catalogSvc.loadingSaleData;
  }

  // ── Cart state ────────────────────────────────────────────────────────────
  readonly cartLines = signal<CartLine[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  readonly submitting = signal(false);
  readonly loadingLoanData = signal(false);
  readonly isInstallmentsRefreshing = signal(false);
  readonly loadingSelectedClientSummary = signal(false);
  readonly creatingQuickClient = signal(false);
  readonly showQuickClientForm = signal(false);
  readonly simulationLoading = signal(false);
  readonly simulationError = signal<string | null>(null);
  todayDate = this.getTodayStart();
  readonly dynamicRate = signal(0);
  private loanRatesLoaded = false;
  readonly simulationResult = signal<SimulateResult | null>(null);

  // ── Signals (still needed for selectedClient/selectedProducts) ────────────
  readonly selectedClient = signal<ClientOperation | null>(null);
  readonly selectedProducts = signal<ProductOperation[]>([]);

  // Cache de resúmenes por cliente dentro del wizard — se destruye con el servicio
  private readonly summaryCache = new Map<string, ClientOperation>();

  // ── Operation type options ────────────────────────────────────────────────
  readonly operationTypeOptions = [
    { label: 'Venta', value: 'SALE' as const },
    { label: 'Préstamo', value: 'LOAN' as const },
  ];

  // ── Financial getters ─────────────────────────────────────────────────────

  /**
   * Total del carrito para ventas, sumando precio × cantidad de cada línea.
   */
  readonly totalCarrito = computed(() =>
    this.cartLines().reduce(
      (acc, line) => acc + line.precio * line.cantidad,
      0,
    ),
  );

  /**
   * Capital base del préstamo según el monto total ingresado en el formulario.
   */
  get prestamoTotal(): number {
    return this.operationForm.get('totalAmount')?.value ?? 0;
  }

  /**
   * Capital base consolidado según el tipo de operación actual.
   */
  get capitalBase(): number {
    return this.operationForm.controls.operationType.value === 'LOAN'
      ? this.prestamoTotal
      : this.totalCarrito();
  }

  /**
   * Tasa aplicada según la operación. En venta usa la tasa más alta del carrito.
   */
  get interestRate(): number {
    if (this.operationForm.controls.operationType.value === 'SALE') {
      const rates = this.cartLines()
        .map((line) => this.getSelectedRateForLine(line)?.rate ?? 0)
        .filter((rate) => rate > 0);
      return rates.length > 0 ? Math.max(...rates) : 0;
    }
    return this.dynamicRate();
  }

  /**
   * Capital sobre el cual se financia luego de descontar anticipo.
   */
  get capitalAFinanciar(): number {
    const simulationResult = this.simulationResult();
    if (simulationResult?.summary?.financedAmount !== undefined) {
      return simulationResult.summary.financedAmount;
    }
    if (simulationResult?.financedAmount !== undefined) {
      return simulationResult.financedAmount;
    }
    const downPayment =
      this.operationForm.controls.operationType.value === 'SALE'
        ? this.getValidatedDownPayment()
        : 0;
    return calculateFinancedCapital(this.capitalBase, downPayment);
  }

  /**
   * Valor unitario de cuota usando la fórmula exacta del backend (redondeada al millar).
   */
  get valorCuota(): number {
    const simulationResult = this.simulationResult();
    if (simulationResult?.installmentAmount !== undefined) {
      return simulationResult.installmentAmount;
    }
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines().reduce(
        (acc, line) => acc + this.getLineInstallmentValue(line),
        0,
      );
    }
    const cuotas = this.operationForm.controls.installmentsCount.value ?? 0;
    return calculateInstallmentValue(
      this.capitalAFinanciar,
      this.interestRate,
      cuotas,
    );
  }

  /**
   * Total final a devolver en todo el plan de pagos.
   */
  get totalADevolver(): number {
    const simulationResult = this.simulationResult();
    if (simulationResult?.totalToReturn !== undefined) {
      return simulationResult.totalToReturn;
    }
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines().reduce((acc, line) => {
        const installments = line.selectedInstallments ?? 0;
        return acc + this.getLineInstallmentValue(line) * installments;
      }, 0);
    }
    const cuotas = this.operationForm.controls.installmentsCount.value ?? 0;
    return calculateTotalToPay(this.valorCuota, cuotas);
  }

  /**
   * Catálogo filtrado por nombre para el paso 2.
   */
  get filteredCatalogProducts(): CatalogProduct[] {
    return this.catalogProducts;
  }

  /**
   * Opciones de frecuencia de pago habilitadas según tipo y datos cargados.
   */
  get paymentFrequencyOptions(): {
    label: string;
    value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }[] {
    const type = this.operationForm.controls.operationType.value;
    const baseFrequencies =
      type === 'LOAN'
        ? this.interestRates().map((r) => r.paymentFrequency)
        : this.cartLines().flatMap((line) =>
            line.rates.map((r) => r.paymentFrequency),
          );
    const unique = Array.from(new Set(baseFrequencies));
    const labelByFrequency: Record<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY', string> =
      {
        WEEKLY: 'Semanal',
        BIWEEKLY: 'Quincenal',
        MONTHLY: 'Mensual',
      };
    return unique.map((f) => ({ label: labelByFrequency[f], value: f }));
  }

  /**
   * Opciones dinámicas de cuotas para el paso 3 según tipo y frecuencia.
   */
  get installmentsOptions(): {
    label: string;
    value: number;
    frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
  }[] {
    const type = this.operationForm.controls.operationType.value;
    const selectedFrequency =
      this.operationForm.controls.paymentFrequency.value;
    const formatFrequency = (f: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY') => {
      if (f === 'MONTHLY') return 'Mensual';
      if (f === 'BIWEEKLY') return 'Quincenal';
      return 'Semanal';
    };

    if (type === 'LOAN') {
      const amount = this.prestamoTotal;
      const matchingRates = this.interestRates().filter((r) => {
        const minOk = amount >= r.minAmount;
        const maxOk = r.maxAmount == null || amount <= r.maxAmount;
        const freqOk =
          !selectedFrequency || r.paymentFrequency === selectedFrequency;
        return minOk && maxOk && freqOk;
      });
      const unique = new Map<
        string,
        {
          label: string;
          value: number;
          frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
        }
      >();
      for (const r of matchingRates) {
        const key = `${r.installmentsCount}-${r.paymentFrequency}`;
        if (!unique.has(key)) {
          unique.set(key, {
            label: `${r.installmentsCount} cuota${r.installmentsCount > 1 ? 's' : ''} (${formatFrequency(r.paymentFrequency)})`,
            value: r.installmentsCount,
            frequency: r.paymentFrequency,
          });
        }
      }
      return Array.from(unique.values()).sort((a, b) => a.value - b.value);
    }

    if (type === 'SALE') {
      const unique = new Map<
        string,
        {
          label: string;
          value: number;
          frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
        }
      >();
      for (const r of this.cartLines()
        .flatMap((line) => line.rates)
        .filter(
          (rate) =>
            !selectedFrequency || rate.paymentFrequency === selectedFrequency,
        )) {
        const key = `${r.installmentsCount}-${r.paymentFrequency}`;
        if (!unique.has(key)) {
          unique.set(key, {
            label: `${r.installmentsCount} cuota${r.installmentsCount > 1 ? 's' : ''} (${formatFrequency(r.paymentFrequency)})`,
            value: r.installmentsCount,
            frequency: r.paymentFrequency,
          });
        }
      }
      return Array.from(unique.values()).sort((a, b) => a.value - b.value);
    }

    return [];
  }

  /**
   * Clase visual del dropdown de cuotas para resaltar cambios por frecuencia.
   */
  readonly installmentsDropdownClass = computed(() =>
    this.isInstallmentsRefreshing()
      ? 'w-full ring-2 ring-blue-400/60 rounded-xl transition-all duration-300'
      : 'w-full',
  );

  /**
   * Indica si todas las declaraciones obligatorias fueron aceptadas.
   */
  get declarationsAccepted(): boolean {
    const c = this.operationForm.controls;
    return (
      c.chkIdentity.value === true &&
      c.chkConditions.value === true &&
      c.chkDisbursement.value === true &&
      c.chkCapacity.value === true
    );
  }

  /**
   * Indica si el envío final está habilitado.
   */
  get canSubmitOperation(): boolean {
    return (
      this.operationForm.valid &&
      this.declarationsAccepted &&
      !this.submitting()
    );
  }

  /**
   * Valida si el paso actual cumple sus restricciones para avanzar al siguiente.
   * @param {number} step - Índice del paso actual (0-based).
   */
  canNext(step: number): boolean {
    if (step === 0) return this.isClientStepValid();
    if (step === 1) {
      const type = this.operationForm.controls.operationType.value;
      if (type === 'LOAN') return this.operationForm.controls.totalAmount.valid;
      if (type === 'SALE') return this.cartLines().length > 0;
      return false;
    }
    if (step === 2) {
      const isSale = this.operationForm.controls.operationType.value === 'SALE';
      const firstPaymentDateMode =
        this.operationForm.controls.firstPaymentDateMode.value;
      const firstPaymentDateControl =
        this.operationForm.controls.firstPaymentDate;
      const saleInstallmentsValid =
        !isSale ||
        this.cartLines().every((line) => (line.selectedInstallments ?? 0) > 0);
      const firstPaymentDateValid =
        firstPaymentDateMode === 'APPROVAL_DATE'
          ? !!firstPaymentDateControl.value &&
            this.operationForm.controls.paymentFrequency.valid
          : firstPaymentDateControl.valid;

      let initialPaymentValid = true;
      if (isSale) {
        const payType = this.operationForm.controls.initialPaymentType.value;
        if (payType === 'DOWN_PAYMENT') {
          const dp = this.operationForm.controls.downPayment.value ?? 0;
          const method = this.operationForm.controls.downPaymentMethod.value;
          initialPaymentValid = dp > 0 && dp < this.capitalBase && !!method;
        } else if (payType === 'ADVANCED_INSTALLMENTS') {
          const count =
            this.operationForm.controls.advancedInstallmentsCount.value ?? 0;
          const method =
            this.operationForm.controls.advancedInstallmentsMethod.value;
          initialPaymentValid = count > 0 && !!method;
        }
      }

      return (
        this.operationForm.controls.paymentFrequency.valid &&
        (isSale || this.operationForm.controls.installmentsCount.valid) &&
        saleInstallmentsValid &&
        firstPaymentDateValid &&
        initialPaymentValid
      );
    }
    return true;
  }

  // ── Line-level financial helpers ──────────────────────────────────────────

  /**
   * Opciones de cuotas para una línea del carrito según la frecuencia seleccionada.
   */
  getInstallmentsOptionsForLine(line: CartLine): SaleInstallmentOption[] {
    const selectedFrequency =
      this.operationForm.controls.paymentFrequency.value;
    const formatFrequency = (f: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY') => {
      if (f === 'MONTHLY') return 'Mensual';
      if (f === 'BIWEEKLY') return 'Quincenal';
      return 'Semanal';
    };
    const unique = new Map<string, SaleInstallmentOption>();
    for (const rate of line.rates.filter(
      (r) => !selectedFrequency || r.paymentFrequency === selectedFrequency,
    )) {
      const key = `${rate.installmentsCount}-${rate.paymentFrequency}`;
      if (!unique.has(key)) {
        unique.set(key, {
          label: `${rate.installmentsCount} cuota${rate.installmentsCount > 1 ? 's' : ''} (${formatFrequency(rate.paymentFrequency)})`,
          value: rate.installmentsCount,
          frequency: rate.paymentFrequency,
        });
      }
    }
    return Array.from(unique.values()).sort((a, b) => a.value - b.value);
  }

  /**
   * Tasa seleccionada para una línea del carrito según cuotas y frecuencia.
   */
  getSelectedRateForLine(line: CartLine): ProductRate | undefined {
    const selectedFrequency =
      this.operationForm.controls.paymentFrequency.value;
    if (!line.selectedInstallments || !selectedFrequency) return undefined;
    return findProductRate(
      line.rates,
      line.selectedInstallments,
      selectedFrequency,
    );
  }

  /**
   * Valor de cuota de una línea con la fórmula oficial (redondeado al millar).
   */
  getLineInstallmentValue(line: CartLine): number {
    const installments = line.selectedInstallments ?? 0;
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    return calculateInstallmentValue(
      this.getLineFinancedCapital(line),
      rate,
      installments,
    );
  }

  /**
   * Anticipo prorrateado para una línea según su peso en el total.
   */
  getLineDownPayment(line: CartLine): number {
    const downPayment = this.getValidatedDownPayment();
    if (downPayment <= 0 || this.totalCarrito() <= 0) return 0;
    return (line.subtotal / this.totalCarrito()) * downPayment;
  }

  /**
   * Normaliza y acota el anticipo para evitar valores inválidos.
   * Retorna 0 si el tipo de pago inicial no es enganche.
   */
  getValidatedDownPayment(): number {
    if (this.operationForm.controls.initialPaymentType.value !== 'DOWN_PAYMENT')
      return 0;
    const raw = this.operationForm.controls.downPayment.value ?? 0;
    return Math.min(Math.max(raw, 0), this.capitalBase);
  }

  /**
   * Devuelve la mayor cantidad de cuotas configurada entre las líneas de venta.
   * @returns {number} Cantidad máxima del plan actual.
   */
  getSaleMaxInstallments(): number {
    return Math.max(
      0,
      ...this.cartLines().map((line) => Number(line.selectedInstallments ?? 0)),
    );
  }

  /**
   * Capital financiado de una línea descontando el anticipo prorrateado.
   */
  getLineFinancedCapital(line: CartLine): number {
    return calculateFinancedCapital(
      line.subtotal,
      this.getLineDownPayment(line),
    );
  }

  /**
   * Descripción corta del plan de cuotas por producto.
   */
  getLinePlanSubtitle(line: CartLine): string {
    const installments = line.selectedInstallments ?? 0;
    const money = (value: number) =>
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(value);
    if (installments <= 0) {
      return `${line.cantidad} u. · ${money(line.subtotal)} total`;
    }
    return `${line.cantidad} u. · ${installments} cuota${installments > 1 ? 's' : ''} de ${money(this.getLineInstallmentValue(line))}`;
  }

  /**
   * Porcentaje de interés aplicado en una línea del carrito.
   */
  getLineRatePercent(line: CartLine): number {
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    return rateToPercent(rate);
  }

  // ── Initialization ────────────────────────────────────────────────────────

  /**
   * Inicializa subscriptions reactivas del formulario y carga los clientes.
   * @param {string} [clientDni] - DNI para preseleccionar el cliente desde query params.
   * @returns {Observable<boolean>} true si un cliente fue preseleccionado (avanzar al paso 1).
   */
  initialize(clientDni?: string): Observable<boolean> {
    this._setupFormSubscriptions();
    this.syncFirstPaymentDateWithMode();
    return this.loadClients().pipe(
      map(() => {
        if (clientDni) {
          const match = this.clients().find((c) => c.dni === clientDni);
          if (match?.status === 'ACTIVE') {
            this.selectClient(match);
            return true;
          }
        }
        return false;
      }),
    );
  }

  private _setupFormSubscriptions(): void {
    this.operationForm.controls.operationType.valueChanges.subscribe((type) => {
      this.resetSimulationResult();
      const totalAmountControl = this.operationForm.controls.totalAmount;
      const installmentsControl = this.operationForm.controls.installmentsCount;
      if (type) this.setOperationType(type);

      if (type === 'LOAN') {
        totalAmountControl.setValidators([
          Validators.required,
          Validators.min(1),
        ]);
        installmentsControl.setValidators([Validators.required]);
        this.clearCart();
        this.operationForm.controls.initialPaymentType.setValue('NONE');
        this.operationForm.controls.downPayment.setValue(null);
        this.operationForm.controls.downPaymentMethod.setValue(null);
        this.operationForm.controls.downPaymentTransferReference.setValue(null);
        this.operationForm.controls.advancedInstallmentsCount.setValue(null);
        this.operationForm.controls.advancedInstallmentsMethod.setValue(null);
        this.operationForm.controls.advancedInstallmentsTransferReference.setValue(
          null,
        );
      } else {
        totalAmountControl.clearValidators();
        totalAmountControl.setValue(null);
        installmentsControl.clearValidators();
        installmentsControl.setValue(null, { emitEvent: false });
      }
      this.operationForm.controls.paymentFrequency.setValue(null);
      this.operationForm.controls.installmentsCount.setValue(null);
      this.operationForm.controls.firstPaymentDateMode.setValue(
        'APPROVAL_DATE',
        {
          emitEvent: false,
        },
      );
      this.operationForm.controls.firstPaymentDate.setValue(null, {
        emitEvent: false,
      });
      totalAmountControl.updateValueAndValidity({ emitEvent: false });
      installmentsControl.updateValueAndValidity({ emitEvent: false });
      this.loadTypeDataOnDemand(type);
      this.ensureValidFrequencySelection();
      this.ensureValidInstallmentsSelection();
      this.calculateDynamicRate();
    });

    this.operationForm.controls.paymentFrequency.valueChanges.subscribe(() => {
      this.resetSimulationResult();
      this.operationForm.controls.installmentsCount.setValue(null, {
        emitEvent: false,
      });
      this.ensureValidSaleLineInstallments();
      this.ensureValidInstallmentsSelection();
      this.refreshInstallmentsUX();
      this.calculateDynamicRate();
      this.syncFirstPaymentDateWithMode();
    });

    this.operationForm.controls.firstPaymentDateMode.valueChanges.subscribe(
      () => {
        this.resetSimulationResult();
        this.syncFirstPaymentDateWithMode();
      },
    );

    this.operationForm.controls.totalAmount.valueChanges.subscribe(() => {
      this.resetSimulationResult();
      this.calculateDynamicRate();

      this.ensureValidFrequencySelection();
      this.ensureValidInstallmentsSelection();
    });

    this.operationForm.controls.installmentsCount.valueChanges.subscribe(
      (count) => {
        this.resetSimulationResult();
        this.calculateDynamicRate();
        // Si el plan baja a < 2 cuotas, "Cuotas adelantadas" deja de tener
        // sentido. Resetear a NONE evita que quede un valor invalido en el
        // form y nos permite ocultar la opcion en el template (eliminando
        // el warning de Angular sobre [disabled] en reactive forms).
        const n = Number(count ?? 0);
        if (
          n < 2 &&
          this.operationForm.controls.initialPaymentType.value ===
            'ADVANCED_INSTALLMENTS'
        ) {
          this.operationForm.controls.initialPaymentType.setValue('NONE');
        }
      },
    );

    this.operationForm.controls.firstPaymentDate.valueChanges.subscribe(() => {
      this.resetSimulationResult();
    });

    this.operationForm.controls.downPayment.valueChanges.subscribe(() => {
      this.resetSimulationResult();
    });

    this.operationForm.controls.initialPaymentType.valueChanges.subscribe(
      () => {
        this.resetSimulationResult();
      },
    );

    this.operationForm.controls.advancedInstallmentsCount.valueChanges.subscribe(
      (count) => {
        this.resetSimulationResult();
        const maxAllowed = Math.max(this.getSaleMaxInstallments() - 1, 0);
        if (count == null) return;
        if (maxAllowed <= 0) {
          this.operationForm.controls.advancedInstallmentsCount.setValue(null, {
            emitEvent: false,
          });
          return;
        }
        if (count > maxAllowed) {
          this.operationForm.controls.advancedInstallmentsCount.setValue(
            maxAllowed,
            { emitEvent: false },
          );
        }
      },
    );
  }

  // ── HTTP loaders ──────────────────────────────────────────────────────────

  /**
   * Carga únicamente clientes para el paso 1 del wizard.
   */
  loadClients(): Observable<void> {
    return this.customersService.list({ includeSummary: true }).pipe(
      map((customers) => {
        this.clients.set(
          customers.map((c) => ({
            id: c.id,
            name: c.fullName,
            dni: c.dni,
            phone: c.phone ?? '',
            email: c.email ?? '',
            status: c.status,
            previousCredits: c.activeCredits ?? 0,
            delinquency: c.delinquency ?? 'sin mora',
            paymentCapacity: c.paymentCapacity ?? 0,
            address: c.address ?? '',
            collectorName: c.collectorName ?? '',
            createdAt: c.createdAt,
          })),
        );
      }),
    );
  }

  /**
   * Carga tasas de interés para el flujo de préstamo (LOAN).
   */
  loadLoanRates(): Observable<void> {
    return this.interestRatesService.getAll({ active: true }).pipe(
      map((rates) => {
        this.interestRates.set(rates);
      }),
    );
  }

  // ── Cart management ───────────────────────────────────────────────────────

  /**
   * Agrega al carrito una variante específica del producto preservando stock y tasas.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @param {string} variantId - Variante concreta seleccionada por el usuario.
   */
  addProductVariant(product: CatalogProduct, variantId: string): void {
    const variant = product.variants.find(
      (item) => item.variantId === variantId,
    );
    if (
      !variant ||
      this.catalogSvc.loadingProductRatesByCatalogId[product.productoId]
    )
      return;

    const cartKey = this.getCartLineKey(product.productoId, variant.variantId);
    const existing = this.cartLines().find(
      (line) =>
        this.getCartLineKey(line.productoId, line.variantId) === cartKey,
    );
    const hasRates = (existing?.rates.length ?? 0) > 0;

    if (existing && existing.cantidad >= existing.stockDisponible) {
      this.notifyProductOutOfStock(`${product.nombre} — ${variant.label}`);
      return;
    }

    if (hasRates) {
      this.upsertCartLine(product, variant, existing?.rates ?? []);
      return;
    }

    this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] = true;
    const firstProductId = variant.productIds[0] ?? product.productIds[0];
    if (!firstProductId) {
      this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] =
        false;
      return;
    }

    this.catalogSvc
      .loadProductRatesByProductId(firstProductId)
      .pipe(
        finalize(() => {
          this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] =
            false;
        }),
      )
      .subscribe((rates) => {
        this.upsertCartLine(product, variant, rates);
      });
  }

  /**
   * Agrega un producto al carrito o incrementa su cantidad. Carga tasas on-demand.
   * @param {CatalogProduct} product - Producto del catálogo agrupado.
   */
  addProduct(product: CatalogProduct): void {
    if (this.loadingProductRatesByCatalogId[product.productoId]) return;
    const defaultVariant = this.getDefaultVariant(product);
    if (!defaultVariant) return;
    this.addProductVariant(product, defaultVariant.variantId);
  }

  /**
   * Inserta o incrementa una línea del carrito preservando tasas. La unidad
   * que se agrega se controla con `unitId`:
   *   · Si se pasa un `unitId`, se agrega esa unidad puntual (idempotente: si
   *     ya estaba seleccionada, no hace nada).
   *   · Si no se pasa, se toma la primera unidad disponible no seleccionada
   *     (compat: lo usan `addProductVariant`/`addProduct` y el incrementador
   *     genérico del carrito).
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @param {CatalogVariant} variant - Variante puntual seleccionada.
   * @param {ProductRate[]} rates - Tasas activas asociadas al producto.
   * @param {string} [unitId] - Unidad puntual a agregar.
   */
  upsertCartLine(
    product: CatalogProduct,
    variant: CatalogVariant,
    rates: ProductRate[],
    unitId?: string,
  ): void {
    this.resetSimulationResult();
    const existing = this.cartLines().find(
      (line) =>
        this.getCartLineKey(line.productoId, line.variantId) ===
        this.getCartLineKey(product.productoId, variant.variantId),
    );

    // Resuelve qué unitId concreto agregar. Si vino explícito y está disponible,
    // ese; sino la primera del catálogo que no esté ya seleccionada en la línea.
    const alreadySelected = new Set(existing?.selectedUnitIds ?? []);
    const resolvedUnitId =
      unitId && variant.unitIds.includes(unitId) && !alreadySelected.has(unitId)
        ? unitId
        : variant.unitIds.find((id) => !alreadySelected.has(id));

    if (!resolvedUnitId) {
      // No hay unidades libres para agregar; idempotente si ya estaba.
      return;
    }

    if (!existing) {
      const draftLine: CartLine = {
        productoId: product.productoId,
        nombre: product.nombre,
        variantId: variant.variantId,
        variantLabel: variant.label,
        cantidad: 1,
        precio: variant.precio,
        subtotal: variant.precio,
        stockDisponible: variant.stockDisponible,
        unitIds: variant.unitIds,
        unitCodes: variant.unitCodes,
        productIds: variant.productIds,
        selectedUnitIds: [resolvedUnitId],
        rates,
        selectedInstallments: null,
      };
      const options = this.getInstallmentsOptionsForLine(draftLine);
      draftLine.selectedInstallments = options[0]?.value ?? null;
      this.cartLines.update((lines) => [...lines, draftLine]);
    } else if (existing.cantidad < existing.stockDisponible) {
      this.cartLines.update((lines) =>
        lines.map((line) =>
          this.getCartLineKey(line.productoId, line.variantId) ===
          this.getCartLineKey(product.productoId, variant.variantId)
            ? {
                ...line,
                rates,
                cantidad: line.cantidad + 1,
                subtotal: (line.cantidad + 1) * line.precio,
                selectedUnitIds: [...line.selectedUnitIds, resolvedUnitId],
                selectedInstallments:
                  line.selectedInstallments ??
                  this.getInstallmentsOptionsForLine({ ...line, rates })[0]
                    ?.value ??
                  null,
              }
            : line,
        ),
      );
    }

    this.ensureValidSaleLineInstallments();
    this.syncSelectedProductsFromCart();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Agrega una unidad PUNTUAL de una variante al carrito. Es la vía limpia para
   * la selección granular (botón "+ Agregar" por unidad en el paso 2). Si la
   * unidad ya estaba seleccionada para esa línea, no hace nada.
   * @param {CatalogProduct} product
   * @param {string} variantId
   * @param {string} unitId
   */
  addProductUnit(
    product: CatalogProduct,
    variantId: string,
    unitId: string,
  ): void {
    const variant = product.variants.find((v) => v.variantId === variantId);
    if (!variant) return;
    const existing = this.cartLines().find(
      (line) =>
        this.getCartLineKey(line.productoId, line.variantId) ===
        this.getCartLineKey(product.productoId, variant.variantId),
    );
    if (existing && existing.cantidad >= existing.stockDisponible) {
      this.notifyProductOutOfStock(`${product.nombre} — ${variant.label}`);
      return;
    }
    if ((existing?.rates.length ?? 0) > 0) {
      this.upsertCartLine(product, variant, existing!.rates, unitId);
      return;
    }
    // Sin tasas cargadas todavía: igual que addProductVariant, las pide on-demand.
    this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] = true;
    const firstProductId = variant.productIds[0] ?? product.productIds[0];
    if (!firstProductId) {
      this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] =
        false;
      return;
    }
    this.catalogSvc
      .loadProductRatesByProductId(firstProductId)
      .pipe(
        finalize(() => {
          this.catalogSvc.loadingProductRatesByCatalogId[product.productoId] =
            false;
        }),
      )
      .subscribe((rates) =>
        this.upsertCartLine(product, variant, rates, unitId),
      );
  }

  /**
   * Quita una unidad PUNTUAL de la línea del carrito. Si era la última unidad
   * de la línea, elimina la línea entera. Es la vía limpia para "× Quitar" por
   * unidad en el paso 2.
   * @param {string} productoId
   * @param {string} variantId
   * @param {string} unitId
   */
  removeProductUnit(
    productoId: string,
    variantId: string,
    unitId: string,
  ): void {
    this.resetSimulationResult();
    this.cartLines.update((lines) =>
      lines
        .map((line) => {
          if (
            this.getCartLineKey(line.productoId, line.variantId) !==
            this.getCartLineKey(productoId, variantId)
          )
            return line;
          const nextSelected = line.selectedUnitIds.filter(
            (id) => id !== unitId,
          );
          const nextQty = nextSelected.length;
          return {
            ...line,
            selectedUnitIds: nextSelected,
            cantidad: nextQty,
            subtotal: nextQty * line.precio,
          };
        })
        .filter((line) => line.cantidad > 0),
    );
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Incrementa una línea del carrito respetando el stock disponible. Agrega la
   * siguiente unidad del catálogo que aún no esté seleccionada en esa línea
   * (mantiene la consistencia con selectedUnitIds).
   * @param {string} productoId - ID del producto agrupado.
   */
  increaseQuantity(target: string | CartLineRef): void {
    this.resetSimulationResult();
    this.cartLines.update((lines) =>
      lines.map((line) => {
        if (
          !this.matchesCartLine(line, target) ||
          line.cantidad >= line.stockDisponible
        )
          return line;
        const already = new Set(line.selectedUnitIds);
        const nextUnitId = line.unitIds.find((id) => !already.has(id));
        if (!nextUnitId) return line;
        const nextQty = line.cantidad + 1;
        return {
          ...line,
          cantidad: nextQty,
          subtotal: nextQty * line.precio,
          selectedUnitIds: [...line.selectedUnitIds, nextUnitId],
        };
      }),
    );
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Disminuye una línea del carrito; si llega a cero la elimina. Saca la ÚLTIMA
   * unidad seleccionada (LIFO sobre selectedUnitIds).
   * @param {string} productoId - ID del producto agrupado.
   */
  decreaseQuantity(target: string | CartLineRef): void {
    this.resetSimulationResult();
    this.cartLines.update((lines) =>
      lines
        .map((line) => {
          if (!this.matchesCartLine(line, target)) return line;
          const nextSelected = line.selectedUnitIds.slice(0, -1);
          const nextQty = nextSelected.length;
          return {
            ...line,
            cantidad: nextQty,
            subtotal: nextQty * line.precio,
            selectedUnitIds: nextSelected,
          };
        })
        .filter((line) => line.cantidad > 0),
    );
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Elimina una línea completa del carrito.
   * @param {string} productoId - ID del producto agrupado.
   */
  removeFromCart(target: string | CartLineRef): void {
    this.resetSimulationResult();
    this.cartLines.update((lines) =>
      lines.filter((line) => !this.matchesCartLine(line, target)),
    );
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Vacía todo el carrito de venta.
   */
  clearCart(): void {
    this.resetSimulationResult();
    this.cartLines.set([]);
    this.catalogSvc.resetLoadingStates();
    this.selectedProducts.set([]);
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Actualiza la cuota seleccionada de un producto específico en ventas.
   * @param {string} productoId - ID de línea agrupada en el carrito.
   * @param {number | null} installments - Cantidad de cuotas elegida.
   */
  onSaleInstallmentsChange(
    productoId: string,
    installments: number | null,
  ): void {
    this.resetSimulationResult();
    this.cartLines.update((lines) =>
      lines.map((line) =>
        line.productoId === productoId
          ? { ...line, selectedInstallments: installments }
          : line,
      ),
    );
    this.calculateDynamicRate();
  }

  /**
   * Limpia el resultado de simulación cuando cambian datos base del plan.
   */
  resetSimulationResult(): void {
    this.simulationResult.set(null);
    this.simulationError.set(null);
  }

  /**
   * Solicita al backend una simulación financiera real para el paso de condiciones.
   */
  requestFinancialSimulation(): void {
    const payload = this.buildSimulationPayload();
    if (!payload) return;

    this.simulationLoading.set(true);
    this.simulationError.set(null);
    this.creditsService
      .simulate(payload)
      .pipe(
        finalize(() => {
          this.simulationLoading.set(false);
        }),
      )
      .subscribe({
        next: (result) => {
          this.simulationResult.set(result);
        },
        error: (err: unknown) => {
          const detail =
            typeof err === 'object' &&
            err !== null &&
            'message' in err &&
            typeof (err as { message?: unknown }).message === 'string'
              ? (err as { message: string }).message
              : 'No se pudo calcular la simulación.';

          this.simulationError.set(detail);
          this.messageService.add({
            severity: 'error',
            summary: 'Simulación no disponible',
            detail,
            life: 5000,
          });
        },
      });
  }

  /**
   * Construye el payload real de simulación según el estado actual del wizard.
   * @returns {SimulatePayload | null} Payload listo para API o null si faltan datos.
   */
  buildSimulationPayload(): SimulatePayload | null {
    const type = this.operationForm.controls.operationType.value;
    const paymentFrequency = this.operationForm.controls.paymentFrequency
      .value as PaymentFrequency | null;
    const firstPaymentDate = this.operationForm.controls.firstPaymentDate.value;

    if (!type || !paymentFrequency || !firstPaymentDate) return null;

    if (type === 'SALE') {
      if (this.cartLines().length === 0) return null;
      return {
        type,
        paymentFrequency,
        installmentsCount: Math.max(
          1,
          ...this.cartLines().map((line) => line.selectedInstallments ?? 1),
        ),
        downPayment: this.getValidatedDownPayment(),
        firstPaymentDate: this.toApiDate(firstPaymentDate),
        products: this.cartLines().map((line) => ({
          variantId: line.variantId,
          quantity: line.cantidad,
          installmentsCount: line.selectedInstallments ?? undefined,
        })),
      };
    }

    const installmentsCount =
      this.operationForm.controls.installmentsCount.value;
    if (!installmentsCount || !this.prestamoTotal) return null;

    return {
      type,
      totalAmount: this.prestamoTotal,
      installmentsCount,
      paymentFrequency,
      firstPaymentDate: this.toApiDate(firstPaymentDate),
    };
  }

  /**
   * Normaliza una fecha al formato ISO corto que espera el backend.
   * @param {Date} date - Fecha seleccionada en el formulario.
   * @returns {string} Fecha formateada como YYYY-MM-DD.
   */
  toApiDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Sincroniza la primera fecha de pago según el modo elegido por el usuario.
   * En modo aprobación deriva automáticamente la fecha desde hoy + frecuencia.
   */
  syncFirstPaymentDateWithMode(): void {
    const mode = this.operationForm.controls.firstPaymentDateMode.value;
    const firstPaymentDateControl =
      this.operationForm.controls.firstPaymentDate;

    if (mode !== 'APPROVAL_DATE') {
      if (firstPaymentDateControl.disabled) {
        firstPaymentDateControl.enable({ emitEvent: false });
      }
      return;
    }

    if (firstPaymentDateControl.enabled) {
      firstPaymentDateControl.disable({ emitEvent: false });
    }

    const frequency = this.operationForm.controls.paymentFrequency.value;
    if (!frequency) {
      firstPaymentDateControl.setValue(null, {
        emitEvent: false,
      });
      return;
    }

    const derivedDate = this.getFirstPaymentDateFromApprovalRule(
      this.getTodayStart(),
      frequency,
    );

    firstPaymentDateControl.setValue(derivedDate, {
      emitEvent: false,
    });
  }

  /**
   * Calcula la primera cuota aplicando días corridos desde la aprobación.
   * @param {Date} approvalDate - Fecha base de aprobación de la operación.
   * @param {'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'} frequency - Frecuencia elegida del plan.
   * @returns {Date} Primera fecha de vencimiento resultante.
   */
  getFirstPaymentDateFromApprovalRule(
    approvalDate: Date,
    frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  ): Date {
    const dueDate = new Date(approvalDate);
    dueDate.setHours(0, 0, 0, 0);

    if (frequency === 'WEEKLY') {
      dueDate.setDate(dueDate.getDate() + 7);
      return dueDate;
    }

    if (frequency === 'BIWEEKLY') {
      dueDate.setDate(dueDate.getDate() + 14);
      return dueDate;
    }

    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  }

  // ── Client helpers ────────────────────────────────────────────────────────

  /**
   * Selecciona cliente y sincroniza el control del formulario.
   * @param {ClientOperation} client - Cliente elegido en el paso 1.
   */
  selectClient(client: ClientOperation): void {
    this.showQuickClientForm.set(false);
    this.operationForm.controls.customerId.setValue(client.id);

    const cached = this.summaryCache.get(client.id);
    if (cached) {
      this.selectedClient.set(cached);
      return;
    }

    this.selectedClient.set(client);
    this.loadingSelectedClientSummary.set(true);
    this.customersService
      .getWizardSummary(client.id)
      .pipe(
        finalize(() => {
          this.loadingSelectedClientSummary.set(false);
        }),
      )
      .subscribe({
        next: (summary) => {
          const enrichedClient: ClientOperation = {
            ...client,
            phone: summary.phone ?? client.phone,
            email: summary.email ?? client.email,
            status: summary.status,
            previousCredits: summary.activeCredits,
            delinquency: summary.delinquency,
            paymentCapacity: summary.paymentCapacity,
            address: summary.address ?? '',
            collectorName: summary.collectorName ?? '',
            createdAt: summary.createdAt,
            paidInstallments: summary.paidInstallments,
            pendingInstallments: summary.pendingInstallments,
            overdueInstallments: summary.overdueInstallments,
            creditsSummary: summary.credits,
          };

          this.summaryCache.set(client.id, enrichedClient);
          this.selectedClient.set(enrichedClient);
          this.clients.update((current) =>
            current.map((c) =>
              c.id === enrichedClient.id ? enrichedClient : c,
            ),
          );
        },
        error: () => {
          this.selectedClient.set(client);
        },
      });
  }

  /**
   * Verifica si el cliente actualmente seleccionado está activo.
   */
  isClientStepValid(): boolean {
    const clientId = this.operationForm.controls.customerId.value;
    if (!clientId) return false;
    const client = this.clients().find((c) => c.id === clientId);
    return client?.status === 'ACTIVE';
  }

  /**
   * Muestra el panel de registro rápido dentro del paso cliente.
   */
  openQuickClientForm(): void {
    this.showQuickClientForm.set(true);
  }

  /**
   * Oculta el panel de registro rápido sin alterar el resto del wizard.
   */
  closeQuickClientForm(): void {
    this.showQuickClientForm.set(false);
  }

  /**
   * Crea un cliente mínimo, lo agrega al listado local y lo deja seleccionado para continuar.
   * @param {CustomerCreatePayload} payload - Datos mínimos necesarios para el alta rápida.
   * @returns {Observable<ClientOperation>} Cliente creado y adaptado al modelo del wizard.
   */
  createQuickClient(
    payload: CustomerCreatePayload,
  ): Observable<ClientOperation> {
    this.creatingQuickClient.set(true);
    return this.customersService.create(payload).pipe(
      map((customer) => {
        const quickClient: ClientOperation = {
          id: customer.id,
          name: customer.fullName,
          dni: customer.dni,
          phone: customer.phone ?? '',
          email: customer.email ?? '',
          status: customer.status,
          previousCredits: 0,
          delinquency: 'sin mora',
          paymentCapacity: 0,
          address: customer.address ?? '',
          collectorName: customer.collectorName ?? '',
          createdAt: customer.createdAt,
          paidInstallments: 0,
          pendingInstallments: 0,
          overdueInstallments: 0,
          creditsSummary: [],
        };

        this.clients.update((current) => [
          quickClient,
          ...current.filter((c) => c.id !== quickClient.id),
        ]);
        this.selectClient(quickClient);
        this.messageService.add({
          severity: 'success',
          summary: 'Cliente registrado',
          detail:
            'Se creó el cliente y quedó seleccionado para esta operación.',
          life: 3000,
        });
        return quickClient;
      }),
      finalize(() => {
        this.creatingQuickClient.set(false);
      }),
    );
  }

  // ── Type / data loaders ───────────────────────────────────────────────────

  /**
   * Actualiza el tipo de operación y limpia estado residual cuando corresponde.
   * @param {'SALE' | 'LOAN'} type - Tipo elegido en el wizard.
   */
  setOperationType(type: 'SALE' | 'LOAN'): void {
    if (type === 'LOAN') {
      this.selectedProducts.set([]);
    }
  }

  /**
   * Carga datos on-demand según tipo elegido para evitar eager loading innecesario.
   * @param {'SALE' | 'LOAN' | null} type - Tipo de operación seleccionado.
   */
  loadTypeDataOnDemand(type: 'SALE' | 'LOAN' | null): void {
    if (type === 'LOAN' && !this.loanRatesLoaded) {
      this.loadingLoanData.set(true);
      this.loadLoanRates()
        .pipe(
          finalize(() => {
            this.loadingLoanData.set(false);
          }),
        )
        .subscribe(() => {
          this.loanRatesLoaded = true;
          this.ensureValidFrequencySelection();
          this.ensureValidInstallmentsSelection();
          this.calculateDynamicRate();
        });
      return;
    }

    if (type === 'SALE' && !this.catalogSvc.isLoaded) {
      this.catalogSvc.loadSaleData().subscribe(() => {
        this.ensureValidFrequencySelection();
        this.ensureValidInstallmentsSelection();
        this.calculateDynamicRate();
      });
    }
  }

  /**
   * Recarga el catálogo de unidades disponibles tras un error de "unidad no encontrada".
   * Limpia el carrito para forzar al usuario a re-seleccionar con datos frescos.
   * CR-09: race condition — la unidad fue reservada entre carga y envío.
   */
  reloadCatalogAfterUnitError(): void {
    this.clearCart();
    this.catalogSvc.reset();
    this.catalogSvc.loadSaleData().subscribe();
  }

  /**
   * Verifica si una línea del carrito coincide con el identificador recibido.
   * @param {CartLine} line - Línea del carrito evaluada.
   * @param {string | CartLineRef} target - Identificador simple legado o referencia completa.
   * @returns {boolean} true si refiere a la misma línea lógica del carrito.
   */
  private matchesCartLine(
    line: CartLine,
    target: string | CartLineRef,
  ): boolean {
    if (typeof target === 'string') return line.productoId === target;
    return (
      line.productoId === target.productoId &&
      line.variantId === target.variantId
    );
  }

  /**
   * Construye una clave estable para separar líneas del carrito por variante.
   * @param {string} productoId - Producto base del catálogo.
   * @param {string} variantId - Variante concreta dentro del producto.
   * @returns {string} Clave única para el carrito.
   */
  private getCartLineKey(productoId: string, variantId: string): string {
    return `${productoId}::${variantId}`;
  }

  /**
   * Devuelve la variante por defecto de un producto para mantener compatibilidad con el flujo actual.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @returns {CatalogVariant | undefined} Variante inicial elegible.
   */
  private getDefaultVariant(
    product: CatalogProduct,
  ): CatalogVariant | undefined {
    return [...product.variants].sort(
      (a, b) => b.stockDisponible - a.stockDisponible,
    )[0];
  }

  // ── Reactive consistency helpers ──────────────────────────────────────────

  /**
   * Ajusta frecuencia seleccionada si quedó inválida respecto a opciones disponibles.
   */
  ensureValidFrequencySelection(): void {
    const control = this.operationForm.controls.paymentFrequency;
    const options = this.paymentFrequencyOptions;
    const selected = control.value;

    if (options.length === 0) {
      if (control.enabled) control.disable({ emitEvent: false });
      if (selected !== null) control.setValue(null, { emitEvent: false });
      return;
    }

    if (control.disabled) control.enable({ emitEvent: false });
    if (!options.some((o) => o.value === selected)) {
      control.setValue(options[0]?.value ?? null);
    }
  }

  /**
   * Mantiene consistente la cuota seleccionada con las opciones dinámicas disponibles.
   */
  ensureValidInstallmentsSelection(): void {
    const control = this.operationForm.controls.installmentsCount;
    const type = this.operationForm.controls.operationType.value;

    if (type === 'SALE') {
      if (control.enabled) control.disable({ emitEvent: false });
      if (control.value !== null) control.setValue(null, { emitEvent: false });
      return;
    }

    const options = this.installmentsOptions;
    const selected = control.value;

    if (options.length === 0) {
      if (control.enabled) control.disable({ emitEvent: false });
      if (selected !== null) control.setValue(null, { emitEvent: false });
      return;
    }

    if (control.disabled) control.enable({ emitEvent: false });
    const exists = options.some((o) => o.value === selected);
    if (!exists) control.setValue(options[0]?.value ?? null);
  }

  /**
   * Revalida cuotas de cada línea al cambiar frecuencia o tasas disponibles.
   */
  ensureValidSaleLineInstallments(): void {
    this.cartLines.update((lines) =>
      lines.map((line) => {
        const options = this.getInstallmentsOptionsForLine(line);
        if (options.length === 0)
          return { ...line, selectedInstallments: null };
        const isValid = options.some(
          (opt) => opt.value === line.selectedInstallments,
        );
        return isValid
          ? line
          : { ...line, selectedInstallments: options[0]?.value ?? null };
      }),
    );
  }

  /**
   * Calcula la tasa dinámica según tipo de operación, monto y cuotas elegidas.
   */
  calculateDynamicRate(): void {
    const type = this.operationForm.controls.operationType.value;

    if (type === 'LOAN') {
      const installments =
        this.operationForm.controls.installmentsCount.value ?? 0;
      this.dynamicRate.set(
        findLoanInterestRate(
          this.interestRates(),
          installments,
          this.prestamoTotal,
        ),
      );
      return;
    }

    if (type === 'SALE') {
      const rates = this.cartLines()
        .map((line) => this.getSelectedRateForLine(line)?.rate ?? 0)
        .filter((rate) => rate > 0);
      this.dynamicRate.set(rates.length > 0 ? Math.max(...rates) : 0);
      return;
    }

    this.dynamicRate.set(0);
  }

  /**
   * Sincroniza el carrito agrupado con la lista de unidades requerida por el payload.
   */
  syncSelectedProductsFromCart(): void {
    const unitById = new Map(
      this.catalogSvc.availableProducts.map((unit) => [unit.id, unit]),
    );
    const selectedUnits: ProductOperation[] = [];
    for (const line of this.cartLines()) {
      for (const unitId of line.selectedUnitIds) {
        const unit = unitById.get(unitId);
        if (unit) selectedUnits.push(unit);
      }
    }
    this.selectedProducts.set(selectedUnits);
  }

  /**
   * Marca visualmente el recálculo de cuotas y mueve foco al dropdown correspondiente.
   */
  refreshInstallmentsUX(): void {
    this.isInstallmentsRefreshing.set(true);
    setTimeout(() => {
      const dropdown = document.querySelector(
        '[data-cy="ddl-installments"] .p-dropdown',
      ) as HTMLElement | null;
      dropdown?.focus();
    }, 0);
    setTimeout(() => {
      this.isInstallmentsRefreshing.set(false);
    }, 600);
  }

  /**
   * Muestra aviso único cuando el usuario intenta agregar un producto sin stock.
   * @param {string} productName - Nombre comercial del producto sin stock.
   */
  notifyProductOutOfStock(productName: string): void {
    this.messageService.clear();
    this.messageService.add({
      severity: 'warn',
      summary: 'Sin stock disponible',
      detail: `El producto ${productName} no tiene más stock.`,
      life: 2500,
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  /**
   * Construye el payload y lo envía al backend para aprobación.
   * @returns {Observable<unknown>} respuesta del backend.
   */
  submit(): Observable<unknown> {
    const client = this.selectedClient();
    const type = this.operationForm.controls.operationType.value;
    const installmentsCount =
      this.operationForm.controls.installmentsCount.value;
    const firstPaymentDate = this.operationForm.controls.firstPaymentDate.value;
    const freq = this.operationForm.controls.paymentFrequency
      .value as PaymentFrequency;

    const selectedUnits = this.selectedProducts();

    const initialPaymentType =
      this.operationForm.controls.initialPaymentType.value;
    const advancedInstallmentsCount =
      this.operationForm.controls.advancedInstallmentsCount.value ?? 0;
    const downPaymentAmount =
      initialPaymentType === 'DOWN_PAYMENT'
        ? this.getValidatedDownPayment()
        : 0;
    const paymentMethod =
      initialPaymentType === 'DOWN_PAYMENT'
        ? this.operationForm.controls.downPaymentMethod.value
        : null;
    const transferReference =
      initialPaymentType === 'DOWN_PAYMENT'
        ? this.operationForm.controls.downPaymentTransferReference.value
        : null;

    // El backend persiste first_payment_date en columna DATE. Mandamos
    // string 'YYYY-MM-DD' (sin TZ) para evitar que JSON.stringify(Date)
    // serialice como ISO UTC y la conversion en backend pierda el dia.
    const firstPaymentDateApi = firstPaymentDate
      ? this.toApiDate(firstPaymentDate)
      : undefined;

    const payload =
      type === 'SALE'
        ? {
            customerId: client!.id,
            type,
            items: this.cartLines().map((line) => ({
              productId: line.productIds[0] ?? line.productoId,
              quantity: line.cantidad,
              unitPrice: line.precio,
              subtotal: line.subtotal,
              downPaymentAllocated: this.getLineDownPayment(line),
              financedCapital: this.getLineFinancedCapital(line),
              installmentsCount: line.selectedInstallments,
              interestRate: this.getSelectedRateForLine(line)?.rate ?? 0,
              installmentValue: this.getLineInstallmentValue(line),
              totalToPay:
                this.getLineInstallmentValue(line) *
                (line.selectedInstallments ?? 0),
            })),
            units: selectedUnits.map((p) => ({ unitId: p.id })),
            downPayment: downPaymentAmount,
            downPaymentMethod: paymentMethod,
            downPaymentTransferReference: transferReference,
            advancedInstallmentsCount:
              initialPaymentType === 'ADVANCED_INSTALLMENTS'
                ? advancedInstallmentsCount
                : undefined,
            advancedInstallmentsMethod:
              initialPaymentType === 'ADVANCED_INSTALLMENTS'
                ? this.operationForm.controls.advancedInstallmentsMethod.value
                : undefined,
            advancedInstallmentsTransferReference:
              initialPaymentType === 'ADVANCED_INSTALLMENTS'
                ? this.operationForm.controls
                    .advancedInstallmentsTransferReference.value
                : undefined,
            installmentsCount: Math.max(
              1,
              ...this.cartLines().map((line) => line.selectedInstallments ?? 1),
            ),
            interestRate: this.interestRate,
            totalInstallmentValue: this.valorCuota,
            totalToPay: this.totalADevolver,
            firstPaymentDate: firstPaymentDateApi,
            paymentFrequency: freq,
          }
        : {
            customerId: client!.id,
            type,
            totalAmount: this.prestamoTotal,
            downPayment: 0,
            installmentsCount,
            interestRate: this.interestRate,
            firstPaymentDate: firstPaymentDateApi,
            paymentFrequency: freq,
          };

    this.submitting.set(true);
    return this.creditsService.create(payload as never);
  }

  // ── Validators ────────────────────────────────────────────────────────────

  /**
   * Construye un validador que bloquea fechas anteriores al día actual.
   */
  notPastDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) return null;
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return { invalidDate: true };
      const selectedDay = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const today = this.getTodayStart();
      return selectedDay < today ? { pastDate: true } : null;
    };
  }

  /**
   * Devuelve la fecha actual truncada al inicio del día local.
   */
  getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
