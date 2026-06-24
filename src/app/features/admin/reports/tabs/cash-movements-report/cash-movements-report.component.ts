import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { SkeletonModule } from 'primeng/skeleton';
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
import {
  CashMovementReport,
  CashMovementReportRow,
  CashMovementType,
  GeneralCashMovementReport,
  GeneralCashMovementType,
} from '../../report.models';
import { ReportsService } from '../../reports.service';

const TYPE_LABELS: Record<CashMovementType, string> = {
  COBRO: 'Cobro',
  ENGANCHE: 'Enganche',
  GASTO: 'Gasto',
  DROP: 'Drop',
  CONVERSION: 'Conversión',
};

const GENERAL_TYPE_LABELS: Record<GeneralCashMovementType, string> = {
  DROP_IN: 'Drop',
  SUPPLIER_PAYMENT: 'Pago a proveedor',
  SALARY_PAYMENT: 'Pago de sueldo',
  EXPENSE: 'Gasto',
  ADJUSTMENT: 'Ajuste',
  MANUAL_INCOME: 'Ingreso manual',
};

const SCOPE_OPTIONS: { label: string; value: 'JORNADA' | 'GENERAL' }[] = [
  { label: 'Caja x Jornada', value: 'JORNADA' },
  { label: 'Caja General', value: 'GENERAL' },
];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  MIXED: 'Mixto',
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
    DialogModule,
    DropdownModule,
    LoadingStateComponent,
    ErrorStateComponent,
    SkeletonModule,
  ],
  templateUrl: './cash-movements-report.component.html',
})
export class CashMovementsReportComponent implements OnInit, OnDestroy {
  private readonly cashRegister = inject(CashRegisterService);
  private readonly reportsService = inject(ReportsService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private destroy$ = new Subject<void>();
  private pendingBusinessDayId: string | null = null;
  private pendingSessionId: string | null = null;

  dateFrom: string;
  dateTo: string;
  dateError = '';

  readonly scopeOptions = SCOPE_OPTIONS;
  scope: 'JORNADA' | 'GENERAL' = 'JORNADA';

  generalReport: GeneralCashMovementReport | null = null;
  loadingGeneralReport = false;
  generalReportError: AppError | null = null;

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
  selectedMovement: CashMovementReportRow | null = null;

  constructor() {
    const { from, to } = this.defaultRange();
    this.dateFrom = from;
    this.dateTo = to;
  }

  ngOnInit(): void {
    this.restoreContextFromQueryParams();
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
      label: this.format.shortDate(bd.business_date),
      value: bd.id,
    }));
  }

  /** Valida el rango de fechas y dispara la búsqueda según el ámbito activo. */
  consult(): void {
    this.dateError = '';
    if (!this.rangeValid) {
      this.dateError = 'Verificá el rango de fechas para continuar.';
      return;
    }
    if (this.scope === 'GENERAL') {
      this.fetchGeneralReport();
    } else {
      this.fetchBusinessDays();
    }
  }

  /** Cambia el ámbito del reporte y limpia el estado del ámbito anterior. */
  onScopeChange(scope: 'JORNADA' | 'GENERAL'): void {
    this.scope = scope;
    this.businessDays = [];
    this.selectedBusinessDayId = null;
    this.sessions = [];
    this.selectedSessionId = null;
    this.report = null;
    this.generalReport = null;
    this.generalReportError = null;
    this.consult();
  }

  /** Etiqueta legible del tipo de movimiento de Caja General. */
  generalTypeLabel(type: GeneralCashMovementType): string {
    return GENERAL_TYPE_LABELS[type] || type;
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
    if (!method) return '—';
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
        return 'bg-[var(--ff-secondary)] text-[var(--ff-text-secondary)]';
    }
  }

  /** Clases del badge de dirección (IN/OUT) para movimientos de Caja General. */
  directionBadgeClasses(direction: 'IN' | 'OUT'): string {
    return direction === 'IN'
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'bg-red-500/15 text-red-300';
  }

  /** Formatea fecha/hora ISO. */
  formatDateTime(iso: string): string {
    return this.dateSvc.display(iso, 'dd/MM/yyyy HH:mm');
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }

  /** Abre el detalle enriquecido de un movimiento de caja. */
  openMovementDetail(row: CashMovementReportRow): void {
    this.selectedMovement = row;
  }

  /** Cierra el detalle del movimiento seleccionado. */
  closeMovementDetail(): void {
    this.selectedMovement = null;
  }

  /** Indica si el movimiento tiene contexto comercial asociado a cliente/crédito. */
  hasCommercialContext(row: CashMovementReportRow): boolean {
    return !!(row.customerName || row.creditId || row.productSummary);
  }

  /** Indica si el movimiento permite navegar a la operación asociada. */
  canOpenOperation(row: CashMovementReportRow): boolean {
    return !!row.creditId;
  }

  /** Navega al detalle de la operación asociada al movimiento seleccionado. */
  openOperation(row: CashMovementReportRow): void {
    if (!row.creditId) return;
    this.closeMovementDetail();
    this.router.navigate(['/admin/operations', row.creditId], {
      queryParams: {
        returnTo: 'admin-reports',
        tab: 'cashMovements',
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
        ...(this.selectedBusinessDayId
          ? { businessDayId: this.selectedBusinessDayId }
          : {}),
        ...(this.selectedSessionId || row.cashSessionId
          ? { cashSessionId: this.selectedSessionId || row.cashSessionId }
          : {}),
      },
    });
  }

  /** Traduce el tipo de crédito a etiqueta visible. */
  creditTypeLabel(type: 'SALE' | 'LOAN' | null): string {
    if (type === 'SALE') return 'Venta';
    if (type === 'LOAN') return 'Préstamo';
    return '—';
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
          const restoredBusinessDayId = this.pendingBusinessDayId;
          this.pendingBusinessDayId = null;
          if (
            restoredBusinessDayId &&
            rows.some((bd) => bd.id === restoredBusinessDayId)
          ) {
            this.onSelectBusinessDay(restoredBusinessDayId);
          }
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
            const restoredSessionId = this.pendingSessionId;
            this.pendingSessionId = null;
            const session =
              rows.find((row) => row.id === restoredSessionId) || rows[0];
            this.selectedSessionId = session.id;
            this.fetchReport(session.id);
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
    this.selectedMovement = null;
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

  /** Carga el reporte de movimientos de Caja General para el rango de fechas. */
  private fetchGeneralReport(): void {
    this.loadingGeneralReport = true;
    this.generalReportError = null;
    this.reportsService
      .getGeneralCashMovementsReport({
        dateFrom: this.dateFrom,
        dateTo: this.dateTo,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingGeneralReport = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.generalReport = r;
        },
        error: (err: AppError) => {
          this.generalReportError = err;
        },
      });
  }

  /** Restaura el rango, la jornada y la caja cuando se vuelve desde una operación. */
  private restoreContextFromQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    const dateFrom = params.get('dateFrom');
    const dateTo = params.get('dateTo');
    if (dateFrom) this.dateFrom = dateFrom;
    if (dateTo) this.dateTo = dateTo;
    this.pendingBusinessDayId = params.get('businessDayId');
    this.pendingSessionId = params.get('cashSessionId');
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
