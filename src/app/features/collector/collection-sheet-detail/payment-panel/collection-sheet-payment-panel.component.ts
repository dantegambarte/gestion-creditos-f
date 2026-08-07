import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { InstallmentStatus } from '../../../seller/models/installment.model';
import { CollectionSheetItem, ManagementStatus } from '../../models/collection.model';
import { CollectionAttemptType } from '../../models/collection-attempt.model';
import {
  MANAGEMENT_EVENT_LABELS,
  ManagementEventType,
  ManagementLogEntry,
} from '../../models/management-log.model';

@Component({
  selector: 'app-collection-sheet-payment-panel',
  standalone: true,
  imports: [ButtonModule, CurrencyArsPipe, DatePipe, ProgressSpinnerModule, TagModule],
  templateUrl: './collection-sheet-payment-panel.component.html',
  styleUrl: './collection-sheet-payment-panel.component.scss',
})
export class CollectionSheetPaymentPanelComponent {
  @Input({ required: true }) item!: CollectionSheetItem;
  @Input() canRegisterPayment = false;
  @Input() canRegisterAttempt = false;
  @Input() canVoidTodayAttempt = false;
  /** Habilita "Renovar" (préstamo renovable de una sola cuota). */
  @Input() canRenew = false;
  @Input() logExpanded = false;
  @Input() loadingLog = false;
  @Input() managementLog: ManagementLogEntry[] | null = null;

  @Output() closePanel = new EventEmitter<void>();
  @Output() registerPayment = new EventEmitter<void>();
  @Output() registerRenewal = new EventEmitter<void>();
  @Output() registerAttempt = new EventEmitter<CollectionAttemptType>();
  @Output() voidAttempt = new EventEmitter<void>();
  @Output() toggleLog = new EventEmitter<void>();

  /** Etiqueta compacta para el estado actual de gestión diaria. */
  managementLabel(status: ManagementStatus): string {
    const map: Record<ManagementStatus, string> = {
      PENDING: 'Pendiente',
      VISITED: 'Cobro registrado',
      PAID: 'Cobrada',
      NO_PAYMENT: 'No pagó',
      NOT_FOUND: 'No encontrado',
    };
    return map[status] ?? status;
  }

  /** Etiqueta visible para el estado de la cuota. */
  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      OVERDUE: 'Vencida',
      PAID: 'Pagada',
      PARTIAL: 'Parcial',
    };
    return map[status] ?? status;
  }

  /** Monto vivo de la cuota, usando snapshot como fallback histórico. */
  displayAmountDue(): number {
    return this.item.live?.amountDue ?? this.item.amountDue;
  }

  /** Mora viva acumulada, usando snapshot como fallback histórico. */
  displayPenalty(): number {
    return this.item.live?.penaltyAmount ?? this.item.penaltyAmount;
  }

  /** Monto ya pagado vivo, usando snapshot como fallback histórico. */
  displayAmountPaid(): number {
    return this.item.live?.amountPaid ?? this.item.amountPaid;
  }

  /** Capital de la cuota sin mora. */
  displayCapital(): number {
    return Math.max(0, this.displayAmountDue() - this.displayPenalty());
  }

  /** Saldo disponible a gestionar. */
  availableBalance(): number {
    return Math.max(0, this.displayAmountDue() - this.displayAmountPaid());
  }

  /** True si la cuota seleccionada ya tuvo una gestión diaria. */
  alreadyManagedToday(): boolean {
    return this.item.managementStatus !== 'PENDING';
  }

  /** Devuelve el progreso de cuota en formato X de N si la referencia lo trae. */
  installmentProgress(): string {
    const ref = this.item.collectionReference ?? '';
    const match = ref.match(/cuota\s+(\d+)\s+de\s+(\d+)/i);
    return match ? `${match[1]} de ${match[2]}` : `${this.item.installmentNumber}`;
  }

  /** Etiqueta del tipo de evento del historial. */
  eventTypeLabel(type: ManagementEventType): string {
    return MANAGEMENT_EVENT_LABELS[type];
  }

  /** Severity visual para el tag de evento. */
  eventSeverity(type: ManagementEventType): 'success' | 'warning' | 'secondary' {
    const map: Record<ManagementEventType, 'success' | 'warning' | 'secondary'> = {
      PAYMENT: 'success',
      NO_PAYMENT: 'warning',
      NOT_FOUND: 'secondary',
      SCHEDULED_VISIT: 'secondary',
    };
    return map[type];
  }
}
