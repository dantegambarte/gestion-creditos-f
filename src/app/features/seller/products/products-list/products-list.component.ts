import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { EmptyStateComponent } from '../../../../shared/states/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ProductCategory } from '../../../admin/config/models/interfaces/product';
import { ProductCategoriesService } from '../../../admin/config/services/product-categories.service';
import {
  Product,
  ProductListFilters,
  ProductStatus,
} from '../../models/product.model';
import { ProductsService } from '../products.service';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    InputIconModule,
    IconFieldModule,
  ],
  templateUrl: './products-list.component.html',
})
export class ProductsListComponent implements OnInit, OnDestroy {
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(ProductCategoriesService);
  private readonly auth = inject(MockAuthService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);

  products: Product[] = [];
  loading = false;
  error: AppError | null = null;

  searchTerm = '';
  selectedStatus: ProductStatus | null = null;
  selectedCategoryId: string | null = null;
  categories: ProductCategory[] = [];

  readonly statusOptions = [
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'Inactivo', value: 'INACTIVE' },
  ];

  get canCreate(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  get categoryOptions(): { label: string; value: string }[] {
    return this.categories.map((c) => ({ label: c.name, value: c.id }));
  }

  private readonly searchSubject = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.header.set([{ label: 'Productos' }]);
    this.categoriesService
      .getAll()
      .subscribe({ next: (r) => (this.categories = r), error: () => {} });
    this.loadProducts();

    this.sub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadProducts());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  applyFilters(): void {
    this.loadProducts();
  }

  navigateToDetail(id: string): void {
    this.router.navigate([`/${this.routePrefix}/products`, id]);
  }

  navigateToEdit(id: string): void {
    this.router.navigate([`/${this.routePrefix}/products/${id}/edit`]);
  }

  navigateToCreate(): void {
    this.router.navigate([`/${this.routePrefix}/products/new`]);
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  variantPriceLabel(product: Product): string {
    if (!product.variants || product.variants.length === 0) return '—';
    const prices = product.variants.map((v) => v.currentPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max
      ? `$${min.toLocaleString('es-AR')}`
      : `desde $${min.toLocaleString('es-AR')}`;
  }

  private loadProducts(): void {
    const filters: ProductListFilters = {};
    if (this.selectedStatus) filters.status = this.selectedStatus;
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();
    if (this.selectedCategoryId) filters.categoryId = this.selectedCategoryId;

    this.loading = true;
    this.error = null;
    this.productsService.list(filters).subscribe({
      next: (data) => {
        this.products = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
