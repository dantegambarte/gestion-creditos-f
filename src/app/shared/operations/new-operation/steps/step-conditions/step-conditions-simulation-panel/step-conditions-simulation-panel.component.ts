import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { TooltipModule } from 'primeng/tooltip';
import { CurrencyArsPipe } from '../../../../../../core/pipes/currency-ars.pipe';
import { SimulateResult } from '../../../../../../features/seller/models/credit.model';
import { buildSchedulePreview } from '../../../operation-preview.helper';

@Component({
  selector: 'app-step-conditions-simulation-panel',
  standalone: true,
  imports: [CurrencyArsPipe, TooltipModule],
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
  @Input() advancedInstallmentsCount = 0;
  @Output() continueRequested = new EventEmitter<void>();

  /**
   * Etiqueta legible de la frecuencia de pago seleccionada.
   */
  getSelectedFrequencyLabel(): string {
    const frequency = this.form.controls['paymentFrequency']?.value as
      'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
    if (frequency === 'DAILY') return 'Diaria';
    if (frequency === 'WEEKLY') return 'Semanal';
    if (frequency === 'BIWEEKLY') return 'Quincenal';
    if (frequency === 'MONTHLY') return 'Mensual';
    return 'Sin definir';
  }

  /**
   * Genera las filas del cronograma. Usa datos reales del backend si existen,
   * o una estimación local si no, vía el helper compartido con el resumen.
   */
  getSimulationScheduleRows(): {
    installment: number;
    dueDate: Date;
    amount: number;
    capital?: number;
    interest?: number;
    remainingEstimated: number;
    isAdvanced?: boolean;
  }[] {
    const backendSchedule = this.simulationResult?.schedule ?? [];
    const approvalDate = new Date();
    approvalDate.setHours(0, 0, 0, 0);
    const rows = buildSchedulePreview({
      simulation: this.simulationResult,
      firstPaymentDate: this.form.controls['firstPaymentDate']?.value ?? null,
      frequency: this.form.controls['paymentFrequency']?.value ?? null,
      installmentsCount: this.selectedInstallmentsCount,
      installmentValue: this.valorCuota,
      advancedCount: this.advancedInstallmentsCount ?? 0,
      isAdvanceMode: this.form.controls['initialPaymentType']?.value === 'ADVANCED_INSTALLMENTS',
      approvalDate,
      limit: backendSchedule.length > 0 ? backendSchedule.length : 8,
    });

    return rows.map((row, index) => {
      const backendRow = backendSchedule[index];
      return {
        installment: row.installmentNumber,
        dueDate: row.dueDate,
        amount: row.amount,
        capital: backendRow?.capital,
        interest: backendRow?.interest,
        remainingEstimated: backendRow
          ? (backendRow.remainingEstimated ?? 0)
          : Math.max(0, this.totalADevolver - this.valorCuota * row.installmentNumber),
        isAdvanced: row.isAdvanced,
      };
    });
  }

  /**
   * Indica si hay más cuotas que las filas visibles en el cronograma.
   */
  hasHiddenScheduleRows(): boolean {
    return this.selectedInstallmentsCount > this.getSimulationScheduleRows().length;
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
}
