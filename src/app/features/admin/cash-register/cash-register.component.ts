import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, interval } from 'rxjs';
import { finalize, switchMap, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import {
  CashRegister,
  CashConversionPayload,
  CashRegisterDashboard,
  CashRegisterFilters,
  DifferenceStatus,
} from '../models/cash-register.model';
import { ActiveBusinessDay } from '../models/business-day.model';
import { CashSession } from '../models/cash-session.model';
import { CashRegisterCloseDialogComponent } from './cash-register-close-dialog/cash-register-close-dialog.component';
import { CashRegisterClosePanelComponent } from './cash-register-close-panel/cash-register-close-panel.component';
import { CashRegisterDetailDialogComponent } from './cash-register-detail-dialog/cash-register-detail-dialog.component';
import { CashSessionOpenDialogComponent } from './cash-session-open-dialog/cash-session-open-dialog.component';
import { CashSessionCloseDialogComponent } from './cash-session-close-dialog/cash-session-close-dialog.component';
import { CashSessionSnapshotDialogComponent } from './cash-session-snapshot-dialog/cash-session-snapshot-dialog.component';
import { CashSessionDropDialogComponent } from './cash-session-drop-dialog/cash-session-drop-dialog.component';
import { CashRegisterService } from './cash-register.service';
import { CurrencyAmountInputDirective } from '../../../shared/directives/currency-amount-input.directive';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    DropdownModule,
    DialogModule,
    InputNumberModule,
    InputTextareaModule,
    TableModule,
    TabViewModule,
    TagModule,
    ToastModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    CashRegisterClosePanelComponent,
    CashRegisterCloseDialogComponent,
    CashRegisterDetailDialogComponent,
    CashSessionOpenDialogComponent,
    CashSessionCloseDialogComponent,
    CashSessionSnapshotDialogComponent,
    CashSessionDropDialogComponent,
    CurrencyAmountInputDirective,
  ],
  providers: [MessageService],
  templateUrl: './cash-register.component.html',
  styleUrl: './cash-register.component.scss',
})
export class CashRegisterComponent implements OnInit, OnDestroy {
  private readonly service = inject(CashRegisterService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private readonly router = inject(Router);
  private destroy$ = new Subject<void>();

  dashboard: CashRegisterDashboard | null = null;
  loadingDashboard = true;
  errorDashboard: AppError | null = null;
  closedToday = false;

  history: CashRegister[] = [];
  loadingHistory = true;
  errorHistory: AppError | null = null;

  filterDateFrom: string | null = null;
  filterDateTo: string | null = null;
  filterDifferenceStatus: DifferenceStatus | null = null;

  readonly differenceStatusOptions = [
    { label: 'Todos los estados', value: null },
    { label: 'Exacta', value: 'EXACT' as DifferenceStatus },
    { label: 'Sobrante', value: 'SURPLUS' as DifferenceStatus },
    { label: 'Faltante', value: 'SHORTAGE' as DifferenceStatus },
  ];

  showCloseDialog = false;
  showInlineClosePanel = false;

  showDetailDialog = false;
  selectedRegisterId: string | null = null;

  showConversionDialog = false;
  conversionSourceMethod: 'CASH' | 'TRANSFER' = 'CASH';
  conversionCriteria: 'DAILY' | 'COMPANY' | null = null;
  conversionAmount: number | null = null;
  conversionNotes = '';
  conversionValidationError = '';
  conversionSubmitting = false;

  readonly conversionCriteriaOptions = [
    { label: 'Caja diaria', value: 'DAILY' as const },
    { label: 'Caja de la empresa', value: 'COMPANY' as const },
  ];

  // ── V4: Jornada + Caja Operativa ─────────────────────────────────────────
  activeBusinessDay: ActiveBusinessDay | null = null;
  activeSession: CashSession | null = null;
  loadingJornada = false;
  errorJornada: AppError | null = null;

  showOpenSessionDialog = false;
  showCloseSessionDialog = false;
  showSnapshotDialog = false;
  showDropDialog = false;
  selectedSessionId: string | null = null;

  /**
   * Indica si la jornada activa pertenece a un día calendario anterior al actual.
   * Ocurre cuando se trabaja pasada la medianoche sin haber cerrado la caja del día anterior.
   */
  get isPostMidnightJornada(): boolean {
    if (!this.dashboard) return false;
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    return this.dashboard.date < today;
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Caja' }]);
    this.loadDashboard();
    this.loadHistory();
    this.loadJornadaState();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicia el polling para actualizar el dashboard cada minuto.
   */
  private startPolling(): void {
    interval(60_000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.service.getDashboard()),
      )
      .subscribe({
        next: (d) => {
          this.dashboard = d;
          this.closedToday = d.isClosed;
        },
      });
  }

  /**
   * Carga los datos del dashboard desde el servidor.
   */
  loadDashboard(): void {
    this.loadingDashboard = true;
    this.errorDashboard = null;
    this.service
      .getDashboard()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingDashboard = false;
        }),
      )
      .subscribe({
        next: (d) => {
          this.dashboard = d;
          this.closedToday = d.isClosed;
        },
        error: (err: AppError) => {
          this.errorDashboard = err;
        },
      });
  }

  /**
   * Carga el historial de registros de caja desde el servidor.
   */
  loadHistory(): void {
    this.loadingHistory = true;
    this.errorHistory = null;
    const filters: CashRegisterFilters = {};
    if (this.filterDateFrom) filters.dateFrom = this.filterDateFrom;
    if (this.filterDateTo) filters.dateTo = this.filterDateTo;
    if (this.filterDifferenceStatus)
      filters.differenceStatus = this.filterDifferenceStatus;
    this.service
      .getAll(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingHistory = false;
        }),
      )
      .subscribe({
        next: (history) => {
          this.history = history;
        },
        error: (err: AppError) => {
          this.errorHistory = err;
        },
      });
  }

  /**
   * Muestra/oculta el panel lateral de cierre.
   */
  toggleInlineClosePanel(): void {
    this.showInlineClosePanel = !this.showInlineClosePanel;
  }

  /**
   * Abre el diálogo modal de cierre de caja.
   */
  openCloseDialog(): void {
    this.showCloseDialog = true;
  }

  /**
   * Callback tras cierre exitoso desde el panel o el dialog.
   * @param reg registro generado por el cierre
   */
  onClosedSuccessfully(reg: CashRegister): void {
    this.closedToday = true;
    this.showInlineClosePanel = false;
    this.history = [reg, ...this.history];
    this.loadDashboard();
    this.openDetail(reg);
  }

  /**
   * Abre el diálogo de detalle para el registro indicado.
   * @param reg registro de caja a ver
   */
  openDetail(reg: CashRegister): void {
    this.selectedRegisterId = reg.id;
    this.showDetailDialog = true;
  }

  /**
   * Abre el modal para registrar una conversión de caja.
   */
  openConversionDialog(): void {
    this.showConversionDialog = true;
    this.conversionSourceMethod = 'CASH';
    this.conversionCriteria = null;
    this.conversionAmount = null;
    this.conversionNotes = '';
    this.conversionValidationError = '';
  }

  /**
   * Selecciona el criterio de conversión.
   * @param criteria criterio de caja a registrar
   */
  selectConversionCriteria(criteria: 'DAILY' | 'COMPANY'): void {
    this.conversionCriteria = criteria;
    this.conversionSourceMethod = 'CASH';
    this.conversionAmount = null;
    this.conversionValidationError = '';
  }

  /**
   * Devuelve el disponible del método origen para validar la conversión.
   */
  get conversionSourceAvailable(): number {
    if (!this.dashboard || !this.conversionCriteria) return 0;
    return this.conversionSourceMethod === 'CASH'
      ? this.dashboard.cashAmount
      : this.dashboard.transferAmount;
  }

  /**
   * Indica si ya se eligió el criterio y se pueden habilitar los demás campos.
   */
  get canEditConversionFields(): boolean {
    return !!this.conversionCriteria;
  }

  /**
   * Valida si el monto ingresado respeta el disponible del método origen.
   */
  get conversionAmountValid(): boolean {
    if (!this.canEditConversionFields) return false;
    if (!this.conversionAmount || this.conversionAmount <= 0) return false;
    return this.conversionAmount <= this.conversionSourceAvailable;
  }

  /**
   * Indica si el monto supera el disponible del método origen.
   */
  get conversionAmountExceedsAvailable(): boolean {
    return !!(
      this.canEditConversionFields &&
      this.conversionAmount &&
      this.conversionAmount > this.conversionSourceAvailable
    );
  }

  /**
   * Devuelve el método de pago destino según el método origen.
   */
  get conversionTargetMethod(): 'CASH' | 'TRANSFER' {
    return this.conversionSourceMethod === 'CASH' ? 'TRANSFER' : 'CASH';
  }

  /**
   * Indica si la conversión está lista para ser enviada.
   */
  get canSubmitConversion(): boolean {
    return !!(
      this.conversionCriteria &&
      this.conversionAmountValid &&
      !this.conversionSubmitting
    );
  }

  /**
   * Registra una conversión entre efectivo y transferencia y actualiza la caja.
   */
  submitConversion(): void {
    this.conversionValidationError = '';
    if (!this.conversionCriteria) {
      this.conversionValidationError =
        'Seleccioná primero el criterio de caja para continuar.';
      return;
    }
    if (!this.conversionAmount || this.conversionAmount <= 0) {
      this.conversionValidationError = 'Ingresá un monto mayor a 0.';
      return;
    }
    if (this.conversionAmount > this.conversionSourceAvailable) {
      this.conversionValidationError = 'El monto supera el disponible del método seleccionado.';
      return;
    }
    if (!this.canSubmitConversion) return;

    const payload: CashConversionPayload = {
      criteria: this.conversionCriteria!,
      sourceMethod: this.conversionSourceMethod,
      amount: this.conversionAmount!,
      notes: this.conversionNotes?.trim() || undefined,
      registerDate: this.dashboard?.date,
    };

    this.conversionSubmitting = true;
    this.service
      .createConversion(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.conversionSubmitting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Conversión registrada',
            detail: 'La conversión se aplicó correctamente en la caja del día.',
          });
          this.showConversionDialog = false;
          this.loadDashboard();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo registrar',
            detail: err.message || 'Ocurrió un error al registrar la conversión.',
          });
        },
      });
  }

  /**
   * Navega a la pestaña de movimientos de conversiones en Reportes.
   */
  goToConversionMovements(): void {
    this.showConversionDialog = false;
    this.router.navigate(['/admin/reports'], {
      queryParams: { tab: 'cashConversions', returnTo: '/admin/cash-register' },
    });
  }

  /**
   * Aplica los filtros seleccionados y recarga el historial.
   */
  applyFilters(): void {
    this.loadHistory();
  }

  /**
   * Limpia los filtros y recarga el historial sin ningún filtro aplicado.
   */
  clearFilters(): void {
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.filterDifferenceStatus = null;
    this.loadHistory();
  }

  /**
   * Devuelve la etiqueta correspondiente al estado de diferencia.
   * @param status estado de diferencia
   */
  differenceLabel(status: DifferenceStatus): string {
    return { EXACT: 'Exacta', SURPLUS: 'Sobrante', SHORTAGE: 'Faltante' }[
      status
    ];
  }

  /**
   * Devuelve el severity de PrimeNG para el estado de diferencia.
   * @param status estado de diferencia
   */
  differenceSeverity(
    status: DifferenceStatus,
  ): 'success' | 'warning' | 'danger' {
    return { EXACT: 'success', SURPLUS: 'warning', SHORTAGE: 'danger' }[
      status
    ] as 'success' | 'warning' | 'danger';
  }

  /**
   * Formatea un valor como moneda.
   * @param value monto a formatear
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha en el formato dd/mm/yyyy.
   * @param iso fecha en formato ISO
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  /**
   * Formatea una fecha ISO con hora en el formato dd/mm/yyyy HH:mm.
   * @param iso fecha con hora en formato ISO
   */
  formatDateTime(iso: string): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }

  /**
   * Devuelve la etiqueta de método de pago.
   * @param method CASH o TRANSFER
   */
  paymentMethodLabel(method: string): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  // ═════════════════════════════════════════════════════════════════════════
  // V4 — Jornada Actual + Caja Operativa
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * V4: carga jornada activa + caja activa en paralelo. Se llama en ngOnInit
   * y después de cada acción (abrir/cerrar caja, drop) para que la UI no
   * quede desincronizada.
   */
  loadJornadaState(): void {
    this.loadingJornada = true;
    this.errorJornada = null;
    this.service
      .refreshJornadaState()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingJornada = false)),
      )
      .subscribe({
        next: ({ businessDay, activeSession }) => {
          this.activeBusinessDay = businessDay;
          this.activeSession = activeSession;
        },
        error: (err: AppError) => {
          this.errorJornada = err;
        },
      });
  }

  // ── Acciones sobre la caja operativa V4 ─────────────────────────────────

  openOpenSessionDialog(): void {
    this.showOpenSessionDialog = true;
  }

  openCloseSessionDialog(): void {
    if (!this.activeSession) return;
    this.selectedSessionId = this.activeSession.id;
    this.showCloseSessionDialog = true;
  }

  openSnapshotDialog(): void {
    if (!this.activeSession) return;
    this.selectedSessionId = this.activeSession.id;
    this.showSnapshotDialog = true;
  }

  openDropDialog(): void {
    if (!this.activeSession) return;
    this.selectedSessionId = this.activeSession.id;
    this.showDropDialog = true;
  }

  /** Callback tras abrir, cerrar o dropear: refresca estado de jornada. */
  onJornadaStateChanged(): void {
    this.loadJornadaState();
  }

  // ── Helpers de UI para Jornada Actual ───────────────────────────────────

  /** Etiqueta legible del status de jornada. */
  businessDayStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':           return 'Abierta';
      case 'READY_TO_CLOSE': return 'Lista para cerrar';
      case 'CLOSED':         return 'Cerrada';
      case 'AUDITED':        return 'Auditada';
      default:               return status;
    }
  }

  /** Severity de PrimeNG-Tag para el status de jornada. */
  businessDayStatusSeverity(
    status: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'OPEN':           return 'success';
      case 'READY_TO_CLOSE': return 'warning';
      case 'CLOSED':         return 'info';
      case 'AUDITED':        return 'secondary';
      default:               return 'info';
    }
  }
}
