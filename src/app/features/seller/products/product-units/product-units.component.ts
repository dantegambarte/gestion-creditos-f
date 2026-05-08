import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import {
  ProductUnit,
  ProductUnitStatus,
} from '../../models/product-unit.model';
import { ProductUnitsService } from '../product-units.service';
import { ProductVariantsService } from '../product-variants.service';
import { ProductsService } from '../products.service';

@Component({
  selector: 'app-product-units',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    TableModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    DropdownModule,
    FormsModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-units.component.html',
})
export class ProductUnitsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly unitsService = inject(ProductUnitsService);
  private readonly auth = inject(MockAuthService);
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

  showSingleDialog = false;
  showBulkDialog = false;
  editingUnit: ProductUnit | null = null;
  dialogSubmitting = false;
  dialogError: string | null = null;
  bulkPreview: string[] = [];
  singleForm!: FormGroup;
  bulkForm!: FormGroup;

  // TODO: agregar documentacion de las funciones

  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  get filteredUnits(): ProductUnit[] {
    if (!this.statusFilter) return this.units;
    return this.units.filter((u) => u.status === this.statusFilter);
  }

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  private get variantId(): string {
    return this.route.snapshot.paramMap.get('variantId')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Unidades' },
    ]);
    this.buildForms();
    this.loadContext();
    this.loadUnits();
  }

  goBack(): void {
    this.location.back();
  }

  openCreate(): void {
    this.editingUnit = null;
    this.singleForm.reset({ unitCode: '', notes: '' });
    this.dialogError = null;
    this.showSingleDialog = true;
  }

  openEdit(unit: ProductUnit): void {
    this.editingUnit = unit;
    this.singleForm.patchValue({
      unitCode: unit.unitCode,
      notes: unit.notes ?? '',
    });
    this.dialogError = null;
    this.showSingleDialog = true;
  }

  openBulk(): void {
    this.bulkForm.reset({ rawCodes: '' });
    this.bulkPreview = [];
    this.dialogError = null;
    this.showBulkDialog = true;
  }

  onBulkCodesChange(): void {
    const raw: string = this.bulkForm.get('rawCodes')?.value ?? '';
    this.bulkPreview = raw
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  saveSingle(): void {
    if (this.singleForm.invalid) {
      this.singleForm.markAllAsTouched();
      return;
    }
    const v = this.singleForm.getRawValue();
    this.dialogSubmitting = true;
    this.dialogError = null;

    if (this.editingUnit) {
      this.unitsService
        .update(this.editingUnit.id, {
          unitCode: v.unitCode,
          notes: v.notes || undefined,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showSingleDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Unidad actualizada',
            });
            this.loadUnits();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
          },
        });
    } else {
      this.unitsService
        .create({
          variantId: this.variantId,
          unitCode: v.unitCode,
          notes: v.notes || undefined,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showSingleDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Unidad creada',
            });
            this.loadUnits();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
          },
        });
    }
  }

  saveBulk(): void {
    if (this.bulkPreview.length === 0) return;
    this.dialogSubmitting = true;
    this.dialogError = null;
    this.unitsService
      .createBulk({
        variantId: this.variantId,
        units: this.bulkPreview.map((code) => ({ unitCode: code })),
      })
      .subscribe({
        next: (result) => {
          this.dialogSubmitting = false;
          this.showBulkDialog = false;
          this.messageService.add({
            severity: 'success',
            summary: `${result.created} unidades creadas`,
          });
          this.loadUnits();
        },
        error: (err: AppError) => {
          this.dialogSubmitting = false;
          this.dialogError = err.message;
        },
      });
  }

  confirmDeactivate(unit: ProductUnit): void {
    this.confirmationService.confirm({
      header: 'Dar de baja unidad',
      message: `¿Dar de baja la unidad <strong>${unit.unitCode}</strong>?`,
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
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

  isInvalid(field: string): boolean {
    const c = this.singleForm.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private buildForms(): void {
    this.singleForm = this.fb.group({
      unitCode: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(100),
          Validators.pattern(/^[A-Za-z0-9\-_]+$/),
        ],
      ],
      notes: ['', Validators.maxLength(500)],
    });
    this.bulkForm = this.fb.group({
      rawCodes: ['', Validators.required],
    });
  }

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

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

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

  private loadUnits(): void {
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

  private handleError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
