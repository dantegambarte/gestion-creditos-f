import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MockAuthService } from '../../../../core/auth/mock-auth.service';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ProductVariant } from '../../models/product-variant.model';
import { ProductVariantsService } from '../product-variants.service';
import { ProductsService } from '../products.service';

@Component({
  selector: 'app-product-variants',
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
    InputNumberModule,
    CurrencyArsPipe,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-variants.component.html',
})
export class ProductVariantsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly auth = inject(MockAuthService);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  variants: ProductVariant[] = [];
  loading = false;
  error: AppError | null = null;
  productName = '';

  showDialog = false;
  editingVariant: ProductVariant | null = null;
  dialogSubmitting = false;
  dialogError: string | null = null;
  form!: FormGroup;

  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Variantes' },
    ]);
    this.buildForm();
    this.loadProduct();
    this.loadVariants();
  }

    // TODO: agregar documentacion de las funciones

  goBack(): void {
    this.location.back();
  }

  openCreate(): void {
    this.editingVariant = null;
    this.form.reset({ currentPrice: null });
    this.dialogError = null;
    this.showDialog = true;
  }

  openEdit(variant: ProductVariant): void {
    this.editingVariant = variant;
    this.form.patchValue({
      color: variant.color ?? '',
      size: variant.size ?? '',
      capacity: variant.capacity ?? '',
      currentPrice: variant.currentPrice,
    });
    this.dialogError = null;
    this.showDialog = true;
  }

  saveDialog(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.dialogSubmitting = true;
    this.dialogError = null;

    if (this.editingVariant) {
      this.variantsService
        .update(this.editingVariant.id, {
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante actualizada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
          },
        });
    } else {
      this.variantsService
        .create({
          productId: this.productId,
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
        })
        .subscribe({
          next: () => {
            this.dialogSubmitting = false;
            this.showDialog = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante creada',
            });
            this.loadVariants();
          },
          error: (err: AppError) => {
            this.dialogSubmitting = false;
            this.dialogError = err.message;
          },
        });
    }
  }

  confirmDeactivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Desactivar variante',
      message: `¿Desactivar variante <strong>${variant.color ?? ''} ${variant.size ?? ''} ${variant.capacity ?? ''}</strong>?`,
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
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

  confirmActivate(variant: ProductVariant): void {
    this.confirmationService.confirm({
      header: 'Activar variante',
      message: '¿Activar esta variante?',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
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

  navigateToUnits(variant: ProductVariant): void {
    this.router.navigate([
      `/${this.routePrefix}/products`,
      this.productId,
      'variants',
      variant.id,
      'units',
    ]);
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  private buildForm(): void {
    this.form = this.fb.group({
      color: [''],
      size: [''],
      capacity: [''],
      currentPrice: [null, [Validators.required, Validators.min(0.01)]],
    });
  }

  private loadProduct(): void {
    this.productsService.getById(this.productId).subscribe({
      next: (p) => {
        this.productName = p.title;
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          { label: p.title, route: `/${this.routePrefix}/products/${this.productId}` },
          { label: 'Variantes' },
        ]);
      },
      error: () => {},
    });
  }

  private loadVariants(): void {
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

  private handleError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
