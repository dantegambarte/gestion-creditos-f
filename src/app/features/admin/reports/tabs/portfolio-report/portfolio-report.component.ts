import { DecimalPipe } from '@angular/common';
import { FfBackTopFabComponent } from './../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { SkeletonModule } from 'primeng/skeleton';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { PortfolioByStatusType, PortfolioReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-portfolio-report',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    DecimalPipe,
    LoadingStateComponent,
    ErrorStateComponent,
    SkeletonModule,
  ],
  templateUrl: './portfolio-report.component.html',
})
export class PortfolioReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  portfolioReport: PortfolioReport | null = null;
  loading = false;
  error: AppError | null = null;

  readonly STATUS_LABELS: Record<string, string | undefined> = {
    PENDING_APPROVAL: 'Pendiente',
    ACTIVE: 'Activo',
    SETTLED: 'Liquidado',
    REJECTED: 'Rechazado',
  };

  readonly STATUS_ORDER = ['ACTIVE', 'SETTLED', 'PENDING_APPROVAL', 'REJECTED'];

  /** Estados que no forman parte de la cartera viva (no suman al total de porcentajes). */
  private readonly CLOSED_STATUSES = ['SETTLED', 'REJECTED'];

  readonly STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#22c55e',
    SETTLED: '#6b7280',
    PENDING_APPROVAL: '#f59e0b',
    REJECTED: '#ef4444',
  };

  readonly TYPE_LABELS: Record<string, string | undefined> = {
    SALE: 'Venta',
    LOAN: 'Préstamo',
  };

  ngOnInit(): void {
    this.fetchPortfolio();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Agrupa las filas del reporte de cartera por estado para renderizado con encabezados de sección.
   */
  get portfolioGrouped(): { status: string; rows: PortfolioByStatusType[] }[] {
    if (!this.portfolioReport) return [];
    const map = new Map<string, PortfolioByStatusType[]>();
    for (const row of this.portfolioReport.byStatusType) {
      if (!map.has(row.status)) map.set(row.status, []);
      map.get(row.status)!.push(row);
    }
    // Estados no listados en STATUS_ORDER se muestran al final en vez de descartarse.
    const known = this.STATUS_ORDER.filter((s) => map.has(s));
    const unknown = [...map.keys()].filter((s) => !this.STATUS_ORDER.includes(s));
    return [...known, ...unknown].map((s) => ({
      status: s,
      rows: map.get(s)!,
    }));
  }

  /**
   * Monto de la cartera viva (excluye créditos liquidados y rechazados), base de
   * los porcentajes: un crédito cerrado o rechazado no forma parte de la cartera.
   */
  get portfolioGrandTotal(): number {
    return (
      this.portfolioReport?.byStatusType
        .filter((r) => !this.CLOSED_STATUSES.includes(r.status))
        .reduce((acc, r) => acc + r.totalAmount, 0) ?? 0
    );
  }

  /**
   * Suma de monto activo tipo Venta para la barra Venta vs Préstamo.
   */
  get activeVentaAmount(): number {
    return (
      this.portfolioReport?.byStatusType
        .filter((r) => r.status === 'ACTIVE' && r.type === 'SALE')
        .reduce((acc, r) => acc + r.totalAmount, 0) ?? 0
    );
  }

  /**
   * Suma de monto activo tipo Préstamo para la barra Venta vs Préstamo.
   */
  get activeLoanAmount(): number {
    return (
      this.portfolioReport?.byStatusType
        .filter((r) => r.status === 'ACTIVE' && r.type === 'LOAN')
        .reduce((acc, r) => acc + r.totalAmount, 0) ?? 0
    );
  }

  /**
   * Carga el reporte de cartera desde el servicio.
   */
  private fetchPortfolio(): void {
    this.loading = true;
    this.error = null;
    this.service
      .getPortfolioReport()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.portfolioReport = r;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }
}
