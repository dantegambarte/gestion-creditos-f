import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { ProductReportRow } from '../../report.models';
import { ReportsService } from '../../reports.service';

@Component({
  selector: 'app-products-report',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    FormsModule,
    ButtonModule,
    InputNumberModule,
    InputSwitchModule,
    LoadingStateComponent,
    ErrorStateComponent,
    SkeletonModule,
  ],
  templateUrl: './products-report.component.html',
})
export class ProductsReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  productRows: ProductReportRow[] = [];
  loading = false;
  error: AppError | null = null;
  stockThreshold: number | null = null;
  onlyWithSales = false;

  ngOnInit(): void {
    this.fetchProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve las filas filtradas según el toggle "Solo con ventas".
   */
  get filteredProductRows(): ProductReportRow[] {
    return this.onlyWithSales
      ? this.productRows.filter((r) => r.timesSold > 0)
      : this.productRows;
  }

  /**
   * Reinicia la lista y vuelve a consultar el reporte con el umbral actual.
   */
  consultProducts(): void {
    this.productRows = [];
    this.fetchProducts();
  }

  /**
   * Carga el reporte de productos aplicando el umbral de stock si está definido.
   */
  private fetchProducts(): void {
    this.loading = true;
    this.error = null;
    const threshold =
      this.stockThreshold != null && this.stockThreshold >= 0
        ? this.stockThreshold
        : undefined;
    this.service
      .getProductsReport(threshold)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe({
        next: (r) => {
          this.productRows = r;
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
