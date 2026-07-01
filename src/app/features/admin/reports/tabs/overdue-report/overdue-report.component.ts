import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { SkeletonModule } from 'primeng/skeleton';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { FfBackTopFabComponent } from '../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { OverdueByCustomer, OverdueReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

type OverdueDaysFilter = 'all' | '31' | '61' | '91' | '121';
type OverdueAmountFilter = 'all' | '500000' | '1000000';
type OverdueSortKey = 'customerName' | 'overdueCount' | 'totalOverdue' | 'maxDaysOverdue';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-overdue-report',
  standalone: true,
  imports: [FormsModule, LoadingStateComponent, ErrorStateComponent, SkeletonModule, FfBackTopFabComponent],
  templateUrl: './overdue-report.component.html',
})
export class OverdueReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  overdueReport: OverdueReport | null = null;
  loading = false;
  error: AppError | null = null;
  searchTerm = '';
  daysFilter: OverdueDaysFilter = 'all';
  amountFilter: OverdueAmountFilter = 'all';
  sortKey: OverdueSortKey = 'maxDaysOverdue';
  sortDirection: SortDirection = 'desc';

  ngOnInit(): void {
    this.fetchOverdue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga el reporte de mora desde el servicio.
   */
  private fetchOverdue(): void {
    this.loading = true;
    this.error = null;
    this.service
      .getOverdueReport()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.overdueReport = r;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /**
   * Devuelve los clientes visibles aplicando búsqueda, filtros operativos y ordenamiento.
   */
  get filteredRows(): OverdueByCustomer[] {
    const rows = this.overdueReport?.byCustomer ?? [];
    const query = this.normalize(this.searchTerm);
    const minDays = this.daysFilter === 'all' ? null : Number(this.daysFilter);
    const minAmount = this.amountFilter === 'all' ? null : Number(this.amountFilter);

    return rows
      .filter((row) => {
        const matchesSearch =
          query.length === 0 ||
          this.normalize(`${row.customerName} ${row.phone ?? ''}`).includes(query);
        const matchesDays = minDays == null || row.maxDaysOverdue >= minDays;
        const matchesAmount = minAmount == null || row.totalOverdue >= minAmount;

        return matchesSearch && matchesDays && matchesAmount;
      })
      .sort((a, b) => this.compareRows(a, b));
  }

  /**
   * Indica si hay algún criterio aplicado para mostrar acciones contextuales.
   */
  get hasActiveFilters(): boolean {
    return (
      this.searchTerm.trim().length > 0 ||
      this.daysFilter !== 'all' ||
      this.amountFilter !== 'all'
    );
  }

  /**
   * Alterna el ordenamiento de la tabla/cards por una columna operativa.
   */
  setSort(key: OverdueSortKey): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      return;
    }

    this.sortKey = key;
    this.sortDirection = key === 'customerName' ? 'asc' : 'desc';
  }

  /**
   * Limpia búsqueda y filtros sin tocar el ordenamiento elegido.
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.daysFilter = 'all';
    this.amountFilter = 'all';
  }

  /**
   * Normaliza texto para búsquedas tolerantes a mayúsculas y acentos.
   */
  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Compara filas según la columna activa y la dirección seleccionada.
   */
  private compareRows(a: OverdueByCustomer, b: OverdueByCustomer): number {
    const direction = this.sortDirection === 'asc' ? 1 : -1;

    if (this.sortKey === 'customerName') {
      return a.customerName.localeCompare(b.customerName) * direction;
    }

    return (a[this.sortKey] - b[this.sortKey]) * direction;
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }
}
