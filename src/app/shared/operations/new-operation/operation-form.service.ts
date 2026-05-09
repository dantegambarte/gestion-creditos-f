import { Injectable, inject, signal } from '@angular/core';
import {
  FormBuilder,
  Validators,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Observable, map, finalize } from 'rxjs';
import { MessageService } from 'primeng/api';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { InterestRatesService } from '../../../features/admin/config/services/interest-rates.service';
import { ProductRatesService } from '../../../features/admin/config/services/product-rates.service';
import { InterestRate } from '../../../features/admin/config/models/interfaces/interest-rate.model';
import { ProductRate } from '../../../features/admin/config/models/interfaces/product';
import { ClientOperation } from '../../models/interface/client';
import { ProductOperation } from '../../models/interface/product';
import { PaymentFrequency } from '../../../features/seller/models/credit.model';
import {
  calculateInstallmentValue,
  calculateTotalToPay,
  calculateFinancedCapital,
  findLoanInterestRate,
  findProductRate,
  rateToPercent,
} from '../../utils/financial-calculator.util';

export type CatalogProduct = {
  productoId: string;
  nombre: string;
  precio: number;
  stockDisponible: number;
  unitIds: string[];
  productIds: string[];
};

export type SaleInstallmentOption = {
  label: string;
  value: number;
  frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
};

export type CartLine = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
  stockDisponible: number;
  unitIds: string[];
  productIds: string[];
  rates: ProductRate[];
  selectedInstallments: number | null;
};

@Injectable()
export class OperationFormService {
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly customersService = inject(CustomersService);
  private readonly productUnitsService = inject(ProductUnitsService);
  private readonly creditsService = inject(CreditsService);
  private readonly interestRatesService = inject(InterestRatesService);
  private readonly productRatesService = inject(ProductRatesService);

  // ── Form ──────────────────────────────────────────────────────────────────
  readonly operationForm = this.fb.group({
    customerId: this.fb.control<string | null>(null, [Validators.required]),
    operationType: this.fb.control<'SALE' | 'LOAN' | null>(null, [
      Validators.required,
    ]),
    totalAmount: this.fb.control<number | null>(null),
    downPayment: this.fb.control<number | null>(null, [Validators.min(0)]),
    paymentFrequency: this.fb.control<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null>(
      null,
      [Validators.required],
    ),
    installmentsCount: this.fb.control<number | null>(null, [
      Validators.required,
    ]),
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
  clients: ClientOperation[] = [];
  availableProducts: ProductOperation[] = [];
  interestRates: InterestRate[] = [];
  productRates: ProductRate[] = [];

  // ── Cart state ────────────────────────────────────────────────────────────
  cartLines: CartLine[] = [];
  catalogProducts: CatalogProduct[] = [];
  loadingProductRatesByCatalogId: Record<string, boolean> = {};

  // ── UI state ──────────────────────────────────────────────────────────────
  submitting = false;
  loadingLoanData = false;
  loadingSaleData = false;
  isInstallmentsRefreshing = false;
  todayDate = this.getTodayStart();
  dynamicRate = 0;
  private loanRatesLoaded = false;
  private saleDataLoaded = false;

  // ── Signals (still needed for selectedClient/selectedProducts) ────────────
  readonly selectedClient = signal<ClientOperation | null>(null);
  readonly selectedProducts = signal<ProductOperation[]>([]);

  // ── Operation type options ────────────────────────────────────────────────
  readonly operationTypeOptions = [
    { label: 'Venta', value: 'SALE' as const },
    { label: 'Préstamo', value: 'LOAN' as const },
  ];

  // ── Financial getters ─────────────────────────────────────────────────────

  /**
   * Total del carrito para ventas, sumando precio × cantidad de cada línea.
   */
  get totalCarrito(): number {
    return this.cartLines.reduce(
      (acc, line) => acc + line.precio * line.cantidad,
      0,
    );
  }

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
      : this.totalCarrito;
  }

  /**
   * Tasa aplicada según la operación. En venta usa la tasa más alta del carrito.
   */
  get interestRate(): number {
    if (this.operationForm.controls.operationType.value === 'SALE') {
      const rates = this.cartLines
        .map((line) => this.getSelectedRateForLine(line)?.rate ?? 0)
        .filter((rate) => rate > 0);
      return rates.length > 0 ? Math.max(...rates) : 0;
    }
    return this.dynamicRate;
  }

  /**
   * Capital sobre el cual se financia luego de descontar anticipo.
   */
  get capitalAFinanciar(): number {
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
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines.reduce(
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
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines.reduce((acc, line) => {
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
        ? this.interestRates.map((r) => r.paymentFrequency)
        : this.cartLines.flatMap((line) =>
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
      const matchingRates = this.interestRates.filter((r) => {
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
      for (const r of this.cartLines
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
  get installmentsDropdownClass(): string {
    return this.isInstallmentsRefreshing
      ? 'w-full ring-2 ring-blue-400/60 rounded-xl transition-all duration-300'
      : 'w-full';
  }

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
      this.operationForm.valid && this.declarationsAccepted && !this.submitting
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
      if (type === 'SALE') return this.cartLines.length > 0;
      return false;
    }
    if (step === 2) {
      const isSale = this.operationForm.controls.operationType.value === 'SALE';
      const downPayment = this.operationForm.controls.downPayment.value ?? 0;
      const downPaymentValid = !isSale || downPayment <= this.capitalBase;
      const saleInstallmentsValid =
        !isSale ||
        this.cartLines.every((line) => (line.selectedInstallments ?? 0) > 0);
      return (
        this.operationForm.controls.paymentFrequency.valid &&
        (isSale || this.operationForm.controls.installmentsCount.valid) &&
        saleInstallmentsValid &&
        this.operationForm.controls.firstPaymentDate.valid &&
        downPaymentValid
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
    if (downPayment <= 0 || this.totalCarrito <= 0) return 0;
    return (line.subtotal / this.totalCarrito) * downPayment;
  }

  /**
   * Normaliza y acota el anticipo para evitar valores inválidos.
   */
  getValidatedDownPayment(): number {
    const raw = this.operationForm.controls.downPayment.value ?? 0;
    return Math.min(Math.max(raw, 0), this.capitalBase);
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
    return this.loadClients().pipe(
      map(() => {
        if (clientDni) {
          const match = this.clients.find((c) => c.dni === clientDni);
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
        this.operationForm.controls.downPayment.setValue(null);
      } else {
        totalAmountControl.clearValidators();
        totalAmountControl.setValue(null);
        installmentsControl.clearValidators();
        installmentsControl.setValue(null, { emitEvent: false });
      }
      this.operationForm.controls.paymentFrequency.setValue(null);
      this.operationForm.controls.installmentsCount.setValue(null);
      totalAmountControl.updateValueAndValidity({ emitEvent: false });
      installmentsControl.updateValueAndValidity({ emitEvent: false });
      this.loadTypeDataOnDemand(type);
      this.ensureValidFrequencySelection();
      this.ensureValidInstallmentsSelection();
      this.calculateDynamicRate();
    });

    this.operationForm.controls.paymentFrequency.valueChanges.subscribe(() => {
      this.operationForm.controls.installmentsCount.setValue(null, {
        emitEvent: false,
      });
      this.ensureValidSaleLineInstallments();
      this.ensureValidInstallmentsSelection();
      this.refreshInstallmentsUX();
      this.calculateDynamicRate();
    });

    this.operationForm.controls.totalAmount.valueChanges.subscribe(() => {
      this.calculateDynamicRate();

      this.ensureValidFrequencySelection();
      this.ensureValidInstallmentsSelection();
    });

    this.operationForm.controls.installmentsCount.valueChanges.subscribe(() => {
      this.calculateDynamicRate();
    });
  }

  // ── HTTP loaders ──────────────────────────────────────────────────────────

  /**
   * Carga únicamente clientes para el paso 1 del wizard.
   */
  loadClients(): Observable<void> {
    return this.customersService.list().pipe(
      map((customers) => {
        this.clients = customers.map((c) => ({
          id: c.id,
          name: c.fullName,
          dni: c.dni,
          phone: c.phone ?? '',
          email: c.email ?? '',
          status: c.status,
          previousCredits: 0,
          delinquency: 'sin mora',
          paymentCapacity: 0,
        }));
      }),
    );
  }

  /**
   * Carga tasas de interés para el flujo de préstamo (LOAN).
   */
  loadLoanRates(): Observable<void> {
    return this.interestRatesService.getAll({ active: true }).pipe(
      map((rates) => {
        this.interestRates = rates;
      }),
    );
  }

  /**
   * Carga unidades disponibles para el flujo de venta (SALE).
   */
  loadSaleData(): Observable<void> {
    return this.productUnitsService.getAll({ status: 'AVAILABLE' }).pipe(
      map((units) => {
        this.availableProducts = units.map((u) => ({
          id: u.id,
          productId: u.productId,
          name: u.productName,
          price: u.currentPrice,
          stock: 1,
          unitCode: u.unitCode,
          historicalPrice: u.currentPrice,
        }));
      }),
    );
  }

  /**
   * Obtiene tasas activas para un producto específico.
   * @param {string} productId - Identificador del producto.
   */
  loadProductRatesByProductId(productId: string): Observable<ProductRate[]> {
    return this.productRatesService.getAll({ productId }).pipe(
      map((rates) => {
        const activeRates = rates.filter((r) => r.active);
        const kept = this.productRates.filter((r) => r.productId !== productId);
        this.productRates = [...kept, ...activeRates];
        return activeRates;
      }),
    );
  }

  // ── Cart management ───────────────────────────────────────────────────────

  /**
   * Agrega un producto al carrito o incrementa su cantidad. Carga tasas on-demand.
   * @param {CatalogProduct} product - Producto del catálogo agrupado.
   */
  addProduct(product: CatalogProduct): void {
    if (this.loadingProductRatesByCatalogId[product.productoId]) return;

    const existing = this.cartLines.find(
      (line) => line.productoId === product.productoId,
    );
    const hasRates = (existing?.rates.length ?? 0) > 0;

    if (existing && existing.cantidad >= existing.stockDisponible) {
      this.notifyProductOutOfStock(product.nombre);
      return;
    }

    if (hasRates) {
      this.upsertCartLine(product, existing?.rates ?? []);
      return;
    }

    this.loadingProductRatesByCatalogId[product.productoId] = true;
    const firstProductId = product.productIds[0];
    if (!firstProductId) {
      this.loadingProductRatesByCatalogId[product.productoId] = false;
      return;
    }

    this.loadProductRatesByProductId(firstProductId)
      .pipe(
        finalize(() => {
          this.loadingProductRatesByCatalogId[product.productoId] = false;
        }),
      )
      .subscribe((rates) => {
        this.upsertCartLine(product, rates);
      });
  }

  /**
   * Inserta o incrementa una línea del carrito preservando tasas.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @param {ProductRate[]} rates - Tasas activas asociadas al producto.
   */
  upsertCartLine(product: CatalogProduct, rates: ProductRate[]): void {
    const existing = this.cartLines.find(
      (line) => line.productoId === product.productoId,
    );

    if (!existing) {
      const draftLine: CartLine = {
        productoId: product.productoId,
        nombre: product.nombre,
        cantidad: 1,
        precio: product.precio,
        subtotal: product.precio,
        stockDisponible: product.stockDisponible,
        unitIds: product.unitIds,
        productIds: product.productIds,
        rates,
        selectedInstallments: null,
      };
      const options = this.getInstallmentsOptionsForLine(draftLine);
      draftLine.selectedInstallments = options[0]?.value ?? null;
      this.cartLines = [...this.cartLines, draftLine];
    } else if (existing.cantidad < existing.stockDisponible) {
      this.cartLines = this.cartLines.map((line) =>
        line.productoId === product.productoId
          ? {
              ...line,
              rates,
              cantidad: line.cantidad + 1,
              subtotal: (line.cantidad + 1) * line.precio,
              selectedInstallments:
                line.selectedInstallments ??
                this.getInstallmentsOptionsForLine({ ...line, rates })[0]
                  ?.value ??
                null,
            }
          : line,
      );
    }

    this.ensureValidSaleLineInstallments();
    this.syncSelectedProductsFromCart();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Incrementa una línea del carrito respetando el stock disponible.
   * @param {string} productoId - ID del producto agrupado.
   */
  increaseQuantity(productoId: string): void {
    this.cartLines = this.cartLines.map((line) => {
      if (
        line.productoId !== productoId ||
        line.cantidad >= line.stockDisponible
      )
        return line;
      const nextQty = line.cantidad + 1;
      return { ...line, cantidad: nextQty, subtotal: nextQty * line.precio };
    });
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Disminuye una línea del carrito; si llega a cero la elimina.
   * @param {string} productoId - ID del producto agrupado.
   */
  decreaseQuantity(productoId: string): void {
    this.cartLines = this.cartLines
      .map((line) => {
        if (line.productoId !== productoId) return line;
        const nextQty = line.cantidad - 1;
        return { ...line, cantidad: nextQty, subtotal: nextQty * line.precio };
      })
      .filter((line) => line.cantidad > 0);
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
  removeFromCart(productoId: string): void {
    this.cartLines = this.cartLines.filter(
      (line) => line.productoId !== productoId,
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
    this.cartLines = [];
    this.loadingProductRatesByCatalogId = {};
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
    this.cartLines = this.cartLines.map((line) =>
      line.productoId === productoId
        ? { ...line, selectedInstallments: installments }
        : line,
    );
    this.calculateDynamicRate();
  }

  // ── Client helpers ────────────────────────────────────────────────────────

  /**
   * Selecciona cliente y sincroniza el control del formulario.
   * @param {ClientOperation} client - Cliente elegido en el paso 1.
   */
  selectClient(client: ClientOperation): void {
    this.operationForm.controls.customerId.setValue(client.id);
    this.selectedClient.set(client);
  }

  /**
   * Verifica si el cliente actualmente seleccionado está activo.
   */
  isClientStepValid(): boolean {
    const clientId = this.operationForm.controls.customerId.value;
    if (!clientId) return false;
    const client = this.clients.find((c) => c.id === clientId);
    return client?.status === 'ACTIVE';
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
      this.loadingLoanData = true;
      this.loadLoanRates()
        .pipe(
          finalize(() => {
            this.loadingLoanData = false;
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

    if (type === 'SALE' && !this.saleDataLoaded) {
      this.loadingSaleData = true;
      this.loadSaleData()
        .pipe(
          finalize(() => {
            this.loadingSaleData = false;
          }),
        )
        .subscribe(() => {
          this.saleDataLoaded = true;
          this.catalogProducts = this.buildCatalogProducts();
          this.ensureValidFrequencySelection();
          this.ensureValidInstallmentsSelection();
          this.calculateDynamicRate();
        });
    }
  }

  /**
   * Agrupa unidades disponibles por producto para construir el catálogo del paso 2.
   */
  buildCatalogProducts(): CatalogProduct[] {
    const groups = new Map<string, CatalogProduct>();
    for (const unit of this.availableProducts) {
      const price = unit.historicalPrice ?? unit.price ?? 0;
      const key = `${unit.name}__${price}`;
      const existing = groups.get(key);
      if (existing) {
        existing.stockDisponible += 1;
        existing.unitIds.push(unit.id);
        if (unit.productId && !existing.productIds.includes(unit.productId)) {
          existing.productIds.push(unit.productId);
        }
      } else {
        groups.set(key, {
          productoId: key,
          nombre: unit.name,
          precio: price,
          stockDisponible: 1,
          unitIds: [unit.id],
          productIds: unit.productId ? [unit.productId] : [],
        });
      }
    }
    return Array.from(groups.values());
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
    this.cartLines = this.cartLines.map((line) => {
      const options = this.getInstallmentsOptionsForLine(line);
      if (options.length === 0) return { ...line, selectedInstallments: null };
      const isValid = options.some(
        (opt) => opt.value === line.selectedInstallments,
      );
      return isValid
        ? line
        : { ...line, selectedInstallments: options[0]?.value ?? null };
    });
  }

  /**
   * Calcula la tasa dinámica según tipo de operación, monto y cuotas elegidas.
   */
  calculateDynamicRate(): void {
    const type = this.operationForm.controls.operationType.value;

    if (type === 'LOAN') {
      const installments =
        this.operationForm.controls.installmentsCount.value ?? 0;
      this.dynamicRate = findLoanInterestRate(
        this.interestRates,
        installments,
        this.prestamoTotal,
      );
      return;
    }

    if (type === 'SALE') {
      const rates = this.cartLines
        .map((line) => this.getSelectedRateForLine(line)?.rate ?? 0)
        .filter((rate) => rate > 0);
      this.dynamicRate = rates.length > 0 ? Math.max(...rates) : 0;
      return;
    }

    this.dynamicRate = 0;
  }

  /**
   * Sincroniza el carrito agrupado con la lista de unidades requerida por el payload.
   */
  syncSelectedProductsFromCart(): void {
    const unitById = new Map(
      this.availableProducts.map((unit) => [unit.id, unit]),
    );
    const selectedUnits: ProductOperation[] = [];
    for (const line of this.cartLines) {
      const selectedIds = line.unitIds.slice(0, line.cantidad);
      for (const unitId of selectedIds) {
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
    this.isInstallmentsRefreshing = true;
    setTimeout(() => {
      const dropdown = document.querySelector(
        '[data-cy="ddl-installments"] .p-dropdown',
      ) as HTMLElement | null;
      dropdown?.focus();
    }, 0);
    setTimeout(() => {
      this.isInstallmentsRefreshing = false;
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

    const payload =
      type === 'SALE'
        ? {
            customerId: client!.id,
            type,
            items: this.cartLines.map((line) => ({
              productId: line.productoId,
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
            downPayment: this.getValidatedDownPayment(),
            installmentsCount: Math.max(
              1,
              ...this.cartLines.map((line) => line.selectedInstallments ?? 1),
            ),
            interestRate: this.interestRate,
            totalInstallmentValue: this.valorCuota,
            totalToPay: this.totalADevolver,
            firstPaymentDate,
            paymentFrequency: freq,
          }
        : {
            customerId: client!.id,
            type,
            totalAmount: this.prestamoTotal,
            downPayment: 0,
            installmentsCount,
            interestRate: this.interestRate,
            firstPaymentDate,
            paymentFrequency: freq,
          };

    this.submitting = true;
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
