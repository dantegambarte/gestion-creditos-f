import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  BusinessDayDetail,
  BusinessDayStatus,
} from '../../models/business-day.model';
import { CashRegisterService } from '../cash-register.service';
import { CashSessionHistoryListComponent } from '../cash-session-history-list/cash-session-history-list.component';
import { CashSessionSnapshotDialogComponent } from '../cash-session-snapshot-dialog/cash-session-snapshot-dialog.component';

/**
 * F3.5: dialog que muestra el detalle de una jornada (típicamente cerrada o
 * auditada). Contiene:
 *   · Header con metadatos: fecha, sucursal, status, timestamps de
 *     apertura/cierre/auditoría, observaciones.
 *   · Conteos de cajas por estado.
 *   · Lista de cajas con métricas resumidas (reusa cash-session-history-list)
 *     y posibilidad de abrir snapshot de cualquier caja cerrada.
 */
@Component({
  selector: 'app-business-day-detail-dialog',
  standalone: true,
  imports: [
    ButtonModule,
    DialogModule,
    TagModule,
    LoadingStateComponent,
    CashSessionHistoryListComponent,
    CashSessionSnapshotDialogComponent,
  ],
  templateUrl: './business-day-detail-dialog.component.html',
})
export class BusinessDayDetailDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() businessDayId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();

  private readonly service = inject(CashRegisterService);

  detail: BusinessDayDetail | null = null;
  loading = false;
  error: AppError | null = null;

  // Snapshot dialog dentro del detalle.
  showSnapshotDialog = false;
  selectedSessionId: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.businessDayId) {
      this.load();
    }
  }

  load(): void {
    if (!this.businessDayId) return;
    this.loading = true;
    this.error = null;
    this.detail = null;
    this.service
      .getBusinessDayDetail(this.businessDayId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (d) => (this.detail = d),
        error: (err: AppError) => (this.error = err),
      });
  }

  onSnapshot(sessionId: string): void {
    this.selectedSessionId = sessionId;
    this.showSnapshotDialog = true;
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  statusLabel(status: BusinessDayStatus): string {
    switch (status) {
      case 'OPEN':           return 'Abierta';
      case 'READY_TO_CLOSE': return 'Lista para cerrar';
      case 'CLOSED':         return 'Cerrada';
      case 'AUDITED':        return 'Auditada';
      default:               return status;
    }
  }

  statusSeverity(
    status: BusinessDayStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'OPEN':           return 'success';
      case 'READY_TO_CLOSE': return 'warning';
      case 'CLOSED':         return 'info';
      case 'AUDITED':        return 'secondary';
      default:               return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }
}
