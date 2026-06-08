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
import { CashConversionReport } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-cash-conversions-report',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './cash-conversions-report.component.html',
})
export class CashConversionsReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private readonly dateSvc = inject(DateService);
  private destroy$ = new Subject<void>();

  dateFrom: string;
  dateTo: string;
  report: CashConversionReport | null = null;
  loading = false;
  error: AppError | null = null;
  dateError = '';

  constructor() {
    const { from, to } = this.defaultRange();
    this.dateFrom = from;
    this.dateTo = to;
  }

  ngOnInit(): void {
    this.fetch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Indica si el rango de fechas actual es válido para consultar.
   */
  get rangeValid(): boolean {
    return !!(this.dateFrom && this.dateTo && this.dateFrom <= this.dateTo);
  }

  /**
   * Valida el rango de fechas y dispara la consulta del reporte.
   */
  consult(): void {
    this.dateError = '';
    if (!this.rangeValid) {
      this.dateError = 'Verificá el rango de fechas para continuar.';
      return;
    }
    this.fetch();
  }

  /**
   * Devuelve la etiqueta legible del criterio de caja.
   * @param criteria criterio persistido en backend
   */
  criteriaLabel(criteria: 'DAILY' | 'COMPANY'): string {
    return criteria === 'DAILY' ? 'Caja diaria' : 'Caja de la empresa';
  }

  /**
   * Devuelve la etiqueta legible de método de pago.
   * @param method método persistido en backend
   */
  methodLabel(method: 'CASH' | 'TRANSFER'): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  /**
   * Formatea un valor numérico como moneda local.
   */
  formatCurrency(v: number): string {
    return this.format.currency(v);
  }

  /**
   * Formatea fecha ISO en formato corto.
   */
  formatDate(iso: string): string {
    return this.format.shortDate(iso);
  }

  /**
   * Carga el reporte de conversiones con el rango de fechas actual.
   */
  private fetch(): void {
    if (!this.rangeValid) return;
    this.loading = true;
    this.error = null;
    this.service
      .getCashConversionsReport({ dateFrom: this.dateFrom, dateTo: this.dateTo })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.report = r;
        },
        error: (err: AppError) => {
          this.error = err;
        },
      });
  }

  /**
   * Calcula un rango predeterminado de 30 días hasta hoy.
   */
  private defaultRange(): { from: string; to: string } {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 30);
    return { from: this.toIso(from), to: this.toIso(today) };
  }

  /**
   * Convierte Date a YYYY-MM-DD.
   * @param d fecha a convertir
   */
  private toIso(d: Date): string {
    return this.dateSvc.toLocalIso(d);
  }
}
