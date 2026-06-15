import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { DateService } from '../../../../../core/services/date.service';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CashRegisterService } from '../../../cash-register/cash-register.service';
import { BusinessDayListItem } from '../../../models/business-day.model';
import { CashSessionListItem } from '../../../models/cash-session.model';
import { CashMovementReport, CashMovementType } from '../../report.models';
import { ReportsService } from '../../reports.service';

const TYPE_LABELS: Record<CashMovementType, string> = {
  COBRO: 'Cobro',
  ENGANCHE: 'Enganche',
  GASTO: 'Gasto',
  DROP: 'Drop',
  CONVERSION: 'Conversión',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CASH_TRANSFER: 'Efectivo → Transferencia',
  TRANSFER_CASH: 'Transferencia → Efectivo',
};

/**
 * Reporte de movimientos de caja: a partir de la jornada seleccionada,
 * lista cobros, enganches, gastos, drops y conversiones imputados a la
 * caja operativa de esa jornada (una caja por jornada).
 */
@Component({
  selector: 'app-cash-movements-report',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './cash-movements-report.component.html',
})
export class CashMovementsReportComponent implements OnInit, OnDestroy {
  private readonly cashRegister = inject(CashRegisterService);
  private readonly reportsService = inject(ReportsService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  dateFrom: string;
  dateTo: string;
  dateError = '';

  businessDays: BusinessDayListItem[] = [];
  selectedBusinessDayId: string | null = null;
  loadingDays = false;
  daysError: AppError | null = null;

  sessions: CashSessionListItem[] = [];
  selectedSessionId: string | null = null;
  loadingSessions = false;
  sessionsError: AppError | null = null;

  report: CashMovementReport | null = null;
  loadingReport = false;
  reportError: AppError | null = null;

  constructor() {
    const { from, to } = this.defaultRange();
    this.dateFrom = from;
    this.dateTo = to;
  }

  ngOnInit(): void {
    this.consult();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Indica si el rango de fechas actual es válido para consultar jornadas. */
  get rangeValid(): boolean {
    return !!(this.dateFrom && this.dateTo && this.dateFrom <= this.dateTo);
  }

  /** Opciones del dropdown de jornadas. */
  get businessDayOptions(): { label: string; value: string }[] {
    return this.businessDays.map((bd) => ({
      label: `${this.format.shortDate(bd.business_date)} · ${bd.branch_name || 'Empresa'}`,
      value: bd.id,
    }));
  }

  /** Valida el rango de fechas y dispara la búsqueda de jornadas. */
  consult(): void {
    this.dateError = '';
    if (!this.rangeValid) {
      this.dateError = 'Verificá el rango de fechas para continuar.';
      return;
    }
    this.fetchBusinessDays();
  }

  /** Maneja la selección de jornada: carga la caja de esa jornada y su reporte. */
  onSelectBusinessDay(businessDayId: string | null): void {
    this.selectedBusinessDayId = businessDayId;
    this.sessions = [];
    this.selectedSessionId = null;
    this.report = null;
    this.reportError = null;
    this.sessionsError = null;
    if (!businessDayId) return;
    this.fetchSessions(businessDayId);
  }

  /** Etiqueta legible del tipo de movimiento. */
  typeLabel(type: CashMovementType): string {
    return TYPE_LABELS[type] || type;
  }

  /** Etiqueta legible del método de pago (incluye combinaciones de conversión). */
  methodLabel(method: string): string {
    return METHOD_LABELS[method] || method;
  }

  /** Clases del badge de tipo de movimiento. */
  typeBadgeClasses(type: CashMovementType): string {
    switch (type) {
      case 'COBRO':
      case 'ENGANCHE':
        return 'bg-emerald-500/15 text-emerald-300';
      case 'GASTO':
        return 'bg-red-500/15 text-red-300';
      case 'DROP':
        return 'bg-amber-500/15 text-amber-300';
      default:
        return 'bg-gray-500/15 text-gray-300';
    }
  }

  /** Formatea fecha/hora ISO. */
  formatDateTime(iso: string): string {
    return this.dateSvc.display(iso, 'dd/MM/yyyy HH:mm');
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }

  /** Carga las jornadas del rango de fechas seleccionado. */
  private fetchBusinessDays(): void {
    this.loadingDays = true;
    this.daysError = null;
    this.businessDays = [];
    this.selectedBusinessDayId = null;
    this.sessions = [];
    this.selectedSessionId = null;
    this.report = null;
    this.cashRegister
      .listBusinessDays({ dateFrom: this.dateFrom, dateTo: this.dateTo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingDays = false;
        }),
      )
      .subscribe({
        next: (rows) => {
          this.businessDays = rows;
        },
        error: (err: AppError) => {
          this.daysError = err;
        },
      });
  }

  /** Carga la caja de la jornada seleccionada y dispara su reporte de movimientos. */
  private fetchSessions(businessDayId: string): void {
    this.loadingSessions = true;
    this.sessionsError = null;
    this.cashRegister
      .listSessionsByBusinessDay(businessDayId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingSessions = false;
        }),
      )
      .subscribe({
        next: (rows) => {
          this.sessions = rows;
          if (rows.length > 0) {
            this.selectedSessionId = rows[0].id;
            this.fetchReport(rows[0].id);
          }
        },
        error: (err: AppError) => {
          this.sessionsError = err;
        },
      });
  }

  /** Carga el reporte de movimientos de la caja seleccionada. */
  private fetchReport(sessionId: string): void {
    this.loadingReport = true;
    this.reportError = null;
    this.reportsService
      .getCashMovementsReport(sessionId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingReport = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.report = r;
        },
        error: (err: AppError) => {
          this.reportError = err;
        },
      });
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
