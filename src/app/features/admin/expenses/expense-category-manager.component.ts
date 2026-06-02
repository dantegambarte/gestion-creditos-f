import { Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, finalize, takeUntil } from 'rxjs';
import { AppError } from '../../../core/models/app-error';
import { ExpenseCategory } from '../models/interface/expenses';
import { CategoryColorService } from './category-color.service';
import { ExpenseCategoriesService } from './expense-categories.service';

@Component({
  selector: 'app-expense-category-manager',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    SkeletonModule,
  ],
  templateUrl: './expense-category-manager.component.html',
})
export class ExpenseCategoryManagerComponent implements OnInit, OnDestroy {
  /** Emite tras crear o cambiar el estado de una categoría para que el padre recargue. */
  @Output() categoriesChanged = new EventEmitter<void>();

  private readonly catSvc = inject(ExpenseCategoriesService);
  private readonly colorSvc = inject(CategoryColorService);
  private readonly msg = inject(MessageService);
  private readonly destroy$ = new Subject<void>();

  catRows: ExpenseCategory[] = [];
  loadingCats = false;
  showCatDialog = false;
  savingCat = false;
  newCatName = '';
  catDialogError = '';

  ngOnInit(): void {
    this.loadCatRows();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Devuelve el color de fondo del badge de la categoría indicada.
   * @param categoryName nombre de la categoría
   */
  getCategoryBadgeColor(categoryName: string): string {
    return this.colorSvc.getColor(categoryName);
  }

  /** Abre el diálogo para crear una nueva categoría. */
  openCatCreate(): void {
    this.newCatName = '';
    this.catDialogError = '';
    this.showCatDialog = true;
  }

  /** Envía la solicitud para crear una nueva categoría. */
  submitCatCreate(): void {
    if (!this.newCatName.trim()) return;
    this.savingCat = true;
    this.catDialogError = '';
    this.catSvc
      .create(this.newCatName.trim())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.savingCat = false)),
      )
      .subscribe({
        next: () => {
          this.showCatDialog = false;
          this.msg.add({ severity: 'success', summary: 'Categoría creada' });
          this.loadCatRows();
          this.categoriesChanged.emit();
        },
        error: (err: AppError) => {
          this.catDialogError = err.message ?? 'No se pudo crear la categoría.';
        },
      });
  }

  /**
   * Alterna el estado activo/inactivo de una categoría.
   * @param cat categoría a modificar
   */
  toggleCat(cat: ExpenseCategory): void {
    const call = cat.active
      ? this.catSvc.deactivate(cat.id)
      : this.catSvc.activate(cat.id);
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.msg.add({
          severity: 'success',
          summary: cat.active ? 'Desactivada' : 'Activada',
          detail: cat.name,
        });
        this.loadCatRows();
        this.categoriesChanged.emit();
      },
      error: (err: AppError) =>
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message ?? 'Error.',
        }),
    });
  }

  /** Carga todas las categorías desde el backend. */
  private loadCatRows(): void {
    this.loadingCats = true;
    this.catSvc
      .getAll(true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingCats = false)),
      )
      .subscribe({
        next: (r) => (this.catRows = r),
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las categorías.',
          }),
      });
  }
}
