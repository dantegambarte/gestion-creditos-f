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
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { finalize } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { FormatService } from '../../../../core/services/format.service';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  CashSessionListItem,
  CashSessionStatus,
} from '../../models/cash-session.model';
import { CashRegisterService } from '../cash-register.service';

/**
 * F2: lista de cajas de la jornada activa con métricas resumidas por turno.
 * Muestra una card por caja con:
 *   · header: id corto · shift_label · ventana horaria · status (tag)
 *   · body: Cobrado · Gastos · Drops · Diferencia (desde summary del backend)
 *   · footer: botón "Ver Snapshot" (re-emite event al padre para que abra
 *             el snapshot-dialog existente).
 *
 * Además expone un resumen de "Drops del día" (cantidad + total) para que
 * F4 (Tesorería) pueda enganchar la misma vista sin retrabajo.
 */
@Component({
  selector: 'app-cash-session-history-list',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    TagModule,
    TooltipModule,
    LoadingStateComponent,
  ],
  templateUrl: './cash-session-history-list.component.html',
})
export class CashSessionHistoryListComponent implements OnChanges {
  /** ID de la jornada a listar. Si cambia, recarga. */
  @Input() businessDayId: string | null = null;
  /** Se incrementa para forzar refresh externo (post abrir/cerrar/drop). */
  @Input() refreshSignal = 0;
  /** Emite el id de la sesión cuando el usuario clickea "Ver Snapshot". */
  @Output() viewSnapshot = new EventEmitter<string>();

  private readonly service = inject(CashRegisterService);
  readonly format = inject(FormatService);

  sessions: CashSessionListItem[] = [];
  loading = false;
  error: AppError | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['businessDayId'] || changes['refreshSignal']) {
      this.load();
    }
  }

  load(): void {
    if (!this.businessDayId) {
      this.sessions = [];
      return;
    }
    this.loading = true;
    this.error = null;
    this.service
      .listSessionsByBusinessDay(this.businessDayId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (rows) => (this.sessions = rows),
        error: (err: AppError) => (this.error = err),
      });
  }

  /** Resumen de drops de la jornada (preparación para F4 Tesorería). */
  get dropsSummary(): { count: number; total: number } {
    let count = 0;
    let total = 0;
    for (const s of this.sessions) {
      if (s.summary && s.summary.drops > 0) {
        // Cada sesión cerrada aporta su delta total de drops. El backend ya
        // suma cash + transfer en summary.drops; acá agregamos a nivel jornada.
        // count "real" de drops por sesión vive en cash_session_drops; por
        // ahora aproximamos con "1 si hubo, 0 si no" — se reemplaza por
        // count exacto cuando F4 traiga el endpoint de drops agregados.
        count += 1;
        total += s.summary.drops;
      }
    }
    return { count, total };
  }

  /** Ventana horaria legible: HH:mm → HH:mm (o "abierta" si sigue OPEN). */
  timeWindow(s: CashSessionListItem): string {
    const open = this.formatTime(s.opened_at);
    if (s.status === 'OPEN' || !s.closed_at) return `${open} → abierta`;
    return `${open} → ${this.formatTime(s.closed_at)}`;
  }

  formatTime(iso: string): string {
    const dt = new Date(iso);
    const h = String(dt.getHours()).padStart(2, '0');
    const m = String(dt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  statusLabel(status: CashSessionStatus): string {
    switch (status) {
      case 'OPEN':                    return 'Abierta';
      case 'PENDING_RECONCILIATION':  return 'Pendiente';
      case 'CLOSED':                  return 'Cerrada';
      default:                        return status;
    }
  }

  statusSeverity(
    status: CashSessionStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'OPEN':                    return 'success';
      case 'PENDING_RECONCILIATION':  return 'warning';
      case 'CLOSED':                  return 'info';
      default:                        return 'info';
    }
  }

  /** Color de la diferencia (verde=0, rojo=negativa, amarillo=positiva). */
  differenceColor(diff: number): string {
    if (diff === 0)  return 'text-green-600';
    if (diff < 0)   return 'text-red-600';
    return 'text-yellow-600';
  }

  onSnapshot(sessionId: string): void {
    this.viewSnapshot.emit(sessionId);
  }
}
