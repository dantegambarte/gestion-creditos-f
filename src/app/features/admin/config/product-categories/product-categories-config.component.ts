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
  private destroy$ = new Subject<void>();

  rows: ProductCategory[] = [];
  loading = false;

  showDialog = false;
  saving = false;
  newName = '';
  dialogError = '';

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // TODO: agregar documentacion de las funciones

  load(): void {
    this.loading = true;
    this.svc
      .getAll()
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

  openCreate(): void {
    this.newName = '';
    this.dialogError = '';
    this.showDialog = true;
  }

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
      acceptButtonStyleClass: cat.active ? 'p-button-danger' : 'p-button-primary',
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
        this.msg.add({
          severity: 'success',
          summary: cat.active ? 'Desactivada' : 'Activada',
          detail: cat.name,
        });
        this.load();
      },
      error: (err: AppError) =>
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message ?? 'No se pudo cambiar el estado.',
        }),
    });
  }
}
