import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { SkeletonModule } from 'primeng/skeleton';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { UpcomingReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-upcoming-report',
  standalone: true,
  imports: [FfBackTopFabComponent,LoadingStateComponent, ErrorStateComponent, SkeletonModule],
  templateUrl: './upcoming-report.component.html',
})
export class UpcomingReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  upcomingReport: UpcomingReport | null = null;
  loading = false;
  error: AppError | null = null;
  upcomingDays = 30;

  readonly upcomingDaysOptions = [
    { label: '7 días', value: 7 },
    { label: '14 días', value: 14 },
    { label: '30 días', value: 30 },
    { label: '60 días', value: 60 },
    { label: '90 días', value: 90 },
  ];

  ngOnInit(): void {
    this.fetchUpcoming();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Actualiza el horizonte de días y vuelve a consultar el reporte.
   */
  consultUpcoming(): void {
    this.upcomingReport = null;
    this.fetchUpcoming();
  }

  /**
   * Carga el reporte de próximos vencimientos para el horizonte de días actual.
   */
  fetchUpcoming(): void {
    this.loading = true;
    this.error = null;
    this.service
      .getUpcomingReport(this.upcomingDays)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.upcomingReport = r;
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

  /** Formatea una fecha ISO como texto corto legible. */
  formatDate(iso: string): string {
    return this.format.shortDate(iso);
  }

  /**
   * Devuelve el nombre abreviado del día de la semana para una fecha ISO.
   * @param iso - fecha en formato YYYY-MM-DD
   * @returns nombre corto del día (ej. "Lun", "Mar")
   */
  getDayName(iso: string): string {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const [y, m, d] = iso.split('-').map(Number);
    return days[new Date(y, m - 1, d).getDay()];
  }

  /**
   * Indica si una fecha ISO corresponde a un fin de semana.
   * @param iso - fecha en formato YYYY-MM-DD
   * @returns true si es sábado o domingo
   */
  isWeekend(iso: string): boolean {
    const [y, m, d] = iso.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 || day === 6;
  }
}
