import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { forkJoin, Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { DateService } from '../../../../../core/services/date.service';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CashRegisterService } from '../../../cash-register/cash-register.service';
import {
  BusinessDayDetail,
  BusinessDayListItem,
} from '../../../models/business-day.model';
import {
  CashSessionClosureSnapshot,
  CashSessionDetail,
  CashSessionListItem,
  CashSessionSummary,
  DECLARED_PAYMENT_METHODS,
} from '../../../models/cash-session.model';

/**
 * Reporte histórico de cajas: lista las jornadas del período, permite ver las
 * cajas (turnos) de cada jornada y, dentro de cada caja, el detalle del
 * arqueo de cierre con sus diferencias por método de pago.
 */
@Component({
  selector: 'app-cash-sessions-report',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './cash-sessions-report.component.html',
})
export class CashSessionsReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(CashRegisterService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  dateFrom: string;
  dateTo: string;
  businessDays: BusinessDayListItem[] = [];
  loading = false;
  error: AppError | null = null;
  dateError = '';

  readonly showJornadaDialog = signal(false);
  readonly jornadaDetail = signal<BusinessDayDetail | null>(null);
  readonly jornadaSessions = signal<CashSessionListItem[]>([]);
  readonly loadingJornada = signal(false);
  readonly jornadaError = signal<AppError | null>(null);

  readonly showSessionDialog = signal(false);
  readonly sessionDetail = signal<CashSessionDetail | null>(null);
  readonly loadingSession = signal(false);
  readonly sessionError = signal<AppError | null>(null);

  readonly paymentMethodLabels: Record<string, string> = Object.fromEntries(
    DECLARED_PAYMENT_METHODS.map((m) => [m.value, m.label]),
  );

  constructor() {
    const { from, to } = this.defaultRange();
    this.dateFrom = from;
    this.dateTo = to;
  }

  ngOnInit(): void {
    this.fetch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Indica si el rango de fechas actual es válido para consultar. */
  get rangeValid(): boolean {
    return !!(this.dateFrom && this.dateTo && this.dateFrom <= this.dateTo);
  }

  /** Valida el rango de fechas y dispara la consulta de jornadas. */
  consult(): void {
    this.dateError = '';
    if (!this.rangeValid) {
      this.dateError = 'Verificá el rango de fechas para continuar.';
      return;
    }
    this.fetch();
  }

  /** Carga las jornadas del rango de fechas seleccionado. */
  private fetch(): void {
    if (!this.rangeValid) return;
    this.loading = true;
    this.error = null;
    this.service
      .listBusinessDays({ dateFrom: this.dateFrom, dateTo: this.dateTo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (rows) => {
          this.businessDays = rows;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /** Abre el detalle de una jornada: datos generales + cajas con su resumen. */
  openJornada(businessDay: BusinessDayListItem): void {
    this.showJornadaDialog.set(true);
    this.jornadaDetail.set(null);
    this.jornadaSessions.set([]);
    this.jornadaError.set(null);
    this.loadingJornada.set(true);

    forkJoin({
      detail: this.service.getBusinessDayDetail(businessDay.id),
      sessions: this.service.listSessionsByBusinessDay(businessDay.id),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingJornada.set(false)),
      )
      .subscribe({
        next: ({ detail, sessions }) => {
          this.jornadaDetail.set(detail);
          this.jornadaSessions.set(sessions);
        },
        error: (err: AppError) => {
          this.jornadaError.set(err);
        },
      });
  }

  closeJornadaDialog(): void {
    this.showJornadaDialog.set(false);
  }

  /** Abre el detalle de arqueo de una caja específica. */
  openSession(sessionId: string): void {
    this.showSessionDialog.set(true);
    this.sessionDetail.set(null);
    this.sessionError.set(null);
    this.loadingSession.set(true);

    this.service
      .getSessionDetail(sessionId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingSession.set(false)),
      )
      .subscribe({
        next: (detail) => {
          this.sessionDetail.set(detail);
        },
        error: (err: AppError) => {
          this.sessionError.set(err);
        },
      });
  }

  closeSessionDialog(): void {
    this.showSessionDialog.set(false);
  }

  /** Etiqueta legible del status de jornada. */
  businessDayStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'READY_TO_CLOSE':
        return 'Lista para cerrar';
      case 'CLOSED':
        return 'Cerrada';
      case 'AUDITED':
        return 'Auditada';
      default:
        return status;
    }
  }

  /** Etiqueta legible del status de una caja operativa. */
  sessionStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'PENDING_RECONCILIATION':
        return 'Pendiente de conciliación';
      case 'CLOSED':
        return 'Cerrada';
      default:
        return status;
    }
  }

  /** Tono visual del status de jornada/caja para el badge. */
  statusTone(status: string): 'success' | 'warning' | 'neutral' | 'danger' {
    switch (status) {
      case 'OPEN':
        return 'success';
      case 'READY_TO_CLOSE':
        return 'neutral';
      case 'PENDING_RECONCILIATION':
        return 'warning';
      case 'CLOSED':
        return 'neutral';
      case 'AUDITED':
        return 'success';
      default:
        return 'neutral';
    }
  }

  /**
   * Clases Tailwind del badge de status. Se devuelven como string (en vez de
   * `[class.x/y]`) porque el binding `[class.bg-emerald-500/15]` no es válido:
   * el `/` rompe el parser de templates de Angular.
   */
  statusBadgeClasses(status: string): string {
    switch (this.statusTone(status)) {
      case 'success':
        return 'bg-emerald-500/15 text-emerald-300';
      case 'warning':
        return 'bg-amber-500/15 text-amber-300';
      default:
        return 'bg-gray-500/15 text-gray-300';
    }
  }

  /** Tono visual de la diferencia de cierre. */
  differenceTone(
    status: string | null | undefined,
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'EXACT':
        return 'success';
      case 'SURPLUS':
        return 'warning';
      case 'SHORTAGE':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /** Formatea fecha ISO en formato corto. */
  formatDate(iso: string): string {
    return this.format.shortDate(iso);
  }

  /** Formatea fecha ISO con hora. */
  formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return this.dateSvc.display(iso, 'dd/MM/yyyy HH:mm');
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }

  /** Formatea un valor opcional como moneda, o '—' si es null/undefined. */
  formatCurrencyOrDash(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : this.format.currency(v);
  }

  /**
   * Calcula los totales de cobros/gastos/drops/diferencia a partir del
   * snapshot de cierre persistido, con el mismo shape que `CashSessionSummary`
   * para reutilizar el bloque de tarjetas ya existente.
   */
  closureSummary(snapshot: CashSessionClosureSnapshot): CashSessionSummary {
    const collections =
      snapshot.collections.payments.cash +
      snapshot.collections.payments.transfer +
      snapshot.collections.down_payments.cash +
      snapshot.collections.down_payments.transfer +
      snapshot.collections.manual_incomes.cash +
      snapshot.collections.manual_incomes.transfer;
    const expenses =
      snapshot.outflows.expenses.cash + snapshot.outflows.expenses.transfer;
    const drops = snapshot.drops.cash + snapshot.drops.transfer;
    return {
      collections,
      expenses,
      drops,
      difference: this.sessionDetail()?.closure_total_difference ?? 0,
    };
  }

  /** Identificador corto y legible de un usuario, o '—' si es null. */
  shortId(id: string | null | undefined): string {
    return id ? `#${id.slice(0, 8)}` : '—';
  }

  /** Calcula un rango predeterminado de 30 días hasta hoy. */
  private defaultRange(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    return { from: this.toIso(from), to: this.toIso(today) };
  }

  /** Convierte Date a YYYY-MM-DD. */
  private toIso(d: Date): string {
    return this.dateSvc.toLocalIso(d);
  }
}
