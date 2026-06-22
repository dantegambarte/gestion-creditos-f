import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { Credit, CreditStatus } from '../../../models/credit.model';

@Component({
  selector: 'app-client-credits-history-panel',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    LoadingStateComponent,
  ],
  templateUrl: './client-credits-history-panel.component.html',
})
export class ClientCreditsHistoryPanelComponent {
  @Input() credits: Credit[] = [];
  @Input() loadingCredits = false;
  /** Emite el ID del crédito cuando el usuario pulsa "Ver". */
  @Output() creditSelected = new EventEmitter<string>();

  /**
   * Devuelve una etiqueta legible para el estado del crédito.
   * @param status Estado técnico del crédito.
   */
  creditStatusLabel(status: CreditStatus): string {
    const map: Record<CreditStatus, string> = {
      PENDING_APPROVAL: 'Pendiente',
      ACTIVE: 'Activo',
      SETTLED: 'Liquidado',
      REJECTED: 'Rechazado',
      EXPIRED: 'Aprobación vencida',
      REFINANCED: 'Refinanciado',
      WRITTEN_OFF: 'Castigado',
    };
    return map[status];
  }

  /**
   * Asigna severidad visual al estado de crédito.
   * @param status Estado técnico del crédito.
   */
  creditStatusSeverity(
    status: CreditStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<
      CreditStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary'
    > = {
      PENDING_APPROVAL: 'warning',
      ACTIVE: 'success',
      SETTLED: 'secondary',
      REJECTED: 'danger',
      EXPIRED: 'danger',
      REFINANCED: 'danger',
      WRITTEN_OFF: 'danger',
    };
    return map[status];
  }

  /**
   * Traduce la frecuencia de pago al formato visible en la tabla.
   * @param frequency Frecuencia técnica del crédito.
   */
  creditFrequencyLabel(frequency: string | null | undefined): string {
    if (!frequency) return '—';
    const map: Record<string, string> = {
      WEEKLY: 'Semanal',
      BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual',
    };
    return map[frequency] ?? frequency;
  }
}
