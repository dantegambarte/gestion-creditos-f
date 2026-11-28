import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, of } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../../core/models/app-error';
import { FormatService } from '../../../../../core/services/format.service';
import { CompanySettingsService } from '../../../config/services/company-settings.service';
import { ErrorStateComponent } from '../../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../../shared/states/loading-state/loading-state.component';
import { ProductReportRow } from '../../report.models';
import { ReportsService } from '../../reports.service';

/** Umbral de stock bajo si la configuración del backend no trae uno (#109). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

@Component({
  selector: 'app-products-report',
  imports: [
    FfBackTopFabComponent,
    FormsModule,
    ButtonModule,
    DropdownModule,
    InputNumberModule,
    InputSwitchModule,
    InputTextModule,
    LoadingStateComponent,
    ErrorStateComponent,
    SkeletonModule,
  ],
  templateUrl: './products-report.component.html',
})
export class ProductsReportComponent implements OnInit, OnDestroy {
  private readonly service = inject(ReportsService);
  private readonly companySettings = inject(CompanySettingsService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  productRows: ProductReportRow[] = [];
  loading = false;
  error: AppError | null = null;
  /** Umbral que el admin escribe en pantalla; `null` = usar el configurado. */
  stockThreshold: number | null = null;
  /** Umbral de la configuración del backend (`low_stock_threshold`); `null` mientras no llega. */
  configuredThreshold: number | null = null;
  readonly defaultLowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD;
  onlyWithSales = false;
  searchText = '';
  stockMode: 'ALL' | 'LOW' | 'OUT' | 'AVAILABLE' = 'ALL';
  readonly stockModeOptions = [
    { label: 'Todos los stocks', value: 'ALL' as const },
    { label: 'Con stock', value: 'AVAILABLE' as const },
    { label: 'Stock bajo', value: 'LOW' as const },
    { label: 'Sin stock', value: 'OUT' as const },
  ];

  ngOnInit(): void {
    this.loadConfiguredThreshold();
    this.fetchProducts();
  }

  /**
   * Umbral vigente: el que escribe el admin, si no el de la configuración, si no el default.
   */
  get effectiveThreshold(): number {
    return this.stockThreshold ?? this.configuredThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve las filas filtradas según el toggle "Solo con ventas".
   */
  get filteredProductRows(): ProductReportRow[] {
    const term = this.searchText.trim().toLowerCase();
    return this.productRows.filter((row) => {
      if (this.onlyWithSales && row.timesSold <= 0) return false;
      if (term && !`${row.title} ${row.description}`.toLowerCase().includes(term)) {
        return false;
      }
      if (this.stockMode === 'OUT') return row.availableCount === 0;
      if (this.stockMode === 'AVAILABLE') return row.availableCount > 0;
      if (this.stockMode === 'LOW') {
        return row.availableCount > 0 && row.availableCount <= this.effectiveThreshold;
      }
      return true;
    });
  }

  /**
   * Reinicia la lista y vuelve a consultar el reporte con el umbral actual.
   */
  consultProducts(): void {
    this.productRows = [];
    this.fetchProducts();
  }

  /**
   * Lee el umbral de `GET /company`. Si falla o no viene, queda en `null` y rige el
   * default: el reporte se muestra igual.
   */
  private loadConfiguredThreshold(): void {
    this.companySettings
      .get()
      .pipe(
        map((s) => s.low_stock_threshold),
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((value) => {
        this.configuredThreshold = typeof value === 'number' && value >= 0 ? value : null;
      });
  }

  /**
   * Carga el reporte de productos aplicando el umbral de stock si está definido.
   */
  private fetchProducts(): void {
    this.loading = true;
    this.error = null;
    const threshold =
      this.stockThreshold != null && this.stockThreshold >= 0 ? this.stockThreshold : undefined;
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
