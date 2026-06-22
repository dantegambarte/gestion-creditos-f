import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { DateService } from '../../../../../core/services/date.service';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { CollectionReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-collection-report',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './collection-report.component.html',
})
export class CollectionReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  collectionDateFrom: string;
  collectionDateTo: string;
  collectionReport: CollectionReport | null = null;
  loading = false;
  error: AppError | null = null;
  dateError = '';

  constructor() {
    const { from, to } = this.defaultRange();
    this.collectionDateFrom = from;
    this.collectionDateTo = to;
  }

  ngOnInit(): void {
    this.fetchCollection();
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
      this.collectionDateFrom &&
      this.collectionDateTo &&
      this.collectionDateFrom <= this.collectionDateTo
    );
  }

  /**
   * Valida el rango y dispara la consulta de recaudación.
   * @returns
   */
  consultCollection(): void {
    this.dateError = '';
    if (!this.collectionDateFrom || !this.collectionDateTo) {
      this.dateError = 'Seleccioná ambas fechas.';
      return;
    }
    if (this.collectionDateFrom > this.collectionDateTo) {
      this.dateError =
        'La fecha desde no puede ser posterior a la fecha hasta.';
      return;
    }
    this.collectionReport = null;
    this.fetchCollection();
  }

  /**
   * Carga el reporte de recaudación usando el rango de fechas actual.
   * @returns
   */
  private fetchCollection(): void {
    if (!this.rangeValid) return;
    this.loading = true;
    this.error = null;
    this.service
      .getCollectionReport({
        dateFrom: this.collectionDateFrom,
        dateTo: this.collectionDateTo,
      })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.collectionReport = r;
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

  /** Formatea una fecha ISO como texto corto legible. */
  formatDate(iso: string): string {
    return this.format.shortDate(iso);
  }
}
