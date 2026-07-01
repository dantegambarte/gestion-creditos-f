import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { DateService } from '../../../../../core/services/date.service';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CollectorReportRow } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-collectors-report',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    FormsModule,
    ButtonModule,
    CalendarModule,
    LoadingStateComponent,
    ErrorStateComponent,
    SkeletonModule,
  ],
  templateUrl: './collectors-report.component.html',
})
export class CollectorsReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  collectorsDateFrom: string;
  collectorsDateTo: string;
  collectorsRows: CollectorReportRow[] = [];
  loading = false;
  error: AppError | null = null;
  dateError = '';

  constructor() {
    const { from, to } = this.defaultRange();
    this.collectorsDateFrom = from;
    this.collectorsDateTo = to;
  }

  ngOnInit(): void {
    this.fetchCollectors();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Indica si el rango de fechas seleccionado es válido para la consulta.
   */
  get rangeValid(): boolean {
    return !!(
      this.collectorsDateFrom &&
      this.collectorsDateTo &&
      this.collectorsDateFrom <= this.collectorsDateTo
    );
  }

  /**
   * Valida el rango y dispara la consulta del reporte de cobradores.
   * @returns
   */
  consultCollectors(): void {
    this.dateError = '';
    if (!this.collectorsDateFrom || !this.collectorsDateTo) {
      this.dateError = 'Seleccioná ambas fechas.';
      return;
    }
    if (this.collectorsDateFrom > this.collectorsDateTo) {
      this.dateError =
        'La fecha desde no puede ser posterior a la fecha hasta.';
      return;
    }
    this.collectorsRows = [];
    this.fetchCollectors();
  }

  /**
   * Carga el reporte de cobradores usando el rango de fechas actual.
   * @returns
   */
  private fetchCollectors(): void {
    if (!this.rangeValid) return;
    this.loading = true;
    this.error = null;
    this.service
      .getCollectorsReport({
        dateFrom: this.collectorsDateFrom,
        dateTo: this.collectorsDateTo,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.collectorsRows = r;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /**
   * Calcula el rango predeterminado: últimos 30 días hasta hoy.
   * @returns objeto con fechas ISO `from` y `to`
   */
  private defaultRange(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    return { from: this.toIso(from), to: this.toIso(today) };
  }

  /**
   * Convierte una fecha al formato ISO YYYY-MM-DD.
   * @param d - fecha a convertir
   * @returns cadena en formato ISO
   */
  private toIso(d: Date): string {
    return this.dateSvc.toLocalIso(d);
  }

  /** Formatea un valor numérico como moneda local. */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }

  /**
   * Formatea una tasa porcentual o retorna un guión si es nula.
   * @param rate - valor de tasa o null
   * @returns cadena con porcentaje o '—'
   */
  formatRate(rate: number | null): string {
    return rate == null ? '—' : this.format.number(rate, 2) + '%';
  }
}
