import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { OverdueReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-overdue-report',
  standalone: true,
  imports: [LoadingStateComponent, ErrorStateComponent],
  templateUrl: './overdue-report.component.html',
})
export class OverdueReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  overdueReport: OverdueReport | null = null;
  loading = false;
  error: AppError | null = null;

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

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }
}
