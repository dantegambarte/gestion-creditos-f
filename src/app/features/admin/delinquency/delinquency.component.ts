import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { Subject } from 'rxjs';
import { catchError, of, takeUntil } from 'rxjs';
import { Installment } from '../../../features/seller/models/installment.model';
import { InstallmentsService } from '../../../features/seller/operations/installments.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import {
  DelinquencyRow,
  DelinquencyStats,
} from '../models/interface/delinquency';

@Component({
  selector: 'app-delinquency',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    SkeletonModule,
    InputTextModule,
    DropdownModule,
    CardModule,
    DialogModule,
    MessageModule,
  ],
  providers: [MessageService],
  templateUrl: './delinquency.component.html',
  styleUrl: './delinquency.component.scss',
})
export class DelinquencyComponent implements OnInit, OnDestroy {
  private readonly installmentsService = inject(InstallmentsService);
  private readonly msg = inject(MessageService);
  private readonly cashRegisterSvc = inject(CashRegisterService);

  stats: DelinquencyStats = { enMoraCount: 0, sinAplicar: 0, aplicada: 0 };
  clients: DelinquencyRow[] = [];
  filteredClients: DelinquencyRow[] = [];
  loadingStats = false;
  loadingClients = true;
  processingId: string | null = null;
  isCashClosed = false;

  searchTerm = '';
  filterEstado: string | null = null;
  filterDias: string | null = null;
  activeStatusFilter: string | null = null;

  showApplyDialog = false;
  applyingRow: DelinquencyRow | null = null;
  applyAmount: number | null = null;

  estadoOptions = [
    { label: 'Todos', value: null },
    { label: 'En Mora', value: 'EN_MORA' },
    { label: 'Sin Aplicar', value: 'SIN_APLICAR' },
  ];

  diasOptions = [
    { label: 'Todos', value: null },
    { label: '1-15 días', value: '1-15' },
    { label: '16-30 días', value: '16-30' },
    { label: 'Más de 30', value: '30+' },
  ];

  statusChips = [
    { label: 'En Mora', value: 'EN_MORA' },
    { label: 'Sin Aplicar', value: 'SIN_APLICAR' },
  ];

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.checkCashRegisterStatus();
    this.loadClients();
  }

  /**
   * Verifica el estado de cierre de caja del día actual.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setea el filtro de estado para la lista de clientes en mora. Si el valor seleccionado es el mismo que el filtro activo, se desactiva el filtro. Luego se aplican los filtros para actualizar la lista mostrada.
   * @param value
   */
  setStatusFilter(value: string): void {
    this.activeStatusFilter = this.activeStatusFilter === value ? null : value;
    this.applyFilters();
  }

  /**
   * Aplica los filtros de búsqueda, estado y días de mora a la lista de clientes en mora. Filtra la lista de clientes según el término de búsqueda (nombre o DNI), el estado seleccionado y el rango de días de mora, actualizando la lista de clientes mostrada en consecuencia.
   */
  applyFilters(): void {
    let result = [...this.clients];

    const term = this.searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (c) =>
          c.clientName.toLowerCase().includes(term) || c.dni.includes(term),
      );
    }

    const status = this.activeStatusFilter ?? this.filterEstado;
    if (status) {
      result = result.filter((c) => c.status === status);
    }

    if (this.filterDias) {
      result = result.filter((c) => {
        if (this.filterDias === '1-15')
          return c.daysOverdue >= 1 && c.daysOverdue <= 15;
        if (this.filterDias === '16-30')
          return c.daysOverdue >= 16 && c.daysOverdue <= 30;
        if (this.filterDias === '30+') return c.daysOverdue > 30;
        return true;
      });
    }

    this.filteredClients = result;
  }

  /**
   * Notifica al cliente sobre su situación de mora.
   * @param row
   * @returns
   */
  onNotify(row: DelinquencyRow): void {
    if (this.processingId) return;
    this.processingId = `${row.id}_notify`;
    setTimeout(() => {
      this.processingId = null;
      this.msg.add({
        severity: 'info',
        summary: 'Aviso enviado',
        detail: row.clientName,
        life: 3000,
      });
    }, 800);
  }

  /**
   * Abre el diálogo para aplicar mora a un cliente.
   * @param row
   * @returns
   */
  onApply(row: DelinquencyRow): void {
    if (this.processingId) return;
    this.applyingRow = row;
    this.applyAmount = null;
    this.showApplyDialog = true;
  }

  /**
   * Confirma la aplicación de mora a un cliente.
   * @returns
   */
  confirmApply(): void {
    if (!this.applyingRow || !this.applyAmount || this.applyAmount <= 0) return;

    this.processingId = `${this.applyingRow.id}_apply`;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;

        if (this.isCashClosed) {
          this.processingId = null;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes aplicar mora. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        this.processApplyPenalty();
      });
  }

  private processApplyPenalty(): void {
    if (!this.applyingRow || !this.applyAmount) return;

    const row = this.applyingRow;
    this.installmentsService
      .applyPenalty(row.id, { penaltyAmount: this.applyAmount })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.processingId = null;
          this.showApplyDialog = false;
          this.updateClientPenalty(
            row.id,
            updated.penaltyAmount ?? this.applyAmount!,
          );
          this.msg.add({
            severity: 'warning',
            summary: 'Mora aplicada',
            detail: row.clientName,
            life: 3000,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingId = null;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo aplicar mora.',
          });
        },
      });
  }

  /**
   * Condonar mora para un cliente.
   * @param row
   * @returns
   */
  onCondone(row: DelinquencyRow): void {
    if (this.processingId) return;

    this.processingId = `${row.id}_condone`;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;

        if (this.isCashClosed) {
          this.processingId = null;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes condonar mora. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        this.processWaivePenalty(row);
      });
  }

  private processWaivePenalty(row: DelinquencyRow): void {
    this.installmentsService
      .waivePenalty(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.updateClientPenalty(row.id, 0);
          this.processingId = null;
          this.msg.add({
            severity: 'success',
            summary: 'Mora condonada',
            detail: row.clientName,
            life: 3000,
          });
        },
        error: (err: { status?: number; message?: string }) => {
          this.processingId = null;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo condonar mora.',
          });
        },
      });
  }

  /**
   * Devuelve la etiqueta del estado de una operación reciente.
   * @param status
   * @returns
   */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      EN_MORA: 'En mora',
      SIN_APLICAR: 'Sin aplicar',
    };
    return map[status] ?? status;
  }

  /**
   * Devuelve la severidad del estado de una operación reciente.
   * @param status
   * @returns
   */
  statusSeverity(
    status: string,
  ):
    | 'success'
    | 'info'
    | 'warning'
    | 'danger'
    | 'secondary'
    | 'contrast'
    | undefined {
    const map: Record<
      string,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      EN_MORA: 'danger',
      SIN_APLICAR: 'secondary',
    };
    return map[status];
  }

  /**
   *
   */
  private loadClients(): void {
    this.loadingClients = true;
    this.installmentsService
      .list({ status: 'OVERDUE' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (installments) => {
          const rows = installments.map((inst) => this.toRow(inst));
          this.clients = rows;
          this.filteredClients = rows;
          this.stats = this.calcStats(rows);
          this.loadingClients = false;
        },
        error: () => {
          this.loadingClients = false;
        },
      });
  }

  /**
   * Convierte un recibo en una fila de mora.
   * @param inst
   * @returns
   */
  private toRow(inst: Installment): DelinquencyRow {
    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - new Date(inst.dueDate).getTime()) / 86_400_000),
    );
    return {
      id: inst.id,
      clientName: inst.customerName,
      dni: inst.customerDni,
      installmentNumber: inst.installmentNumber,
      amount: inst.amountDue,
      daysOverdue,
      delinquencyAmount: inst.penaltyAmount,
      status: inst.penaltyAmount > 0 ? 'EN_MORA' : 'SIN_APLICAR',
      collectorName: inst.collectorName,
    };
  }

  /**
   * Calcula las estadísticas de mora para un conjunto de filas.
   * @param rows
   * @returns
   */
  private calcStats(rows: DelinquencyRow[]): DelinquencyStats {
    return {
      enMoraCount: rows.length,
      sinAplicar: rows
        .filter((r) => r.delinquencyAmount === 0)
        .reduce((s, r) => s + r.amount, 0),
      aplicada: rows
        .filter((r) => r.delinquencyAmount > 0)
        .reduce((s, r) => s + r.delinquencyAmount, 0),
    };
  }

  /**
   * Actualiza el monto de penalidad de un cliente.
   * @param id
   * @param penaltyAmount
   */
  private updateClientPenalty(id: string, penaltyAmount: number): void {
    const idx = this.clients.findIndex((c) => c.id === id);
    if (idx > -1) {
      this.clients[idx] = {
        ...this.clients[idx],
        delinquencyAmount: penaltyAmount,
        status: penaltyAmount > 0 ? 'EN_MORA' : 'SIN_APLICAR',
      };
      this.stats = this.calcStats(this.clients);
      this.applyFilters();
    }
  }
}
