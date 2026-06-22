import { Injectable, inject } from '@angular/core';
import { FormatService } from '../../../../core/services/format.service';

export interface ChartConfig {
  data: object;
  options: object;
}

/**
 * Construye las configuraciones de Chart.js para los gráficos del dashboard admin.
 */
@Injectable({ providedIn: 'root' })
export class DashboardChartsService {
  private readonly fmt = inject(FormatService);

  private readonly TEXT_COLOR = '#9aa6c7';
  private readonly GRID_COLOR = 'rgba(148, 163, 184, 0.12)';

  /**
   * Gráfico de barras de recaudación de la semana actual.
   * @param daily Array de { day: string, total: number } del reporte mensual
   */
  buildWeeklyChart(daily: { day: string; total: number }[]): ChartConfig {
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const daysMap = new Map<string, number>();

    (daily ?? []).forEach((d) => {
      const [year, month, day] = d.day.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const label = dayLabels[date.getDay() === 0 ? 6 : date.getDay() - 1];
      daysMap.set(label, d.total);
    });

    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysToShow = dayOfWeek === 0 ? 6 : dayOfWeek;
    const labels = dayLabels.slice(0, daysToShow);

    return {
      data: {
        labels,
        datasets: [
          {
            label: 'Recaudado',
            data: labels.map((d) => daysMap.get(d) ?? 0),
            backgroundColor: 'rgba(95, 122, 246, 0.58)',
            borderColor: 'rgb(95, 122, 246)',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      },
      options: this.barOptions((v: number) => ` ${this.fmt.currency(v)}`),
    };
  }

  /**
   * Gráfico de barras con el top 5 de cobradores por monto cobrado.
   * @param collectors Array del reporte de cobradores
   */
  buildCollectorsChart(
    collectors: { collectorName: string; totalCollected: number }[],
  ): ChartConfig {
    const top5 = (collectors ?? []).slice(0, 5);
    return {
      data: {
        labels: top5.map(
          (c) => (c.collectorName || 'Sin asignar').split(' ')[0],
        ),
        datasets: [
          {
            label: 'Monto cobrado',
            data: top5.map((c) => c.totalCollected),
            backgroundColor: 'rgba(52, 211, 153, 0.52)',
            borderColor: 'rgb(52, 211, 153)',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      },
      options: this.barOptions((v: number) => this.fmt.currency(v)),
    };
  }

  /**
   * Gráfico de barras con el top 5 de vendedores por monto creado.
   * @param sellers Array del reporte de vendedores
   */
  buildSellersChart(
    sellers: { sellerName: string; totalAmount: number }[],
  ): ChartConfig {
    const top5 = (sellers ?? []).slice(0, 5);
    return {
      data: {
        labels: top5.map((s) => (s.sellerName || 'Sin asignar').split(' ')[0]),
        datasets: [
          {
            label: 'Monto creado',
            data: top5.map((s) => s.totalAmount),
            backgroundColor: 'rgba(251, 176, 64, 0.54)',
            borderColor: 'rgb(251, 176, 64)',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      },
      options: this.barOptions((v: number) => this.fmt.currency(v)),
    };
  }

  private barOptions(tooltipLabel: (v: number) => string): object {
    return {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { bottom: 14, left: 4, right: 4 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              tooltipLabel(ctx.parsed.y),
          },
        },
      },
      scales: {
        x: {
          ticks: { color: this.TEXT_COLOR, font: { size: 11 }, padding: 8 },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: this.TEXT_COLOR,
            font: { size: 11 },
            callback: (v: number) => `$${(v / 1000).toFixed(0)}k`,
          },
          grid: { color: this.GRID_COLOR },
        },
      },
    };
  }
}
