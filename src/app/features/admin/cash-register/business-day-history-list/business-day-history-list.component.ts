import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { finalize } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  BusinessDayFilters,
  BusinessDayListItem,
  BusinessDayStatus,
} from '../../models/business-day.model';
import { CashRegisterService } from '../cash-register.service';

/**
 * F3.5: tab "Histórico Jornadas". Tabla paginada de business_days con
 * filtros (status, rango de fechas). Click sobre una fila emite el id de
 * la jornada — el padre abre el dialog de detalle.
 *
 * Por default carga jornadas CLOSED (caso operativo más frecuente:
 * consultar jornadas terminadas). El usuario puede cambiar a cualquier
 * status.
 */
@Component({
  selector: 'app-business-day-history-list',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    TableModule,
    TagModule,
    LoadingStateComponent,
  ],
  templateUrl: './business-day-history-list.component.html',
})
export class BusinessDayHistoryListComponent implements OnInit {
  @Output() viewDetail = new EventEmitter<string>();

  private readonly service = inject(CashRegisterService);

  readonly statusOptions: Array<{ label: string; value: BusinessDayStatus | null }> = [
    { label: 'Todas',                value: null },
    { label: 'Abierta',              value: 'OPEN' },
    { label: 'Lista para cerrar',    value: 'READY_TO_CLOSE' },
    { label: 'Cerrada',              value: 'CLOSED' },
    { label: 'Auditada',             value: 'AUDITED' },
  ];

  // Filtros por default: jornadas CLOSED del último mes.
  filterStatus: BusinessDayStatus | null = 'CLOSED';
  filterDateFrom: Date | null = null;
  filterDateTo: Date | null = null;

  rows: BusinessDayListItem[] = [];
  loading = false;
  error: AppError | null = null;

  ngOnInit(): void {
    // Default: último mes.
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    this.filterDateFrom = monthAgo;
    this.filterDateTo = today;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    const filters: BusinessDayFilters = {};
    if (this.filterStatus) filters.status = this.filterStatus;
    if (this.filterDateFrom) filters.dateFrom = this.toIsoDate(this.filterDateFrom);
    if (this.filterDateTo)   filters.dateTo   = this.toIsoDate(this.filterDateTo);

    this.service
      .listBusinessDays(filters)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (rows) => (this.rows = rows),
        error: (err: AppError) => (this.error = err),
      });
  }

  clearFilters(): void {
    this.filterStatus = null;
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.load();
  }

  onRowClick(row: BusinessDayListItem): void {
    this.viewDetail.emit(row.id);
  }

  statusLabel(status: BusinessDayStatus): string {
    switch (status) {
      case 'OPEN':           return 'Abierta';
      case 'READY_TO_CLOSE': return 'Lista para cerrar';
      case 'CLOSED':         return 'Cerrada';
      case 'AUDITED':        return 'Auditada';
      default:               return status;
    }
  }

  statusSeverity(
    status: BusinessDayStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    switch (status) {
      case 'OPEN':           return 'success';
      case 'READY_TO_CLOSE': return 'warning';
      case 'CLOSED':         return 'info';
      case 'AUDITED':        return 'secondary';
      default:               return 'info';
    }
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  formatDateTime(iso?: string | null): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
