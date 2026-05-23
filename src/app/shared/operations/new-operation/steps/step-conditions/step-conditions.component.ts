import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../directives/currency-amount-input.directive';
import { ProductRate } from '../../../../../features/admin/config/models/interfaces/product';
import { SimulateResult } from '../../../../../features/seller/models/credit.model';
import {
  CartLine,
  FirstPaymentDateMode,
  SaleInstallmentOption,
} from '../../operation-form.service';

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
  ],
  templateUrl: './step-conditions.component.html',
})
export class StepConditionsComponent implements OnChanges {
  simulationVisible = false;
  private hadResolvedSimulation = false;

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

  /**
   * Cierra la vista de simulación cuando cambian datos base y el resultado previo ya fue invalidado.
   * @param {SimpleChanges} changes - Cambios detectados por Angular en los inputs del paso.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['simulationResult'] || changes['simulationError'] || changes['simulationLoading']) {
      const hasResolvedSimulation = !!this.simulationResult || !!this.simulationError;
      if (this.hadResolvedSimulation && !hasResolvedSimulation && !this.simulationLoading) {
        this.simulationVisible = false;
      }
      this.hadResolvedSimulation = hasResolvedSimulation;
    }
  }

  /**
   * Determina si el modo de fecha activa la fecha derivada desde aprobación.
   */
  isApprovalDateMode(): boolean {
    const mode = this.form.controls['firstPaymentDateMode']?.value as
      | FirstPaymentDateMode
      | null;
    return mode === 'APPROVAL_DATE';
  }

  /**
   * Determina si el usuario está usando fecha personalizada.
   */
  isCustomDateMode(): boolean {
    const mode = this.form.controls['firstPaymentDateMode']?.value as
      | FirstPaymentDateMode
      | null;
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
   * Etiqueta legible de la frecuencia de pago seleccionada actualmente.
   */
  getSelectedFrequencyLabel(): string {
    const frequency = this.form.controls['paymentFrequency']?.value as
      | 'WEEKLY'
      | 'BIWEEKLY'
      | 'MONTHLY'
      | null;
    if (frequency === 'WEEKLY') return 'Semanal';
    if (frequency === 'BIWEEKLY') return 'Quincenal';
    if (frequency === 'MONTHLY') return 'Mensual';
    return 'Sin definir';
  }

  /**
   * Estado breve de actualización de la simulación para mostrar en el bloque premium.
   */
  getSimulationStatusLabel(): string {
    if (!this.canShowSimulation()) return 'Completá los datos para simular';
    if (this.simulationLoading) return 'Calculando simulación';
    if (this.simulationError) return 'Simulación no disponible';
    if (this.hasRealSimulation()) return 'Simulación actualizada';
    return 'Lista para simular';
  }

  /**
   * Construye una vista corta del cronograma para mostrar en el panel lateral.
   */
  getSchedulePreview(): {
    installment: number;
    dueDate: Date;
    amount: number;
  }[] {
    const startDate = this.form.controls['firstPaymentDate']?.value as Date | null;
    if (!startDate || !this.canShowSimulation()) return [];

    const installments = this.getSelectedInstallmentsCount();
    const rows = Math.min(installments, 4);
    return Array.from({ length: rows }).map((_, index) => ({
      installment: index + 1,
      dueDate: this.addFrequencyToDate(startDate, index),
      amount: this.valorCuota,
    }));
  }

  /**
   * Genera el cronograma principal visible en el bloque ancho de simulación.
   * Incluye saldo estimado remanente para reforzar la lectura visual del plan.
   */
  getSimulationScheduleRows(): {
    installment: number;
    dueDate: Date;
    amount: number;
    capital?: number;
    interest?: number;
    remainingEstimated: number;
  }[] {
    if (this.simulationResult?.schedule?.length) {
      return this.simulationResult.schedule.map((row) => ({
        installment: row.installmentNumber,
        dueDate: new Date(row.dueDate),
        amount: row.amount,
        capital: row.capital,
        interest: row.interest,
        remainingEstimated: row.remainingEstimated ?? 0,
      }));
    }

    const startDate = this.form.controls['firstPaymentDate']?.value as Date | null;
    if (!startDate || !this.canShowSimulation()) return [];

    const installments = this.getSelectedInstallmentsCount();
    const rows = Math.min(installments, 8);
    return Array.from({ length: rows }).map((_, index) => {
      const paidAmount = this.valorCuota * (index + 1);
      return {
        installment: index + 1,
        dueDate: this.addFrequencyToDate(startDate, index),
        amount: this.valorCuota,
        remainingEstimated: Math.max(0, this.totalADevolver - paidAmount),
      };
    });
  }

  /**
   * Informa si el plan tiene más cuotas de las filas visibles en el cronograma.
   */
  hasHiddenScheduleRows(): boolean {
    return this.getSelectedInstallmentsCount() > this.getSimulationScheduleRows().length;
  }

  /**
   * Obtiene la primera fecha de vencimiento visible para el resumen lateral.
   */
  getFirstSimulationDueDate(): Date | null {
    const firstRow = this.getSimulationScheduleRows()[0];
    return firstRow ? firstRow.dueDate : null;
  }

  /**
   * Indica si ya existe una simulación real devuelta por backend.
   */
  hasRealSimulation(): boolean {
    return !!this.simulationResult;
  }

  /**
   * Avanza una fecha según la frecuencia seleccionada para armar el preview.
   * @param {Date} baseDate - Fecha base del primer vencimiento.
   * @param {number} index - Desplazamiento de cuota desde el primer vencimiento.
   */
  private addFrequencyToDate(baseDate: Date, index: number): Date {
    const frequency = this.form.controls['paymentFrequency']?.value as
      | 'WEEKLY'
      | 'BIWEEKLY'
      | 'MONTHLY'
      | null;
    const date = new Date(baseDate);
    if (frequency === 'WEEKLY') {
      date.setDate(date.getDate() + index * 7);
      return date;
    }
    if (frequency === 'BIWEEKLY') {
      date.setDate(date.getDate() + index * 14);
      return date;
    }
    date.setMonth(date.getMonth() + index);
    return date;
  }

  /**
   * Mensaje resumen para la tarjeta del plan financiado.
   */
  getPlanSummary(): string {
    const installments = this.getSelectedInstallmentsCount();
    return `${installments} cuota${installments === 1 ? '' : 's'} ${this.getSelectedFrequencyLabel().toLowerCase()} de ${new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(this.valorCuota)}`;
  }

  /**
   * Formatea fechas del cronograma para mostrar en formato local corto.
   * @param {Date} date - Fecha a formatear.
   */
  getFormattedDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Dispara la continuación del wizard desde el CTA interno de simulación.
   */
  continueFromSimulation(): void {
    this.continueFromSimulationRequested.emit();
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
    return this.paymentFrequencyOptions.some((option) => option.value === value);
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
