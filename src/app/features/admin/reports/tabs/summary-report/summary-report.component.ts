import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { ReportTab, SummaryReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-summary-report',
  standalone: true,
  imports: [DecimalPipe, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './summary-report.component.html',
})
export class SummaryReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  summaryReport: SummaryReport | null = null;
  loading = false;
  error: AppError | null = null;

  ngOnInit(): void {
    this.fetchSummary();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Navega a la pestaña de próximos vencimientos emitiendo el evento hacia el padre.
   * Workaround: usa un CustomEvent para comunicarse con el padre sin Output.
   */
  goToUpcoming(): void {
    document.dispatchEvent(
      new CustomEvent<ReportTab>('report-tab-change', { detail: 'upcoming' }),
    );
  }

  /**
   * Carga el reporte de resumen del día desde el servicio.
   */
  private fetchSummary(): void {
    this.loading = true;
    this.error = null;
    this.service
      .getSummaryReport()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.summaryReport = r;
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
