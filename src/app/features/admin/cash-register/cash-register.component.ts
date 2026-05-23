import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
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
import { CurrencyAmountInputDirective } from '../../../shared/directives/currency-amount-input.directive';
import {
  CashRegister,
  CashRegisterClosePayload,
  CashRegisterDashboard,
  CashRegisterDetail,
  CashRegisterFilters,
  CashRegisterPreClose,
  DifferenceStatus,
} from '../models/cash-register.model';
import { CashRegisterService } from './cash-register.service';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextareaModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    CurrencyAmountInputDirective,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './cash-register.component.html',
})
export class CashRegisterComponent implements OnInit, OnDestroy {
  private readonly service = inject(CashRegisterService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
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
  preClose: CashRegisterPreClose | null = null;
  loadingPreClose = false;
  declaredCash: number | null = null;
  observations = '';
  closing = false;
  closePendingError: string | null = null;

  /** Diferencia calculada en tiempo real: efectivo declarado - efectivo esperado. */
  get closeDifference(): number {
    if (this.declaredCash == null || !this.preClose) return 0;
    return this.declaredCash - this.preClose.efectivo.esperado;
  }

  showDetailDialog = false;
  selectedRegister: CashRegisterDetail | null = null;
  loadingDetail = false;

  ngOnInit(): void {
    this.header.set([{ label: 'Caja' }]);
    this.loadDashboard();
    this.loadHistory();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicia el polling para actualizar el dashboard cada minuto. Se detiene automáticamente al destruir el componente.
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
   * Carga los datos del dashboard desde el servidor, mostrando estados de carga y error según corresponda.
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
   * Carga el historial de registros de caja desde el servidor, mostrando estados de carga y error según corresponda.
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
   * Abre el diálogo de cierre cargando el resumen pre-cierre desde el servidor.
   */
  openCloseDialog(): void {
    this.declaredCash = null;
    this.observations = '';
    this.closePendingError = null;
    this.preClose = null;
    this.loadingPreClose = true;
    this.showCloseDialog = true;
    this.service
      .getPreClose()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (pc) => {
          this.preClose = pc;
          this.loadingPreClose = false;
        },
        error: () => {
          this.loadingPreClose = false;
        },
      });
  }

  /**
   * Confirma el cierre de la caja.
   * @param force - Si es true, fuerza el cierre incluso si hay pendientes.
   */
  confirmClose(force = false): void {
    if (this.declaredCash == null) return;
    const payload: CashRegisterClosePayload = {
      declaredCash: this.declaredCash,
    };
    if (this.observations.trim())
      payload.observations = this.observations.trim();
    if (force) payload.force = true;

    this.closing = true;
    this.closePendingError = null;
    this.service
      .close(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.closing = false;
        }),
      )
      .subscribe({
        next: (reg) => {
          this.showCloseDialog = false;
          this.closedToday = true;
          this.history = [reg, ...this.history];
          this.msg.add({
            severity: 'success',
            summary: 'Caja cerrada',
            detail: 'Cierre de caja registrado correctamente.',
            life: 5000,
          });
          this.loadDashboard();
          this.openDetail(reg);
        },
        error: (err: AppError) => {
          if (err.status === 409) {
            const isPendingCredits =
              err.message?.includes('pre-carga') ||
              err.message?.includes('pendiente');
            if (isPendingCredits) {
              this.closePendingError = err.message;
            } else {
              this.closedToday = true;
              this.showCloseDialog = false;
              this.msg.add({
                severity: 'warn',
                summary: 'Caja ya cerrada',
                detail: err.message,
                life: 5000,
              });
            }
          } else {
            this.msg.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message ?? 'No se pudo cerrar la caja.',
              life: 5000,
            });
          }
        },
      });
  }

  /**
   * Abre el diálogo de detalle cargando el breakdown completo desde el servidor.
   * @param reg - El registro de caja de la lista (se usa su id para el fetch).
   */
  openDetail(reg: CashRegister): void {
    this.selectedRegister = null;
    this.loadingDetail = true;
    this.showDetailDialog = true;
    this.service
      .getById(reg.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.selectedRegister = detail;
          this.loadingDetail = false;
        },
        error: () => {
          this.loadingDetail = false;
          this.showDetailDialog = false;
          this.msg.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el detalle.', life: 4000 });
        },
      });
  }

  /**
   * Aplica los filtros seleccionados y recarga el historial de registros.
   */
  applyFilters(): void {
    this.loadHistory();
  }

  /**
   * Limpia los filtros y recarga el historial de registros sin ningún filtro aplicado.
   */
  clearFilters(): void {
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.filterDifferenceStatus = null;
    this.loadHistory();
  }

  /**
   * Devuelve la etiqueta correspondiente al estado de diferencia.
   * @param status
   * @returns
   */
  differenceLabel(status: DifferenceStatus): string {
    return { EXACT: 'Exacta', SURPLUS: 'Sobrante', SHORTAGE: 'Faltante' }[
      status
    ];
  }

  /**
   * Devuelve el severity correspondiente al estado de diferencia.
   * @param status
   * @returns
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
   * @param value
   * @returns
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha en el formato dd/mm/yyyy.
   * @param iso
   * @returns
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  /**
   * Formatea una fecha ISO con hora en el formato dd/mm/yyyy HH:mm.
   * @param iso
   * @returns
   */
  formatDateTime(iso: string): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    return `${date} ${time}`;
  }

  /**
   * Devuelve la etiqueta de método de pago.
   * @param method
   * @returns
   */
  paymentMethodLabel(method: string): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  /**
   * Suma amountReceived de todos los cobros del detalle seleccionado.
   */
  get detailPaymentsTotal(): number {
    return this.selectedRegister?.breakdown.payments.reduce((s, p) => s + p.amountReceived, 0) ?? 0;
  }

  /**
   * Suma amount de todos los enganches del detalle seleccionado.
   */
  get detailDownPaymentsTotal(): number {
    return this.selectedRegister?.breakdown.downPayments.reduce((s, p) => s + p.amount, 0) ?? 0;
  }

  /**
   * Suma amount de todos los gastos del detalle seleccionado.
   */
  get detailExpensesTotal(): number {
    return this.selectedRegister?.breakdown.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;
  }

  /**
   * Suma totalPaid de todas las liquidaciones del detalle seleccionado.
   */
  get detailLiquidationsTotal(): number {
    return this.selectedRegister?.breakdown.liquidations.reduce((s, l) => s + l.totalPaid, 0) ?? 0;
  }
}
