import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { distinctUntilChanged } from 'rxjs/operators';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { StepsModule } from 'primeng/steps';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import {
  PaymentFrequency,
} from '../../../features/seller/models/credit.model';
import { OperationFormService } from './operation-form.service';
import { ClientOperation } from '../../models/interface/client';
import { ProductOperation } from '../../models/interface/product';
import { ProductRate } from '../../../features/admin/config/models/interfaces/product';

type CatalogProduct = {
  productoId: string;
  nombre: string;
  precio: number;
  stockDisponible: number;
  unitIds: string[];
  productIds: string[];
};

type SaleInstallmentOption = {
  label: string;
  value: number;
  frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
};

type CartLine = {
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

@Component({
  selector: 'app-new-operation',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    StepsModule,
    ButtonModule,
    TooltipModule,
    ToastModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    CalendarModule,
    CheckboxModule,
    MessageModule,
    CurrencyArsPipe,
  ],
  providers: [OperationFormService, MessageService],
  templateUrl: './new-operation.component.html',
  styleUrl: './new-operation.component.scss',
})
export class NewOperationComponent implements OnInit {
  @Output() onComplete = new EventEmitter<void>();

  private fb = inject(FormBuilder);

  activeIndex = 0;
  submitting = false;
  steps: MenuItem[] | undefined;
  searchText = '';
  catalogSearchText = '';

  operationTypeOptions = [
    { label: 'Venta', value: 'SALE' as const },
    { label: 'Préstamo', value: 'LOAN' as const },
  ];
  dynamicRate = 0;
  loadingLoanData = false;
  loadingSaleData = false;
  private loanRatesLoaded = false;
  private saleDataLoaded = false;
  isInstallmentsRefreshing = false;
  todayDate = this.getTodayStart();

  catalogProducts: CatalogProduct[] = [];
  cartLines: CartLine[] = [];
  loadingProductRatesByCatalogId: Record<string, boolean> = {};

  operationForm = this.fb.group({
    customerId: this.fb.control<string | null>(null, [Validators.required]),
    operationType: this.fb.control<'SALE' | 'LOAN' | null>(null, [Validators.required]),
    totalAmount: this.fb.control<number | null>(null),
    downPayment: this.fb.control<number | null>(null, [Validators.min(0)]),
    paymentFrequency: this.fb.control<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null>(null, [Validators.required]),
    installmentsCount: this.fb.control<number | null>(null, [Validators.required]),
    firstPaymentDate: this.fb.control<Date | null>(null, [
      Validators.required,
      this.notPastDateValidator(),
    ]),
    chkIdentity: this.fb.control(false, [Validators.requiredTrue]),
    chkConditions: this.fb.control(false, [Validators.requiredTrue]),
    chkDisbursement: this.fb.control(false, [Validators.requiredTrue]),
    chkCapacity: this.fb.control(false, [Validators.requiredTrue]),
  });

  constructor(
    public form: OperationFormService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
  ) {}

  /**
   * Devuelve los clientes filtrados por nombre o DNI según el texto de búsqueda.
   * @returns {ClientOperation[]} clientes visibles en la lista del paso 1.
   */
  filteredClients(): ClientOperation[] {
    const term = this.searchText.trim().toLowerCase();
    if (!term) return this.form.clients;
    return this.form.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.dni.toLowerCase().includes(term),
    );
  }

  /**
   * Total del carrito para ventas, sumando precio por cantidad de cada línea.
   * @returns {number} total acumulado del carrito.
   */
  get totalCarrito(): number {
    return this.cartLines.reduce(
      (acc, line) => acc + line.precio * line.cantidad,
      0,
    );
  }

  /**
   * Capital base del préstamo según el monto total ingresado en el formulario.
   * @returns {number} monto solicitado para operaciones LOAN.
   */
  get prestamoTotal(): number {
    return this.operationForm.get('totalAmount')?.value ?? 0;
  }

  /**
   * Capital base consolidado según el tipo de operación actual.
   * @returns {number} total carrito para venta o monto para préstamo.
   */
  get capitalBase(): number {
    return this.operationForm.controls.operationType.value === 'LOAN'
      ? this.prestamoTotal
      : this.totalCarrito;
  }

  /**
   * Tasa aplicada según cantidad de cuotas elegida.
   * @returns {number} tasa decimal (ej: 0.8 = 80%).
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
   * @returns {number} capital a financiar no negativo.
   */
  get capitalAFinanciar(): number {
    const downPayment =
      this.operationForm.controls.operationType.value === 'SALE'
        ? this.getValidatedDownPayment()
        : 0;
    return Math.max(0, this.capitalBase - downPayment);
  }

  /**
   * Valor unitario de cuota usando la fórmula exacta del backend.
   * @returns {number} cuota redondeada al millar superior.
   */
  get valorCuota(): number {
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines.reduce(
        (acc, line) => acc + this.getLineInstallmentValue(line),
        0,
      );
    }

    const cuotas = this.operationForm.controls.installmentsCount.value ?? 0;
    if (cuotas <= 0) return 0;

    return (
      Math.ceil(
        (this.capitalAFinanciar * (1 + this.interestRate)) / cuotas / 1000,
      ) * 1000
    );
  }

  /**
   * Total final a devolver en todo el plan de pagos.
   * @returns {number} suma de todas las cuotas.
   */
  get totalADevolver(): number {
    if (this.operationForm.controls.operationType.value === 'SALE') {
      return this.cartLines.reduce((acc, line) => {
        const installments = line.selectedInstallments ?? 0;
        return acc + this.getLineInstallmentValue(line) * installments;
      }, 0);
    }

    const cuotas = this.operationForm.controls.installmentsCount.value ?? 0;
    return this.valorCuota * cuotas;
  }

  /**
   * Devuelve el catálogo filtrado por nombre para acelerar la búsqueda en el paso 2.
   * @returns {CatalogProduct[]} productos visibles tras aplicar el término de búsqueda.
   */
  get filteredCatalogProducts(): CatalogProduct[] {
    const term = this.catalogSearchText.trim().toLowerCase();
    if (!term) return this.catalogProducts;
    return this.catalogProducts.filter((p) => p.nombre.toLowerCase().includes(term));
  }

  /**
   * Indica si un producto del catálogo ya alcanzó todo su stock dentro del carrito.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @returns {boolean} true cuando no se pueden agregar más unidades de ese producto.
   */
  isCatalogProductOutOfStock(product: CatalogProduct): boolean {
    const existing = this.cartLines.find((line) => line.productoId === product.productoId);
    return (existing?.cantidad ?? 0) >= product.stockDisponible;
  }

  /**
   * Indica si las 4 declaraciones obligatorias fueron aceptadas.
   * @returns {boolean} true cuando todas las casillas están marcadas.
   */
  get declarationsAccepted(): boolean {
    const controls = this.operationForm.controls;
    return (
      controls.chkIdentity.value === true &&
      controls.chkConditions.value === true &&
      controls.chkDisbursement.value === true &&
      controls.chkCapacity.value === true
    );
  }

  /**
   * Indica si el envío final está habilitado.
   * @returns {boolean} true cuando el formulario completo está válido y listo para enviar.
   */
  get canSubmitOperation(): boolean {
    return this.operationForm.valid && this.declarationsAccepted && !this.submitting;
  }

  /**
   * Clase visual del dropdown de cuotas para resaltar cambios por frecuencia.
   * @returns {string} clases Tailwind/Prime para estado normal o refrescando.
   */
  get installmentsDropdownClass(): string {
    return this.isInstallmentsRefreshing
      ? 'w-full ring-2 ring-blue-400/60 rounded-xl transition-all duration-300'
      : 'w-full';
  }

  /**
   * Opciones de frecuencia de pago habilitadas según el tipo y datos cargados.
   * @returns {{label: string; value: 'WEEKLY'|'BIWEEKLY'|'MONTHLY'}[]}
   */
  get paymentFrequencyOptions(): {
    label: string;
    value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }[] {
    const type = this.operationForm.controls.operationType.value;

    const baseFrequencies =
      type === 'LOAN'
        ? this.form.interestRates.map((r) => r.paymentFrequency)
        : this.cartLines.flatMap((line) => line.rates.map((r) => r.paymentFrequency));

    const unique = Array.from(new Set(baseFrequencies));

    const labelByFrequency: Record<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY', string> = {
      WEEKLY: 'Semanal',
      BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual',
    };

    return unique.map((f) => ({ label: labelByFrequency[f], value: f }));
  }

  /**
   * Opciones dinámicas de cuotas para el paso 3 según el tipo y datos cargados.
   * Incluye frecuencia en el label para mejor claridad comercial.
   * @returns {{ label: string; value: number; frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' }[]} opciones disponibles desde backend.
   */
  get installmentsOptions(): {
    label: string;
    value: number;
    frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
  }[] {
    const type = this.operationForm.controls.operationType.value;
    const selectedFrequency = this.operationForm.controls.paymentFrequency.value;

    const formatFrequency = (f: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY') => {
      if (f === 'MONTHLY') return 'Mensual';
      if (f === 'BIWEEKLY') return 'Quincenal';
      return 'Semanal';
    };

    if (type === 'LOAN') {
      const amount = this.prestamoTotal;
      const matchingRates = this.form.interestRates.filter((r) => {
        const minOk = amount >= r.minAmount;
        const maxOk = r.maxAmount == null || amount <= r.maxAmount;
        const freqOk = !selectedFrequency || r.paymentFrequency === selectedFrequency;
        return minOk && maxOk && freqOk;
      });

      const unique = new Map<
        string,
        { label: string; value: number; frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' }
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
        { label: string; value: number; frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY' }
      >();

      for (const r of this.cartLines
        .flatMap((line) => line.rates)
        .filter((rate) => !selectedFrequency || rate.paymentFrequency === selectedFrequency)) {
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
   * Obtiene las opciones de cuotas disponibles para una línea del carrito según frecuencia.
   * @param {CartLine} line - Línea de carrito a evaluar.
   * @returns {SaleInstallmentOption[]} cuotas habilitadas para ese producto.
   */
  getInstallmentsOptionsForLine(line: CartLine): SaleInstallmentOption[] {
    const selectedFrequency = this.operationForm.controls.paymentFrequency.value;
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
   * Resuelve la tasa seleccionada para una línea del carrito según cuotas y frecuencia.
   * @param {CartLine} line - Línea de carrito a evaluar.
   * @returns {ProductRate | undefined} tasa aplicada para esa línea.
   */
  getSelectedRateForLine(line: CartLine): ProductRate | undefined {
    const selectedFrequency = this.operationForm.controls.paymentFrequency.value;
    if (!line.selectedInstallments || !selectedFrequency) return undefined;

    return line.rates.find(
      (rate) =>
        rate.installmentsCount === line.selectedInstallments &&
        rate.paymentFrequency === selectedFrequency,
    );
  }

  /**
   * Calcula el valor de cuota individual de una línea con la fórmula oficial.
   * @param {CartLine} line - Línea de carrito a calcular.
   * @returns {number} valor de cuota de ese producto.
   */
  getLineInstallmentValue(line: CartLine): number {
    const installments = line.selectedInstallments ?? 0;
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    if (installments <= 0) return 0;

    return (
      Math.ceil((this.getLineFinancedCapital(line) * (1 + rate)) / installments / 1000) * 1000
    );
  }

  /**
   * Calcula el anticipo prorrateado para una línea del carrito según su peso en el total.
   * @param {CartLine} line - Línea sobre la cual distribuir el anticipo.
   * @returns {number} monto de anticipo aplicado a la línea.
   */
  getLineDownPayment(line: CartLine): number {
    const downPayment = this.getValidatedDownPayment();
    if (downPayment <= 0 || this.totalCarrito <= 0) return 0;
    return (line.subtotal / this.totalCarrito) * downPayment;
  }

  /**
   * Normaliza y acota el anticipo para evitar valores inválidos antes de calcular o enviar.
   * @returns {number} anticipo seguro entre 0 y capital base.
   */
  getValidatedDownPayment(): number {
    const raw = this.operationForm.controls.downPayment.value ?? 0;
    return Math.min(Math.max(raw, 0), this.capitalBase);
  }

  /**
   * Devuelve el capital financiado de una línea descontando el anticipo prorrateado.
   * @param {CartLine} line - Línea a evaluar.
   * @returns {number} capital neto a financiar para ese producto.
   */
  getLineFinancedCapital(line: CartLine): number {
    return Math.max(0, line.subtotal - this.getLineDownPayment(line));
  }

  /**
   * Construye una descripción corta del plan de cuotas por producto.
   * @param {CartLine} line - Línea de carrito en evaluación.
   * @returns {string} texto comercial del plan del producto.
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
   * Devuelve el porcentaje de interés aplicado en una línea del carrito.
   * @param {CartLine} line - Línea de carrito a consultar.
   * @returns {number} tasa en porcentaje para mostrar en UI.
   */
  getLineRatePercent(line: CartLine): number {
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    return Math.round(rate * 10000) / 100;
  }

  /**
   * Construye un validador que bloquea fechas anteriores al día actual.
   * @returns {ValidatorFn} validador para el control de primer pago.
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
   * Obtiene la fecha actual truncada al inicio del día local.
   * @returns {Date} fecha de hoy a las 00:00 para comparaciones consistentes.
   */
  getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  ngOnInit() {
    this.steps = [
      { label: 'Cliente' },
      { label: 'Tipo y Producto' },
      { label: 'Condiciones' },
      { label: 'Confirmación' },
    ];

    const clientDni = this.route.snapshot.queryParamMap.get('clientDni');
    // Paso 1: SOLO clientes. Sin tasas ni unidades en el arranque.
    this.form.loadClients().subscribe(() => {
      if (clientDni) {
        const match = this.form.clients.find((c) => c.dni === clientDni);
        if (match?.status === 'ACTIVE') {
          this.selectClient(match);
          this.activeIndex = 1;
        }
      }
    });

    this.operationForm.controls.operationType.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((type) => {
      const totalAmountControl = this.operationForm.controls.totalAmount;
      const installmentsControl = this.operationForm.controls.installmentsCount;
      if (type) {
        this.form.setOperationType(type);
      }

      if (type === 'LOAN') {
        totalAmountControl.setValidators([Validators.required, Validators.min(1)]);
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

    this.operationForm.controls.paymentFrequency.valueChanges.subscribe((value) => {
      if (value) {
        const freq = this.form.paymentFrequencies.find((f) => f.value === value);
        if (freq) this.form.selectedFrequency.set(freq);
      }

      this.operationForm.controls.installmentsCount.setValue(null, {
        emitEvent: false,
      });

      this.ensureValidSaleLineInstallments();
      this.ensureValidInstallmentsSelection();
      this.refreshInstallmentsUX();
      this.calculateDynamicRate();
    });

    this.operationForm.controls.totalAmount.valueChanges.subscribe((amount) => {
      this.form.loanCapital.set(amount ?? 0);
      this.calculateDynamicRate();
    });

    this.operationForm.controls.downPayment.valueChanges.subscribe((value) => {
      this.form.downPayment.set(value ?? 0);
    });

    this.operationForm.controls.installmentsCount.valueChanges.subscribe((value) => {
      if (this.operationForm.controls.operationType.value === 'LOAN' && value) {
        this.form.selectedInstallments.set(value);
      }
      this.calculateDynamicRate();
    });

    this.operationForm.controls.firstPaymentDate.valueChanges.subscribe((value) => {
      this.form.firstDueDate.set(value ?? undefined);
    });
  }

  /**
   * Agrupa unidades disponibles por producto para construir el catálogo del paso 2.
   * @returns {{ productoId: string; nombre: string; precio: number; stockDisponible: number; unitIds: string[] }[]}
   */
  buildCatalogProducts() {
    const groups = new Map<
      string,
      {
        productoId: string;
        nombre: string;
        precio: number;
        stockDisponible: number;
        unitIds: string[];
        productIds: string[];
      }
    >();

    for (const unit of this.form.availableProducts) {
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

  /**
   * Selecciona cliente y sincroniza con signal de servicio para mantener compatibilidad.
   * @param {ClientOperation} client - cliente elegido en el paso 1.
   */
  selectClient(client: ClientOperation) {
    this.operationForm.controls.customerId.setValue(client.id);
    this.form.selectedClient.set(client);
  }

  /**
   * Carga datos on-demand según tipo elegido para evitar eager loading innecesario.
   * @param {'SALE' | 'LOAN' | null} type - tipo de operación seleccionado.
   */
  loadTypeDataOnDemand(type: 'SALE' | 'LOAN' | null) {
    if (type === 'LOAN' && !this.loanRatesLoaded) {
      this.loadingLoanData = true;
      this.form
        .loadLoanRates()
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
      this.form
        .loadSaleData()
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
   * Mantiene consistente la cuota seleccionada con las opciones dinámicas disponibles.
   */
  ensureValidInstallmentsSelection() {
    const control = this.operationForm.controls.installmentsCount;
    const type = this.operationForm.controls.operationType.value;

    if (type === 'SALE') {
      if (control.enabled) {
        control.disable({ emitEvent: false });
      }
      if (control.value !== null) {
        control.setValue(null, { emitEvent: false });
      }
      return;
    }

    const options = this.installmentsOptions;
    const selected = control.value;

    if (options.length === 0) {
      if (control.enabled) {
        control.disable({ emitEvent: false });
      }
      if (selected !== null) {
        control.setValue(null, { emitEvent: false });
      }
      return;
    }

    if (control.disabled) {
      control.enable({ emitEvent: false });
    }

    const exists = options.some((o) => o.value === selected);

    if (!exists) {
      const nextValue = options[0]?.value ?? null;
      control.setValue(nextValue);
    }
  }

  /**
   * Ajusta frecuencia seleccionada si quedó inválida respecto a opciones disponibles.
   */
  ensureValidFrequencySelection() {
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
   * Marca visualmente el recálculo de cuotas y mueve foco al dropdown correspondiente.
   */
  refreshInstallmentsUX() {
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
   * Verifica si el cliente está activo para habilitar avance del paso 1.
   * @returns {boolean} true cuando hay cliente activo seleccionado.
   */
  isClientStepValid(): boolean {
    const clientId = this.operationForm.controls.customerId.value;
    if (!clientId) return false;
    const client = this.form.clients.find((c) => c.id === clientId);
    return client?.status === 'ACTIVE';
  }

  /**
   * Agrega un producto al carrito o incrementa su cantidad sin superar stock disponible.
   * @param {{ productoId: string; nombre: string; precio: number; stockDisponible: number; unitIds: string[]; productIds: string[] }} product
   */
  addProduct(product: CatalogProduct) {
    if (this.loadingProductRatesByCatalogId[product.productoId]) return;

    const existing = this.cartLines.find((line) => line.productoId === product.productoId);
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

    this.form
      .loadProductRatesByProductId(firstProductId)
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
   * Inserta o incrementa una línea del carrito preservando tasas por producto.
   * @param {CatalogProduct} product - Producto agrupado del catálogo.
   * @param {ProductRate[]} rates - Tasas activas asociadas al producto.
   */
  upsertCartLine(product: CatalogProduct, rates: ProductRate[]) {
    const existing = this.cartLines.find((line) => line.productoId === product.productoId);

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
                 (this.getInstallmentsOptionsForLine({ ...line, rates })[0]?.value ?? null),
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
   * Muestra un aviso único cuando el usuario intenta agregar un producto sin stock disponible.
   * Limpia el toast anterior para evitar acumulación visual de notificaciones repetidas.
   * @param {string} productName - Nombre comercial del producto sin stock.
   */
  notifyProductOutOfStock(productName: string) {
    this.messageService.clear();
    this.messageService.add({
      severity: 'warn',
      summary: 'Sin stock disponible',
      detail: `El producto ${productName} no tiene más stock.`,
      life: 2500,
    });
  }

  /**
   * Actualiza la cuota seleccionada de un producto específico en ventas.
   * @param {string} productoId - ID de línea agrupada en el carrito.
   * @param {number | null} installments - Cantidad de cuotas elegida.
   */
  onSaleInstallmentsChange(productoId: string, installments: number | null) {
    this.cartLines = this.cartLines.map((line) =>
      line.productoId === productoId
        ? { ...line, selectedInstallments: installments }
        : line,
    );
    this.calculateDynamicRate();
  }

  /**
   * Incrementa una línea del carrito respetando el stock disponible.
   * @param {string} productoId - identificador del producto agrupado.
   */
  increaseQuantity(productoId: string) {
    this.cartLines = this.cartLines.map((line) => {
      if (line.productoId !== productoId || line.cantidad >= line.stockDisponible) {
        return line;
      }
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
   * Disminuye una línea del carrito; si llega a cero elimina la línea.
   * @param {string} productoId - identificador del producto agrupado.
   */
  decreaseQuantity(productoId: string) {
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
   * @param {string} productoId - identificador del producto agrupado.
   */
  removeProduct(productoId: string) {
    this.cartLines = this.cartLines.filter((line) => line.productoId !== productoId);
    this.syncSelectedProductsFromCart();
    this.ensureValidSaleLineInstallments();
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Vacía todo el carrito de venta y limpia la selección sincronizada.
   */
  clearCart() {
    this.cartLines = [];
    this.loadingProductRatesByCatalogId = {};
    this.form.selectedProducts.set([]);
    this.ensureValidFrequencySelection();
    this.ensureValidInstallmentsSelection();
    this.calculateDynamicRate();
  }

  /**
   * Calcula la tasa dinámica según tipo de operación, monto/capital y cuotas elegidas.
   * En ventas con múltiples productos usa la tasa más alta para mantener criterio conservador.
   */
  calculateDynamicRate() {
    const type = this.operationForm.controls.operationType.value;

    if (type === 'LOAN') {
      const installments = this.operationForm.controls.installmentsCount.value ?? 0;
      if (installments <= 0) {
        this.dynamicRate = 0;
        return;
      }

      const capitalBase = this.prestamoTotal;
      const match = this.form.interestRates.find((rate) => {
        const sameInstallments = rate.installmentsCount === installments;
        const minOk = capitalBase >= rate.minAmount;
        const maxOk = rate.maxAmount == null || capitalBase <= rate.maxAmount;
        return sameInstallments && minOk && maxOk;
      });

      this.dynamicRate = match?.rate ?? 0;
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
   * Sincroniza el carrito agrupado con la lista de unidades requerida por el payload backend.
   */
  syncSelectedProductsFromCart() {
    const unitById = new Map(this.form.availableProducts.map((unit) => [unit.id, unit]));
    const selectedUnits: ProductOperation[] = [];

    for (const line of this.cartLines) {
      const selectedIds = line.unitIds.slice(0, line.cantidad);
      for (const unitId of selectedIds) {
        const unit = unitById.get(unitId);
        if (unit) selectedUnits.push(unit);
      }
    }

    this.form.selectedProducts.set(selectedUnits);
  }

  /**
   * Revalida cuotas de cada línea al cambiar frecuencia o tasas disponibles.
   */
  ensureValidSaleLineInstallments() {
    this.cartLines = this.cartLines.map((line) => {
      const options = this.getInstallmentsOptionsForLine(line);
      if (options.length === 0) {
        return { ...line, selectedInstallments: null };
      }
      const isValid = options.some((opt) => opt.value === line.selectedInstallments);
      return isValid ? line : { ...line, selectedInstallments: options[0]?.value ?? null };
    });
  }

  nextStep() {
    if (this.activeIndex < 3) this.activeIndex++;
  }
  prevStep() {
    if (this.activeIndex > 0) this.activeIndex--;
  }

  /**
   * Define si el usuario puede avanzar al siguiente paso del wizard.
   * En condiciones exige fecha de primer pago válida y enganche correcto para ventas.
   * @returns {boolean} true cuando el paso actual cumple sus validaciones obligatorias.
   */
  get canNext(): boolean {
    if (this.activeIndex === 0) return this.isClientStepValid();
    if (this.activeIndex === 1) {
      const type = this.operationForm.controls.operationType.value;
      if (type === 'LOAN') return this.operationForm.controls.totalAmount.valid;
      if (type === 'SALE') return this.cartLines.length > 0;
      return false;
    }
    if (this.activeIndex === 2) {
      const isSale = this.operationForm.controls.operationType.value === 'SALE';
      const downPayment = this.operationForm.controls.downPayment.value ?? 0;
      const downPaymentValid = !isSale || downPayment <= this.capitalBase;
      const saleInstallmentsValid =
        !isSale || this.cartLines.every((line) => (line.selectedInstallments ?? 0) > 0);

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

  /**
   * Envía la operación para aprobación con el payload consolidado de los 4 pasos.
   */
  submitOperation() {
    const client = this.form.selectedClient();
    const type = this.operationForm.controls.operationType.value;
    const installmentsCount = this.operationForm.controls.installmentsCount.value;
    const firstPaymentDate = this.operationForm.controls.firstPaymentDate.value;

    if (!client || !type || !firstPaymentDate) return;
    if (type === 'LOAN' && !installmentsCount) return;
    if (type === 'SALE' && this.cartLines.some((line) => !line.selectedInstallments)) return;
    if (!this.canSubmitOperation) return;

    const selectedUnits = this.form.selectedProducts();
    const freq = this.form.selectedFrequency().value as PaymentFrequency;

    const payload =
      type === 'SALE'
        ? {
            customerId: client.id,
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
            customerId: client.id,
            type,
            totalAmount: this.prestamoTotal,
            downPayment: 0,
            installmentsCount,
            interestRate: this.interestRate,
            firstPaymentDate,
            paymentFrequency: freq,
          };

    this.submitting = true;
    this.form.submitOperation(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Operación enviada',
          detail: 'La operación fue enviada para aprobación correctamente.',
          life: 3000,
        });
        this.onComplete.emit();
        const base = this.router.url.split('/operations')[0];
        setTimeout(() => this.router.navigate([base, 'operations']), 1500);
      },
      error: (err: unknown) => {
        this.submitting = false;
        const errorMessage =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'No se pudo registrar la operación.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: errorMessage,
          life: 5000,
        });
      },
    });
  }
}
