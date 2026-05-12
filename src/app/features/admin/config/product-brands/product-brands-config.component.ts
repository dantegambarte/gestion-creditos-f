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
import { ProductBrand } from '../models/interfaces/product';
import { ProductBrandsService } from '../services/product-brands.service';

@Component({
  selector: 'app-product-brands-config',
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
  templateUrl: './product-brands-config.component.html',
})
export class ProductBrandsConfigComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ProductBrandsService);
  private readonly msg = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);
  private destroy$ = new Subject<void>();

  rows: ProductBrand[] = [];
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
            detail: 'No se pudieron cargar las marcas.',
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
            summary: 'Marca creada',
            detail: '',
          });
          this.load();
        },
        error: (err: AppError) => {
          this.dialogError = err.message ?? 'No se pudo crear la marca.';
        },
      });
  }

  /**
   * Solicita confirmación antes de cambiar el estado de la marca.
   * @param {ProductBrand} brand - Marca a activar o desactivar.
   */
  toggle(brand: ProductBrand): void {
    const action = brand.active ? 'desactivar' : 'activar';
    this.confirm.confirm({
      message: `¿Confirmás que querés ${action} la marca "${brand.name}"?`,
      header: brand.active ? 'Desactivar marca' : 'Activar marca',
      icon: brand.active ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle',
      acceptLabel: brand.active ? 'Desactivar' : 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: brand.active ? 'p-button-danger' : 'p-button-primary',
      accept: () => this.executeToggle(brand),
    });
  }

  /**
   * Ejecuta el cambio de estado de la marca tras confirmación del usuario.
   * @param {ProductBrand} brand - Marca a activar o desactivar.
   */
  private executeToggle(brand: ProductBrand): void {
    const call = brand.active
      ? this.svc.deactivate(brand.id)
      : this.svc.activate(brand.id);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.msg.add({
          severity: 'success',
          summary: brand.active ? 'Desactivada' : 'Activada',
          detail: brand.name,
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
