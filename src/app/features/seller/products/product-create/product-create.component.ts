import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { ToastModule } from 'primeng/toast';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { ProductBrandsService } from '../../../admin/config/services/product-brands.service';
import { ProductCategoriesService } from '../../../admin/config/services/product-categories.service';
import { ProductsService } from '../products.service';

@Component({
  selector: 'app-product-create',
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
  ],
  templateUrl: './product-create.component.html',
})
export class ProductCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(ProductCategoriesService);
  private readonly brandsService = inject(ProductBrandsService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  // DestroyRef permite usar takeUntilDestroyed para cancelar suscripciones al destruir el componente
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  submitting = false;

  categoryOptions: { label: string; value: string }[] = [];
  brandOptions: { label: string; value: string }[] = [];

  ngOnInit(): void {
    this.header.set([
      { label: 'Productos', route: `/${this.routePrefix}/products` },
      { label: 'Nuevo producto' },
    ]);

    this.form = this.fb.group({
      title: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150),
        ],
      ],
      description: ['', [Validators.maxLength(500)]],
      model: ['', [Validators.maxLength(100)]],
      brandId: [null],
      categoryId: [null],
    });

    // Carga categorías activas para el dropdown; muestra advertencia si falla
    this.categoriesService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          (this.categoryOptions = r
            .filter((c) => c.active)
            .map((c) => ({ label: c.name, value: c.id }))),
        error: () =>
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'No se pudieron cargar las categorías.',
          }),
      });

    // Carga marcas activas para el dropdown; muestra advertencia si falla
    this.brandsService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (r) =>
          (this.brandOptions = r
            .filter((b) => b.active)
            .map((b) => ({ label: b.name, value: b.id }))),
        error: () =>
          this.messageService.add({
            severity: 'warn',
            summary: 'Advertencia',
            detail: 'No se pudieron cargar las marcas.',
          }),
      });
  }

  /**
   * Indica si un campo del formulario es inválido y ya fue tocado/modificado.
   * @param field - Nombre del control del formulario.
   */
  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /**
   * Obtiene el mensaje de error para un campo específico del formulario.
   * @param field - Nombre del control del formulario.
   */
  getError(field: string): string {
    const c = this.form.get(field);
    if (!c?.errors) return '';
    if (c.errors['serverError']) return c.errors['serverError'];
    if (c.errors['required']) return 'Este campo es requerido.';
    if (c.errors['minlength'])
      return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])
      return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    return 'Campo inválido.';
  }

  /**
   * Maneja el envío del formulario: valida, llama al servicio y gestiona la respuesta.
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const raw = this.form.getRawValue();

    this.productsService
      .create({
        title: raw.title,
        description: raw.description || undefined,
        model: raw.model || undefined,
        brandId: raw.brandId || undefined,
        categoryId: raw.categoryId || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          this.submitting = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Producto registrado correctamente.',
          });
          // Espera 1.5 s para que el usuario vea el toast antes de redirigir
          setTimeout(
            () => this.router.navigate([`/${this.routePrefix}/products`, product.id]),
            1500,
          );
        },
        error: (err: AppError) => {
          this.submitting = false;

          if (err.status === 409) {
            // Título duplicado: marca el campo como inválido con el mensaje del servidor
            this.form.get('title')!.setErrors({ serverError: err.message });
            this.form.get('title')!.markAsDirty();
            return;
          }

          if (err.status === 422) {
            // La categoría o marca seleccionada ya no está activa en el servidor
            this.messageService.add({
              severity: 'warn',
              summary: 'Datos inválidos',
              detail: err.message || 'La categoría o marca seleccionada no es válida.',
            });
            return;
          }

          // Error genérico de red o servidor
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message || 'Error al registrar el producto.',
          });
        },
      });
  }

  /**
   * Navega de regreso a la lista de productos sin guardar los cambios.
   */
  cancel(): void {
    this.router.navigate([`/${this.routePrefix}/products`]);
  }

  private get routePrefix(): string {
    return this.router.url.startsWith('/admin') ? 'admin' : 'seller';
  }
}
