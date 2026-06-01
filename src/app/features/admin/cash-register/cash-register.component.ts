import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
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
import {
  CashRegister,
  CashRegisterDashboard,
  CashRegisterFilters,
  DifferenceStatus,
} from '../models/cash-register.model';
import { CashRegisterCloseDialogComponent } from './components/cash-register-close-dialog/cash-register-close-dialog.component';
import { CashRegisterClosePanelComponent } from './components/cash-register-close-panel/cash-register-close-panel.component';
import { CashRegisterDetailDialogComponent } from './components/cash-register-detail-dialog/cash-register-detail-dialog.component';
import { CashRegisterService } from './cash-register.service';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    DropdownModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    CashRegisterClosePanelComponent,
    CashRegisterCloseDialogComponent,
    CashRegisterDetailDialogComponent,
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
  showInlineClosePanel = false;

  showDetailDialog = false;
  selectedRegisterId: string | null = null;

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
}
