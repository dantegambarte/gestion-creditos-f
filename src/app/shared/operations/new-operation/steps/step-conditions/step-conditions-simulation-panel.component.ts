import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { SimulateResult } from '../../../../../features/seller/models/credit.model';

@Component({
  selector: 'app-step-conditions-simulation-panel',
  standalone: true,
  imports: [CurrencyArsPipe],
  templateUrl: './step-conditions-simulation-panel.component.html',
})
export class StepConditionsSimulationPanelComponent {
  @Input() form!: FormGroup;
  @Input() simulationResult: SimulateResult | null = null;
  @Input() simulationLoading = false;
  @Input() simulationError: string | null = null;
  @Input() valorCuota = 0;
  @Input() totalADevolver = 0;
  @Input() totalInterestAmount = 0;
  @Input() canContinueWithPlan = false;
  @Input() selectedInstallmentsCount = 0;
  @Output() continueRequested = new EventEmitter<void>();

  /**
   * Etiqueta legible de la frecuencia de pago seleccionada.
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
   * Estado breve de la simulación para el badge de estado.
   */
  getSimulationStatusLabel(): string {
    if (
      this.selectedInstallmentsCount <= 0 ||
      this.valorCuota <= 0 ||
      this.totalADevolver <= 0
    ) {
      return 'Completá los datos para simular';
    }
    if (this.simulationLoading) return 'Calculando simulación';
    if (this.simulationError) return 'Simulación no disponible';
    if (this.simulationResult) return 'Simulación actualizada';
    return 'Lista para simular';
  }

  /**
   * Genera las filas del cronograma. Usa datos reales del backend si existen,
   * o una estimación local si no.
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

    const startDate = this.form.controls['firstPaymentDate']
      ?.value as Date | null;
    if (!startDate || this.selectedInstallmentsCount <= 0) return [];

    const rows = Math.min(this.selectedInstallmentsCount, 8);
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
   * Indica si hay más cuotas que las filas visibles en el cronograma.
   */
  hasHiddenScheduleRows(): boolean {
    return (
      this.selectedInstallmentsCount > this.getSimulationScheduleRows().length
    );
  }

  /**
   * Obtiene la primera fecha de vencimiento del cronograma.
   */
  getFirstSimulationDueDate(): Date | null {
    const firstRow = this.getSimulationScheduleRows()[0];
    return firstRow ? firstRow.dueDate : null;
  }

  /**
   * Mensaje resumen del plan financiado.
   */
  getPlanSummary(): string {
    const installments = this.selectedInstallmentsCount;
    return `${installments} cuota${installments === 1 ? '' : 's'} ${this.getSelectedFrequencyLabel().toLowerCase()} de ${new Intl.NumberFormat(
      'es-AR',
      {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      },
    ).format(this.valorCuota)}`;
  }

  /**
   * Formatea una fecha en formato local corto (dd/mm/yyyy).
   * @param date Fecha a formatear
   */
  getFormattedDate(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Avanza una fecha según la frecuencia seleccionada para el índice de cuota dado.
   * @param baseDate Fecha base del primer vencimiento
   * @param index Posición de la cuota (0-based)
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
}
