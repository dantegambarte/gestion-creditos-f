import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject, catchError, of, takeUntil } from 'rxjs';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { Installment } from '../../../features/seller/models/installment.model';
import { InstallmentsService } from '../../../features/seller/operations/installments.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import {
  DelinquencyRow,
  DelinquencyStats,
} from '../models/interface/delinquency';
import { DelinquencyApplyDialogComponent } from './delinquency-apply-dialog.component';

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
    MessageModule,
    DelinquencyApplyDialogComponent,
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
   * Alterna el filtro de estado chip. Si el valor ya está activo, lo desactiva.
   * @param value Valor del chip seleccionado.
   */
  setStatusFilter(value: string): void {
    this.activeStatusFilter = this.activeStatusFilter === value ? null : value;
    this.applyFilters();
  }

  /**
   * Aplica los filtros de búsqueda, estado y días de mora sobre la lista de clientes.
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
   * Simula el envío de aviso al cliente en mora.
   * @param row Fila del cliente a notificar.
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
   * @param row Fila del cliente sobre la que se aplica mora.
   */
  onApply(row: DelinquencyRow): void {
    if (this.processingId) return;
    this.applyingRow = row;
    this.showApplyDialog = true;
  }

  /**
   * Actualiza la lista tras una mora aplicada exitosamente desde el diálogo hijo.
   * @param param0 ID de la cuota y monto de mora aplicado.
   */
  onPenaltyApplied({ id, amount }: { id: string; amount: number }): void {
    this.updateClientPenalty(id, amount);
  }

  /**
   * Condona la mora de un cliente tras verificar que la caja esté abierta.
   * @param row Fila del cliente a condonar.
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

  /**
   * Llama al servicio para condonar la mora de la cuota.
   * @param row Fila del cliente a condonar.
   */
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
   * Devuelve la etiqueta legible para el estado de mora.
   * @param status Estado técnico de la fila.
   */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      EN_MORA: 'En mora',
      SIN_APLICAR: 'Sin aplicar',
    };
    return map[status] ?? status;
  }

  /**
   * Devuelve la severidad visual para el estado de mora.
   * @param status Estado técnico de la fila.
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
   * Carga las cuotas vencidas desde el backend y las mapea a filas de mora.
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
   * Convierte una cuota vencida en una fila de mora con días calculados.
   * @param inst Cuota de la API.
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
   * Calcula las estadísticas de mora para el conjunto de filas dado.
   * @param rows Filas de mora a resumir.
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
   * Actualiza el estado de penalidad de un cliente en la lista local y recalcula stats y filtros.
   * @param id ID de la cuota.
   * @param penaltyAmount Nuevo monto de mora (0 para condonado).
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
