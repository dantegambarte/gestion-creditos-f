import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ProductVariant } from '../../models/product-variant.model';
import { ProductVariantsService } from '../product-variants.service';
import { ProductsService } from '../products.service';
import { VariantFormPanelComponent } from './variant-form-panel.component';

@Component({
  selector: 'app-product-variants',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    ButtonModule,
    TableModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    CurrencyArsPipe,
    LoadingStateComponent,
    ErrorStateComponent,
    VariantFormPanelComponent,
  ],
  templateUrl: './product-variants.component.html',
})
export class ProductVariantsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  variants: ProductVariant[] = [];
  loading = false;
  error: AppError | null = null;
  productName = '';

  showPanel = false;
  isBulkMode = false;
  editingVariant: ProductVariant | null = null;
  expandedVariantIds = new Set<string>();

  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  get hasColor(): boolean {
    return this.variants.some((v) => !!v.color);
  }
  get hasSize(): boolean {
    return this.variants.some((v) => !!v.size);
  }
  get hasCapacity(): boolean {
    return this.variants.some((v) => !!v.capacity);
  }

  get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Variantes' },
    ]);
    this.loadProduct();
    this.loadVariants();
  }

  /** Vuelve a la pantalla anterior del historial de navegación. */
  goBack(): void {
    this.location.back();
  }

  /**
   * Devuelve un resumen legible de los atributos de la variante (color, talle, capacidad).
   * @param v - Variante del producto.
   */
  variantSummary(v: ProductVariant): string {
    const parts = [v.color, v.size, v.capacity].filter((s) => !!s);
    return parts.length > 0 ? parts.join(' · ') : 'Estándar';
  }

  /** Abre el panel lateral en modo alta y limpia el estado de edición. */
  openCreate(): void {
    this.editingVariant = null;
    this.showPanel = true;
  }

  /**
   * Abre el panel lateral en modo edición con los datos de la variante seleccionada.
   * @param variant - Variante a editar.
   */
  openEdit(variant: ProductVariant): void {
    this.editingVariant = variant;
    this.showPanel = true;
  }

  /**
   * Indica si el ingreso bulk está activo — usado para ajustar colspans de la tabla.
   * @returns True cuando el panel está abierto en modo múltiple.
   */
  isBulkModeActive(): boolean {
    return this.showPanel && this.isBulkMode;
  }

  /**
   * Alterna la expansión de una variante en la grilla.
   * @param variant - Variante objetivo del toggle.
   */
  toggleVariantExpanded(variant: ProductVariant): void {
    if (this.expandedVariantIds.has(variant.id)) {
      this.expandedVariantIds.delete(variant.id);
      return;
    }
    this.expandedVariantIds.add(variant.id);
  }

  /**
   * Informa si una variante está expandida en la tabla.
   * @param variant - Variante a evaluar.
   * @returns True cuando la fila está desplegada.
   */
  isVariantExpanded(variant: ProductVariant): boolean {
    return this.expandedVariantIds.has(variant.id);
  }

  /**
   * Indica si todas las filas visibles están expandidas.
   * @returns True cuando no hay filas colapsadas.
   */
  areAllVariantsExpanded(): boolean {
    if (this.variants.length === 0) return false;
    return this.variants.every((variant) =>
      this.expandedVariantIds.has(variant.id),
    );
  }

  /** Expande o colapsa todas las variantes de la tabla. */
  toggleAllVariantsExpanded(): void {
    if (this.areAllVariantsExpanded()) {
      this.expandedVariantIds.clear();
      return;
    }
    this.expandedVariantIds = new Set(
      this.variants.map((variant) => variant.id),
    );
  }

  /** Solicita confirmación antes de desactivar la variante indicada. */
  confirmDeactivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Desactivar variante',
      message: `¿Desactivar variante <strong>${variant.color ?? ''} ${variant.size ?? ''} ${variant.capacity ?? ''}</strong>?`,
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass:
        'p-button-danger p-button-outlined h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.variantsService.deactivate(variant.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Variante desactivada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => this.handleError(err),
        }),
    });
  }

  /** Solicita confirmación antes de activar la variante indicada. */
  confirmActivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Activar variante',
      message: '¿Activar esta variante?',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.variantsService.activate(variant.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Variante activada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => this.handleError(err),
        }),
    });
  }

  /** Navega al listado de unidades de la variante indicada. */
  navigateToUnits(variant: ProductVariant): void {
    this.router.navigate([
      `/${this.routePrefix}/products`,
      this.productId,
      'variants',
      variant.id,
      'units',
    ]);
  }

  /** Recarga variantes cuando el panel hijo notifica una creación o edición exitosa. */
  onVariantSaved(): void {
    this.loadVariants();
  }

  /** Carga todas las variantes del producto actual desde el backend. */
  loadVariants(): void {
    this.loading = true;
    this.error = null;
    this.variantsService.getAll({ productId: this.productId }).subscribe({
      next: (data) => {
        this.variants = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  /** Muestra un toast de conflicto o error según el código HTTP de la respuesta. */
  private handleError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }

  /** Carga el nombre del producto para construir el breadcrumb. */
  private loadProduct(): void {
    this.productsService.getById(this.productId).subscribe({
      next: (p) => {
        this.productName = p.title;
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          {
            label: p.title,
            route: `/${this.routePrefix}/products/${this.productId}`,
          },
          { label: 'Variantes' },
        ]);
      },
      error: () => {},
    });
  }
}
