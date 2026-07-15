import { CommonModule, Location } from '@angular/common';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DedupMessageService } from '../../../../core/services/dedup-message.service';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import {
  ProductUnit,
  ProductUnitStatus,
} from '../../models/product-unit.model';
import { ProductUnitsService } from '../product-units.service';
import { ProductVariantsService } from '../product-variants.service';
import { ProductsService } from '../products.service';
import { UnitBulkFormComponent } from './unit-bulk-form/unit-bulk-form.component';
import { UnitSingleFormComponent } from './unit-single-form/unit-single-form.component';

@Component({
  selector: 'app-product-units',
  standalone: true,
  providers: [
    { provide: MessageService, useClass: DedupMessageService },
    ConfirmationService,
  ],
  imports: [
    FfBackTopFabComponent,
    CommonModule,
    ButtonModule,
    TableModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    ErrorStateComponent,
    SkeletonModule,
    UnitSingleFormComponent,
    UnitBulkFormComponent,
  ],
  templateUrl: './product-units.component.html',
  styleUrl: './product-units.component.scss',
})
export class ProductUnitsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly unitsService = inject(ProductUnitsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  units: ProductUnit[] = [];
  loading = false;
  error: AppError | null = null;
  productName = '';
  variantLabel = '';

  statusFilter: ProductUnitStatus | '' = '';
  readonly statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Disponible', value: 'AVAILABLE' },
    { label: 'Reservada', value: 'RESERVED' },
    { label: 'Vendida', value: 'SOLD' },
    { label: 'Inactiva', value: 'INACTIVE' },
  ];

  editingUnit: ProductUnit | null = null;

  /** Indica si el usuario autenticado tiene rol de administrador. */
  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  /** Filtra las unidades según el estado seleccionado. */
  get filteredUnits(): ProductUnit[] {
    if (!this.statusFilter) return this.units;
    return this.units.filter((u) => u.status === this.statusFilter);
  }

  get variantId(): string {
    return this.route.snapshot.paramMap.get('variantId')!;
  }

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Unidades' },
    ]);
    this.loadContext();
    this.loadUnits();
  }

  /** Vuelve a la pantalla anterior del historial de navegación. */
  goBack(): void {
    this.location.back();
  }

  /** Pone el panel individual en modo alta limpiando la unidad en edición. */
  clearEdit(): void {
    this.editingUnit = null;
  }

  /**
   * Pone el panel individual en modo edición con los datos de la unidad.
   * @param unit - Unidad a editar.
   */
  openEdit(unit: ProductUnit): void {
    this.editingUnit = unit;
  }

  /** Recarga las unidades tras una operación exitosa en cualquier panel hijo. */
  onUnitSaved(): void {
    this.editingUnit = null;
    this.loadUnits();
  }

  /** Mapea el estado de la unidad a la severidad del tag visual de PrimeNG. */
  statusSeverity(
    status: ProductUnitStatus,
  ): 'success' | 'warning' | 'secondary' | 'danger' {
    switch (status) {
      case 'AVAILABLE':
        return 'success';
      case 'RESERVED':
        return 'warning';
      case 'SOLD':
        return 'secondary';
      case 'INACTIVE':
        return 'danger';
    }
  }

  /** Mapea el estado de la unidad a su etiqueta en español. */
  statusLabel(status: ProductUnitStatus): string {
    switch (status) {
      case 'AVAILABLE':
        return 'Disponible';
      case 'RESERVED':
        return 'Reservada';
      case 'SOLD':
        return 'Vendida';
      case 'INACTIVE':
        return 'Inactiva';
    }
  }

  /** Solicita confirmación antes de dar de baja la unidad indicada. */
  confirmDeactivate(unit: ProductUnit): void {
    this.confirmationService.confirm({
      header: 'Dar de baja unidad',
      message: `¿Dar de baja la unidad <strong>${unit.unitCode}</strong>?`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass:
        'p-button-danger p-button-outlined h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.unitsService.deactivate(unit.id).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Unidad desactivada',
            });
            this.loadUnits();
          },
          error: (err: AppError) => this.handleError(err),
        }),
    });
  }

  /** Carga las unidades de la variante actual desde el backend. */
  loadUnits(): void {
    this.loading = true;
    this.error = null;
    this.unitsService.getAll({ variantId: this.variantId }).subscribe({
      next: (data) => {
        this.units = data;
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

  /** Carga el nombre del producto y la etiqueta de la variante para el breadcrumb. */
  private loadContext(): void {
    this.productsService.getById(this.productId).subscribe({
      next: (p) => {
        this.productName = p.title;
        this.updateHeader();
      },
      error: () => {},
    });
    this.variantsService.getById(this.variantId).subscribe({
      next: (v) => {
        const parts = [v.color, v.size, v.capacity].filter(Boolean);
        this.variantLabel = parts.length > 0 ? parts.join(' / ') : 'Variante';
        this.updateHeader();
      },
      error: () => {},
    });
  }

  /** Actualiza el breadcrumb del header con el contexto de producto y variante disponible. */
  private updateHeader(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      {
        label: this.productName || 'Producto',
        route: `/${this.routePrefix}/products/${this.productId}`,
      },
      {
        label: 'Variantes',
        route: `/${this.routePrefix}/products/${this.productId}/variants`,
      },
      { label: this.variantLabel || 'Unidades' },
    ]);
  }
}
