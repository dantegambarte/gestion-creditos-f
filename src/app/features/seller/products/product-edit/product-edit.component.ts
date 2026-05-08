import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { ProductBrandsService } from '../../../admin/config/services/product-brands.service';
import { ProductCategoriesService } from '../../../admin/config/services/product-categories.service';
import { ProductDetail } from '../../models/product.model';
import { ProductsService } from '../products.service';

@Component({
  selector: 'app-product-edit',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    InputTextareaModule,
    ToastModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  templateUrl: './product-edit.component.html',
})
export class ProductEditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(ProductCategoriesService);
  private readonly brandsService = inject(ProductBrandsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  product: ProductDetail | null = null;
  loading = false;
  error: AppError | null = null;
  submitting = false;
  form!: FormGroup;

  categoryOptions: { label: string; value: string }[] = [];
  brandOptions: { label: string; value: string }[] = [];

  private get productId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  /**
   * Inicializa breadcrumbs, catálogos de apoyo y carga inicial del producto a editar.
   */
  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Producto', route: `/${this.routePrefix}/products/${this.productId}` },
      { label: 'Editar' },
    ]);

    this.categoriesService.getAll().subscribe({
      next: (r) =>
        (this.categoryOptions = r
          .filter((c) => c.active)
          .map((c) => ({ label: c.name, value: c.id }))),
      error: () => {},
    });

    this.brandsService.getAll().subscribe({
      next: (r) =>
        (this.brandOptions = r
          .filter((b) => b.active)
          .map((b) => ({ label: b.name, value: b.id }))),
      error: () => {},
    });

    this.load();
  }

  /**
   * Indica si un control está inválido y fue interactuado para mostrar errores de validación.
   * @param field - Nombre del control dentro del formulario reactivo.
   */
  isInvalid(field: string): boolean {
    const camp = this.form?.get(field);
    return !!(camp && camp.invalid && (camp.dirty || camp.touched));
  }

  /**
   * Devuelve el mensaje de error legible para el campo solicitado.
   * @param field - Nombre del control del formulario.
   * @returns Mensaje de error listo para renderizar o cadena vacía.
   */
  getError(field: string): string {
    const camp = this.form?.get(field);
    if (!camp?.errors) return '';
    if (camp.errors['serverError']) return camp.errors['serverError'];
    if (camp.errors['required']) return 'Este campo es requerido.';
    if (camp.errors['minlength'])
      return `Mínimo ${camp.errors['minlength'].requiredLength} caracteres.`;
    if (camp.errors['maxlength'])
      return `Máximo ${camp.errors['maxlength'].requiredLength} caracteres.`;
    return 'Campo inválido.';
  }

  /**
   * Envía la actualización del producto con los campos editables permitidos por el dominio.
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const raw = this.form.getRawValue();

    this.productsService
      .update(this.productId, {
        title: raw.title,
        description: raw.description || undefined,
        model: raw.model || undefined,
        brandId: raw.brandId || undefined,
        categoryId: raw.categoryId || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Producto actualizado correctamente.',
          });
          setTimeout(
            () =>
              this.router.navigate([`/${this.routePrefix}/products`, this.productId]),
            1000,
          );
        },
        error: (err: AppError) => {
          this.submitting = false;
          if (err.status === 409) {
            this.form.get('title')!.setErrors({ serverError: err.message });
            this.form.get('title')!.markAsDirty();
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Error al actualizar el producto.',
            });
          }
        },
      });
  }

  /**
   * Regresa al detalle del producto sin persistir cambios.
   */
  cancel(): void {
    this.router.navigate([`/${this.routePrefix}/products`, this.productId]);
  }

  /**
   * Obtiene el prefijo de ruta según el contexto actual (admin o vendedor).
   */
  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }

  /**
   * Carga el detalle del producto y construye el formulario, incluyendo el stock solo lectura.
   */
  private load(): void {
    this.loading = true;
    this.error = null;
    this.productsService.getById(this.productId).subscribe({
      next: (data) => {
        this.product = data;
        this.form = this.fb.group({
          title: [
            data.title,
            [
              Validators.required,
              Validators.minLength(2),
              Validators.maxLength(150),
            ],
          ],
          description: [data.description ?? '', [Validators.maxLength(500)]],
          model: [data.model ?? '', [Validators.maxLength(100)]],
          stock: [data.availableCount],
          brandId: [data.brandId ?? null],
          categoryId: [data.categoryId ?? null],
        });
        this.header.set([
          { label: 'Productos', route: `/${this.routePrefix}/products` },
          { label: data.title, route: `/${this.routePrefix}/products/${this.productId}` },
          { label: 'Editar' },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
