import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { ProductCategory } from '../models/interfaces/product';
import { ProductCategoriesService } from '../services/product-categories.service';

@Component({
  selector: 'app-product-categories-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    DialogModule,
    InputTextModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './product-categories-config.component.html',
})
export class ProductCategoriesConfigComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ProductCategoriesService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private readonly document = inject(DOCUMENT);
  private destroy$ = new Subject<void>();

  rows: ProductCategory[] = [];
  loading = false;

  showDialog = false;
  saving = false;
  newName = '';
  dialogError = '';

  showEditDialog = false;
  editingCategory: ProductCategory | null = null;
  editName = '';
  editError = '';

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Cantidad de categorías activas para mostrar el resumen compacto. */
  get activeCount(): number {
    return this.rows.filter((cat) => cat.active).length;
  }

  /** Cantidad de categorías inactivas para mostrar el resumen compacto. */
  get inactiveCount(): number {
    return this.rows.filter((cat) => !cat.active).length;
  }

  /** Cantidad de categorías vinculadas a productos para mostrar el resumen compacto. */
  get withProductsCount(): number {
    return this.rows.filter((cat) => cat.productCount > 0).length;
  }

  /** Carga todas las categorías desde el backend y actualiza la tabla. */
  load(): void {
    this.loading = true;
    this.svc
      .getAll(true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (r) => (this.rows = r),
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las categorías.',
          }),
      });
  }

  /** Abre el panel de creación con el campo nombre vacío. */
  openCreate(): void {
    this.newName = '';
    this.dialogError = '';
    this.showDialog = true;
  }

  /** Oculta el panel de creación y descarta el nombre cargado. */
  closeCreate(): void {
    this.newName = '';
    this.dialogError = '';
    this.showDialog = false;
    this.restoreCreateTriggerFocus();
  }

  /** Envía el nuevo nombre al backend y recarga la lista al confirmar. */
  submitCreate(): void {
    if (!this.newName.trim()) return;
    this.saving = true;
    this.dialogError = '';
    this.svc
      .create(this.newName.trim())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.showDialog = false;
          this.restoreCreateTriggerFocus();
          this.msg.add({
            severity: 'success',
            summary: 'Categoría creada',
            detail: '',
          });
          this.load();
        },
        error: (err: AppError) => {
          this.dialogError = err.message ?? 'No se pudo crear la categoría.';
        },
      });
  }

  /**
   * Abre el diálogo de edición para renombrar una categoría existente.
   * @param {ProductCategory} cat - Categoría a editar.
   */
  openEdit(cat: ProductCategory): void {
    this.editingCategory = cat;
    this.editName = cat.name;
    this.editError = '';
    this.showEditDialog = true;
  }

  /**
   * Envía el nuevo nombre de la categoría al backend.
   */
  submitEdit(): void {
    if (!this.editingCategory || !this.editName.trim()) return;
    this.saving = true;
    this.editError = '';
    this.svc
      .update(this.editingCategory.id, this.editName.trim())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.showEditDialog = false;
          this.editingCategory = null;
          this.msg.add({
            severity: 'success',
            summary: 'Categoría actualizada',
            detail: '',
          });
          this.load();
        },
        error: (err: AppError) => {
          this.editError = err.message ?? 'No se pudo actualizar la categoría.';
        },
      });
  }

  /**
   * Solicita confirmación antes de cambiar el estado de la categoría.
   * @param {ProductCategory} cat - Categoría a activar o desactivar.
   */
  toggle(cat: ProductCategory): void {
    const action = cat.active ? 'desactivar' : 'activar';
    this.confirm.confirm({
      message: `¿Confirmás que querés ${action} la categoría "${cat.name}"?`,
      header: cat.active ? 'Desactivar categoría' : 'Activar categoría',
      icon: cat.active ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle',
      acceptLabel: cat.active ? 'Desactivar' : 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: cat.active
        ? 'p-button-danger h-11 px-5 rounded-xl'
        : 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () => this.executeToggle(cat),
    });
  }

  /**
   * Ejecuta el cambio de estado de la categoría tras confirmación del usuario.
   * @param {ProductCategory} cat - Categoría a activar o desactivar.
   */
  private executeToggle(cat: ProductCategory): void {
    const call = cat.active
      ? this.svc.deactivate(cat.id)
      : this.svc.activate(cat.id);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        cat.active = !cat.active;
        this.rows = [...this.rows];
        this.msg.add({
          severity: 'success',
          summary: cat.active ? 'Activada' : 'Desactivada',
          detail: cat.name,
        });
      },
      error: (err: AppError) =>
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message ?? 'No se pudo cambiar el estado.',
        }),
    });
  }

  /**
   * Devuelve el foco al botón que abrió el modal cuando el diálogo se cierra.
   */
  private restoreCreateTriggerFocus(): void {
    setTimeout(() => {
      const trigger = this.document.querySelector(
        '[data-cy="product-categories-create-trigger"] button, [data-cy="product-categories-create-trigger"]',
      );

      if (trigger instanceof HTMLElement) {
        trigger.focus();
      }
    });
  }
}
