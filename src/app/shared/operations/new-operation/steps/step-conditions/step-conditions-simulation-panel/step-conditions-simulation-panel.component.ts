import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CurrencyArsPipe } from '../../../../../../core/pipes/currency-ars.pipe';
import { SimulateResult } from '../../../../../../features/seller/models/credit.model';

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
        dueDate: this.parseLocalDate(row.dueDate),
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
   * Parsea un string 'YYYY-MM-DD' como fecha local sin sesgo UTC.
   *
   * `new Date('2026-05-01')` interpreta el string como medianoche UTC, lo
   * que en zonas horarias negativas (ej. AR GMT-3) produce el día anterior
   * al formatearse. El backend ya devuelve YYYY-MM-DD sin TZ; al parsearlo
   * componente a componente garantizamos que el dia visible coincida con
   * el dia que calculó el server.
   */
  private parseLocalDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return new Date(value);
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
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
