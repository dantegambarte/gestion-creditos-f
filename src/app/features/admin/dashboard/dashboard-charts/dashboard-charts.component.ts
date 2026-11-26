import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject } from 'rxjs';
import { combineLatest, takeUntil } from 'rxjs';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { ReportsService } from '../../reports/reports.service';
import { ChartConfig, DashboardChartsService } from '../services/dashboard-charts.service';

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [ChartModule, SkeletonModule, ErrorStateComponent],
  templateUrl: './dashboard-charts.component.html',
})
export class DashboardChartsComponent implements OnChanges, OnDestroy {
  /**
   * Datos de recaudación diaria del mes. Cuando llega (no null), dispara la carga de gráficos.
   * El padre lo pasa una vez que terminan de cargar los KPIs.
   */
  @Input() monthlyDailyData: { day: string; total: number }[] | null = null;

  loadingCharts = true;
  /** True cuando falló la carga de reportes: se muestra error con reintento en vez de gráficos vacíos. */
  errorCharts = false;
  chartWeeklyData?: ChartConfig['data'];
  chartWeeklyOptions?: ChartConfig['options'];
  chartCollectorsData: ChartConfig['data'] = { labels: [], datasets: [] };
  chartCollectorsOptions?: ChartConfig['options'];
  chartSellersData: ChartConfig['data'] = { labels: [], datasets: [] };
  chartSellersOptions?: ChartConfig['options'];

  private readonly reportsSvc = inject(ReportsService);
  private readonly chartsSvc = inject(DashboardChartsService);
  private destroy$ = new Subject<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['monthlyDailyData'] && this.monthlyDailyData !== null) {
      this.loadCharts();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga los datos de cobradores y vendedores y construye los tres gráficos.
   * Si algún reporte falla, muestra el estado de error con reintento en lugar de gráficos vacíos.
   */
  loadCharts(): void {
    this.loadingCharts = true;
    this.errorCharts = false;

    const toLocalDateString = (date: Date): string => {
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return localDate.toISOString().split('T')[0];
    };

    const today = new Date();
    const todayDate = toLocalDateString(today);
    const firstOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));

    combineLatest([
      this.reportsSvc.getCollectorsReport({ dateFrom: todayDate, dateTo: todayDate }, true),
      this.reportsSvc.getSellersReport({ dateFrom: firstOfMonth, dateTo: todayDate }, true),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([collectors, sellers]) => {
          this.buildWeeklyChart(this.monthlyDailyData ?? []);
          this.buildCollectorsChart(Array.isArray(collectors) ? collectors : []);
          this.buildSellersChart(Array.isArray(sellers) ? sellers : []);
          this.loadingCharts = false;
        },
        error: () => {
          this.errorCharts = true;
          this.loadingCharts = false;
        },
      });
  }

  private buildWeeklyChart(daily: { day: string; total: number }[]): void {
    const config = this.chartsSvc.buildWeeklyChart(daily);
    this.chartWeeklyData = config.data;
    this.chartWeeklyOptions = config.options;
  }

  private buildCollectorsChart(
    collectors: { collectorName: string; totalCollected: number }[],
  ): void {
    const config = this.chartsSvc.buildCollectorsChart(collectors);
    this.chartCollectorsData = config.data;
    this.chartCollectorsOptions = config.options;
  }

  private buildSellersChart(sellers: { sellerName: string; totalAmount: number }[]): void {
    const config = this.chartsSvc.buildSellersChart(sellers);
    this.chartSellersData = config.data;
    this.chartSellersOptions = config.options;
  }
}
