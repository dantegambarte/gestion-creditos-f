import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
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
import {
  CashRegister,
  CashRegisterClosePayload,
  CashRegisterDashboard,
  CashRegisterFilters,
  DifferenceStatus,
} from '../models/cash-register.model';
import { CashRegisterService } from './cash-register.service';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
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
  declaredCash: number | null = null;
  observations = '';
  closing = false;
  closePendingError: string | null = null;

  showDetailDialog = false;
  selectedRegister: CashRegister | null = null;

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
   * Abre el diálogo para cerrar la caja.
   */
  openCloseDialog(): void {
    this.declaredCash = this.dashboard?.cashAmount ?? 0;
    this.observations = '';
    this.closePendingError = null;
    this.showCloseDialog = true;
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
          this.selectedRegister = reg;
          this.showDetailDialog = true;
          this.loadDashboard();
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
   * Abre el diálogo para ver los detalles de un registro de caja.
   * @param reg - El registro de caja para el cual mostrar detalles.
   */
  openDetail(reg: CashRegister): void {
    this.selectedRegister = reg;
    this.showDetailDialog = true;
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
}
