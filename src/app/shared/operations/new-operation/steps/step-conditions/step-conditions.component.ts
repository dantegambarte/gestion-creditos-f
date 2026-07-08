import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthServiceBase } from '../../../../../core/auth/auth-service.base';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { ProductRate } from '../../../../../features/admin/config/models/interfaces/product';
import { SimulateResult } from '../../../../../features/seller/models/credit.model';
import { CurrencyAmountInputDirective } from '../../../../directives/currency-amount-input.directive';
import {
  CartLine,
  FirstPaymentDateMode,
  SaleInstallmentOption,
} from '../../operation-form.service';
import { StepConditionsSimulationPanelComponent } from './step-conditions-simulation-panel/step-conditions-simulation-panel.component';

@Component({
  selector: 'app-step-conditions',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    CalendarModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    MessageModule,
    RadioButtonModule,
    CurrencyAmountInputDirective,
    CurrencyArsPipe,
    StepConditionsSimulationPanelComponent,
  ],
  templateUrl: './step-conditions.component.html',
})
export class StepConditionsComponent implements OnChanges {
  private readonly auth = inject(AuthServiceBase);

  simulationVisible = false;
  private hadResolvedSimulation = false;

  /**
   * Indica si el usuario puede ver información financiera sensible (tasa por
   * producto). Se oculta a los roles de venta (SELLER / SELLER_COLLECTOR).
   */
  get canViewFinancialData(): boolean {
    return !this.auth.hasAnyRole(['SELLER', 'SELLER_COLLECTOR']);
  }

  readonly allPaymentFrequencies: {
    label: string;
    value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }[] = [
    { label: 'Semanal', value: 'WEEKLY' },
    { label: 'Quincenal', value: 'BIWEEKLY' },
    { label: 'Mensual', value: 'MONTHLY' },
  ];

  @Input() form!: FormGroup;
  @Input() cartLines: CartLine[] = [];
  @Input() paymentFrequencyOptions: {
    label: string;
    value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  }[] = [];
  @Input() installmentsOptions: {
    label: string;
    value: number;
    frequency: string;
  }[] = [];
  @Input() isInstallmentsRefreshing = false;
  @Input() capitalBase = 0;
  @Input() capitalAFinanciar = 0;
  @Input() interestRate = 0;
  @Input() valorCuota = 0;
  @Input() totalADevolver = 0;
  @Input() todayDate!: Date;
  @Input() installmentsDropdownClass = 'w-full';
  @Input() validatedDownPayment = 0;
  @Input() simulationResult: SimulateResult | null = null;
  @Input() simulationLoading = false;
  @Input() simulationError: string | null = null;
  @Input() canContinueWithPlan = false;

  @Output() saleInstallmentsChanged = new EventEmitter<{
    productoId: string;
    installments: number | null;
  }>();
  @Output() continueFromSimulationRequested = new EventEmitter<void>();
  @Output() simulationRequested = new EventEmitter<void>();
  @Output() paymentConditionChanged = new EventEmitter<'FINANCED' | 'CASH'>();

  readonly cashPaymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Mixto', value: 'MIXED' },
  ];

  /** Indica si la operación actual es una venta de contado. */
  get isSale(): boolean {
    return this.form?.controls['operationType']?.value === 'SALE';
  }

  get isCashSale(): boolean {
    return (
      this.isSale && this.form?.controls['paymentCondition']?.value === 'CASH'
    );
  }

  get cashSaleMethod(): string {
    return this.form?.controls['cashSaleMethod']?.value ?? 'CASH';
  }

  /** Total a cobrar en una venta de contado (suma del carrito). */
  get cashSaleTotal(): number {
    return this.cartLines.reduce(
      (acc, line) => acc + line.precio * line.cantidad,
      0,
    );
  }

  /**
   * Cambia la condición de pago (financiado/contado) y notifica al contenedor.
   * @param {'FINANCED' | 'CASH'} condition - Condición elegida por el usuario.
   */
  selectPaymentCondition(condition: 'FINANCED' | 'CASH'): void {
    if (this.form?.controls['paymentCondition']?.value === condition) return;
    this.paymentConditionChanged.emit(condition);
  }

  /**
   * Cierra la vista de simulación cuando cambian datos base y el resultado previo ya fue invalidado.
   * @param {SimpleChanges} changes - Cambios detectados por Angular en los inputs del paso.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['simulationResult'] ||
      changes['simulationError'] ||
      changes['simulationLoading']
    ) {
      const hasResolvedSimulation =
        !!this.simulationResult || !!this.simulationError;
      if (
        this.hadResolvedSimulation &&
        !hasResolvedSimulation &&
        !this.simulationLoading
      ) {
        this.simulationVisible = false;
      }
      this.hadResolvedSimulation = hasResolvedSimulation;
    }
  }

  /**
   * Determina si el modo de fecha activa la fecha derivada desde aprobación.
   */
  isApprovalDateMode(): boolean {
    const mode = this.form.controls['firstPaymentDateMode']
      ?.value as FirstPaymentDateMode | null;
    return mode === 'APPROVAL_DATE';
  }

  /**
   * Determina si el usuario está usando fecha personalizada.
   */
  isCustomDateMode(): boolean {
    const mode = this.form.controls['firstPaymentDateMode']
      ?.value as FirstPaymentDateMode | null;
    return mode === 'CUSTOM_DATE';
  }

  /**
   * Devuelve el texto de frecuencia para la ayuda visual del bloque de fecha.
   */
  getApprovalFrequencyHint(): string {
    const frequency = this.form.controls['paymentFrequency']?.value as
      | 'WEEKLY'
      | 'BIWEEKLY'
      | 'MONTHLY'
      | null;
    if (frequency === 'WEEKLY') return '+ 7 días';
    if (frequency === 'BIWEEKLY') return '+ 14 días';
    if (frequency === 'MONTHLY') return '+ 1 mes';
    return 'según frecuencia';
  }

  /**
   * Muestra u oculta el bloque visual con el resultado de simulación.
   */
  toggleSimulation(): void {
    if (!this.simulationVisible) {
      this.simulationRequested.emit();
    }
    this.simulationVisible = !this.simulationVisible;
  }

  /**
   * Determina si la simulación puede mostrarse con datos mínimos consistentes.
   */
  canShowSimulation(): boolean {
    const installments = this.getSelectedInstallmentsCount();
    return this.valorCuota > 0 && installments > 0 && this.totalADevolver > 0;
  }

  /**
   * Cantidad de cuotas aplicable a la operación actual (venta o préstamo).
   * @returns {number} Número de cuotas activas en la simulación.
   */
  getSelectedInstallmentsCount(): number {
    if (this.simulationResult?.installmentsCount) {
      return this.simulationResult.installmentsCount;
    }
    if (this.form.controls['operationType'].value === 'SALE') {
      return this.cartLines.reduce(
        (acc, line) => acc + (line.selectedInstallments ?? 0),
        0,
      );
    }
    return this.form.controls['installmentsCount']?.value ?? 0;
  }

  /**
   * Etiqueta de la cuota mostrada en el resumen del plan.
   * - Ventas muestran una cuota consolidada.
   * - Préstamos muestran la frecuencia seleccionada.
   */
  getInstallmentLabel(): string {
    if (this.form.controls['operationType'].value === 'SALE') {
      return 'Cuota consolidada';
    }

    const frequency = this.form.controls['paymentFrequency']?.value as
      | 'WEEKLY'
      | 'BIWEEKLY'
      | 'MONTHLY'
      | null;
    if (frequency === 'WEEKLY') return 'Cuota semanal';
    if (frequency === 'BIWEEKLY') return 'Cuota quincenal';
    return 'Cuota mensual';
  }

  /**
   * Máximo de cuotas que se pueden adelantar sin superar el plan seleccionado.
   * @returns {number} Límite superior válido para el input de adelanto.
   */
  getMaxAdvancedInstallments(): number {
    return Math.max(this.getSelectedInstallmentsCount() - 1, 0);
  }

  /**
   * Indica si el plan actual permite adelantar al menos una cuota.
   * @returns {boolean} True si existe margen para adelanto.
   */
  canAdvanceInstallments(): boolean {
    return this.getMaxAdvancedInstallments() > 0;
  }

  /** Calcula el total estimado a cobrar por cuotas adelantadas. */
  getAdvancedInstallmentsTotal(): number {
    const count = this.form.controls['advancedInstallmentsCount']?.value ?? 0;
    return Math.round(this.valorCuota * count * 100) / 100;
  }

  /** Indica si dos montos separados cierran contra el total esperado. */
  isSplitMatchingTotal(
    cash: number | null | undefined,
    transfer: number | null | undefined,
    total: number,
  ): boolean {
    if ((cash ?? 0) <= 0 || (transfer ?? 0) <= 0) return false;
    return (
      Math.round(((cash ?? 0) + (transfer ?? 0)) * 100) ===
      Math.round(total * 100)
    );
  }

  /**
   * Calcula el total estimado de intereses a partir del capital financiado y el total a devolver.
   */
  get totalInterestAmount(): number {
    if (this.simulationResult?.summary?.interestAmount !== undefined) {
      return this.simulationResult.summary.interestAmount;
    }
    if (this.simulationResult?.interestAmount !== undefined) {
      return this.simulationResult.interestAmount;
    }
    return Math.max(0, this.totalADevolver - this.capitalAFinanciar);
  }

  /**
   * Indica si una frecuencia es la actualmente seleccionada en el formulario.
   * @param {'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'} value - Frecuencia a comparar.
   */
  isFrequencySelected(value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'): boolean {
    return this.form.controls['paymentFrequency']?.value === value;
  }

  /**
   * Actualiza la frecuencia de pago desde los botones premium del layout.
   * @param {'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'} value - Frecuencia elegida por el usuario.
   */
  selectFrequency(value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'): void {
    if (!this.isFrequencyAvailable(value)) return;
    this.form.controls['paymentFrequency']?.setValue(value);
    this.form.controls['paymentFrequency']?.markAsDirty();
    this.form.controls['paymentFrequency']?.markAsTouched();
  }

  /**
   * Indica si una frecuencia está habilitada según las opciones actuales del negocio.
   * @param {'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'} value - Frecuencia a validar.
   */
  isFrequencyAvailable(value: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'): boolean {
    return this.paymentFrequencyOptions.some(
      (option) => option.value === value,
    );
  }

  /**
   * Opciones de cuotas para una línea del carrito según la frecuencia seleccionada.
   * @param {CartLine} line - Línea del carrito a evaluar.
   */
  getInstallmentsOptionsForLine(line: CartLine): SaleInstallmentOption[] {
    const selectedFrequency = this.form.controls['paymentFrequency']?.value as
      | string
      | null;
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
   * Tasa seleccionada para una línea del carrito según cuotas y frecuencia del formulario.
   * @param {CartLine} line - Línea del carrito a evaluar.
   */
  private getSelectedRateForLine(line: CartLine): ProductRate | undefined {
    const selectedFrequency = this.form.controls['paymentFrequency']?.value as
      | string
      | null;
    if (!line.selectedInstallments || !selectedFrequency) return undefined;
    return line.rates.find(
      (rate) =>
        rate.installmentsCount === line.selectedInstallments &&
        rate.paymentFrequency === selectedFrequency,
    );
  }

  private getLineDownPayment(line: CartLine): number {
    const totalCarrito = this.cartLines.reduce(
      (acc, l) => acc + l.precio * l.cantidad,
      0,
    );
    if (this.validatedDownPayment <= 0 || totalCarrito <= 0) return 0;
    return (line.subtotal / totalCarrito) * this.validatedDownPayment;
  }

  private getLineFinancedCapital(line: CartLine): number {
    return Math.max(0, line.subtotal - this.getLineDownPayment(line));
  }

  /**
   * Valor de cuota de una línea con la fórmula oficial (redondeado al millar).
   * @param {CartLine} line - Línea del carrito a calcular.
   */
  getLineInstallmentValue(line: CartLine): number {
    const installments = line.selectedInstallments ?? 0;
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    if (installments <= 0) return 0;
    return (
      Math.ceil(
        (this.getLineFinancedCapital(line) * (1 + rate)) / installments / 1000,
      ) * 1000
    );
  }

  /**
   * Descripción corta del plan de cuotas por producto.
   * @param {CartLine} line - Línea del carrito en evaluación.
   */
  getLinePlanSubtitle(line: CartLine): string {
    const installments = line.selectedInstallments ?? 0;
    const money = (value: number) =>
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }).format(value);
    if (installments <= 0)
      return `${line.cantidad} u. · ${money(line.subtotal)} total`;
    return `${line.cantidad} u. · ${installments} cuota${installments > 1 ? 's' : ''} de ${money(this.getLineInstallmentValue(line))}`;
  }

  /**
   * Porcentaje de interés aplicado en una línea del carrito.
   * @param {CartLine} line - Línea del carrito a consultar.
   */
  getLineRatePercent(line: CartLine): number {
    const rate = this.getSelectedRateForLine(line)?.rate ?? 0;
    return Math.round(rate * 10000) / 100;
  }
}
