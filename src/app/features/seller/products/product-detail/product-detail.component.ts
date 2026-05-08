import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ProductDetail } from '../../models/product.model';
import { ProductsService } from '../products.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CurrencyArsPipe,
    CommonModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    TableModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productsService = inject(ProductsService);
  private readonly auth = inject(MockAuthService);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  product: ProductDetail | null = null;
  loading = false;
  error: AppError | null = null;

  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: AppRoutes.SELLER_PRODUCTS },
      { label: 'Detalle' },
    ]);
    this.load();
  }

  // TODO: agregar documentacion de las funciones

  goBack(): void {
    this.location.back();
  }

  navigateToEdit(): void {
    this.router.navigate([`/${this.routePrefix}/products/${this.productId}/edit`]);
  }

  navigateToVariants(): void {
    this.router.navigate([`/${this.routePrefix}/products`, this.productId, 'variants']);
  }

  navigateToUnits(variantId: string): void {
    this.router.navigate([
      `/${this.routePrefix}/products`,
      this.productId,
      'variants',
      variantId,
      'units',
    ]);
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  confirmDeactivate(): void {
    this.confirmationService.confirm({
      header: 'Desactivar producto',
      message: `¿Desactivar <strong>${this.product?.title}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () =>
        this.productsService.deactivate(this.productId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Producto desactivado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  confirmActivate(): void {
    this.confirmationService.confirm({
      header: 'Activar producto',
      message: `¿Activar <strong>${this.product?.title}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.productsService.activate(this.productId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Producto activado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.productsService.getById(this.productId).subscribe({
      next: (data) => {
        this.product = data;
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          { label: data.title },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  private refresh(): void {
    this.productsService.getById(this.productId).subscribe({
      next: (data) => {
        this.product = data;
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          { label: data.title },
        ]);
      },
      error: () => {},
    });
  }

  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
