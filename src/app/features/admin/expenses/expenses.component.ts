import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { Expense, ExpenseCreatePayload } from './expense.model';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from '../models/interface/expenses';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    PaginatorModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    LoadingStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ExpensesService);
  private readonly catSvc = inject(ExpenseCategoriesService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly fmt = inject(FormatService);
  private destroy$ = new Subject<void>();

  rows: Expense[] = [];
  total = 0;
  page = 1;
  readonly limit = 20;
  loading = false;

  filterDateFrom: string | null = null;
  filterDateTo: string | null = null;
  filterCategoryId: string | null = null;

  categories: ExpenseCategory[] = [];

  showCreateDialog = false;
  saving = false;
  createAmount: number | null = null;
  createDescription = '';
  createPaymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  createTransferRef = '';
  createCategoryId: string | null = null;
  createExpenseDate: string = this.todayIso();
  createError = '';

  showConfirmDelete = false;
  deletingId: string | null = null;
  deleting = false;

  showCatsPanel = false;
  catRows: ExpenseCategory[] = [];
  loadingCats = false;
  showCatDialog = false;
  savingCat = false;
  newCatName = '';
  catDialogError = '';

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  get categoryOptions(): { label: string; value: string | null }[] {
    return this.categories
      .filter((c) => c.active)
      .map((c) => ({ label: c.name, value: c.id as string | null }));
  }

  get filterCategoryOptions(): { label: string; value: string | null }[] {
    return [{ label: 'Todas', value: null }, ...this.categoryOptions];
  }

  get createCategoryOptions(): { label: string; value: string | null }[] {
    return [{ label: 'Sin categoría', value: null }, ...this.categoryOptions];
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Gastos' }]);
    this.loadCategories();
    this.load();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga las categorías de gastos para los filtros y el formulario de creación.
   */
  loadCategories(): void {
    this.catSvc
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => (this.categories = r), error: () => {} });
  }

  /**
   * Carga los gastos aplicando los filtros y la paginación actuales. Muestra mensajes de error en caso de fallo.
   */
  load(): void {
    this.loading = true;
    const filters = {
      page: this.page,
      limit: this.limit,
      ...(this.filterDateFrom ? { dateFrom: this.filterDateFrom } : {}),
      ...(this.filterDateTo ? { dateTo: this.filterDateTo } : {}),
      ...(this.filterCategoryId ? { categoryId: this.filterCategoryId } : {}),
    };
    this.svc
      .getAll(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false)),
      )
      .subscribe({
        next: (r) => {
          this.rows = r.rows;
          this.total = r.total;
        },
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar los gastos.',
          }),
      });
  }

  /**
   * Aplica los filtros de fecha y recarga la lista de gastos. Resetea a la primera página.
   */
  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  /**
   * Limpia los filtros de fecha y recarga la lista de gastos. Resetea a la primera página.
   */
  clearFilters(): void {
    this.filterDateFrom = null;
    this.filterDateTo = null;
    this.filterCategoryId = null;
    this.page = 1;
    this.load();
  }

  /**
   * Maneja el cambio de página en el paginador.
   * @param event
   */
  onPageChange(event: PaginatorState): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.limit)) + 1;
    this.load();
  }

  /**
   * Abre el diálogo para crear un nuevo gasto, reseteando los campos y errores previos.
   */
  openCreate(): void {
    this.createAmount = null;
    this.createDescription = '';
    this.createPaymentMethod = 'CASH';
    this.createTransferRef = '';
    this.createCategoryId = null;
    this.createExpenseDate = this.todayIso();
    this.createError = '';
    this.showCreateDialog = true;
  }

  /**
   * Envía la solicitud para crear un nuevo gasto.
   * @returns
   */
  submitCreate(): void {
    if (
      !this.createAmount ||
      this.createAmount <= 0 ||
      !this.createDescription.trim()
    )
      return;
    const payload: ExpenseCreatePayload = {
      amount: this.createAmount,
      description: this.createDescription.trim(),
      paymentMethod: this.createPaymentMethod,
      expenseDate: this.createExpenseDate || undefined,
    };
    if (
      this.createPaymentMethod === 'TRANSFER' &&
      this.createTransferRef.trim()
    ) {
      payload.transferReference = this.createTransferRef.trim();
    }
    if (this.createCategoryId) {
      payload.categoryId = this.createCategoryId;
    }
    this.saving = true;
    this.createError = '';
    this.svc
      .create(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.showCreateDialog = false;
          this.msg.add({
            severity: 'success',
            summary: 'Gasto registrado',
            detail: 'El gasto fue registrado correctamente.',
          });
          this.page = 1;
          this.load();
        },
        error: (err: AppError) => {
          this.createError = err.message ?? 'No se pudo registrar el gasto.';
        },
      });
  }

  /**
   * Confirma la eliminación de un gasto.
   * @param id
   */
  confirmDelete(id: string): void {
    this.deletingId = id;
    this.showConfirmDelete = true;
  }

  /**
   * Ejecuta la eliminación del gasto confirmado.
   * @returns
   */
  doDelete(): void {
    if (!this.deletingId) return;
    this.deleting = true;
    this.svc
      .remove(this.deletingId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.deleting = false)),
      )
      .subscribe({
        next: () => {
          this.showConfirmDelete = false;
          this.deletingId = null;
          this.msg.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Gasto eliminado.',
          });
          this.load();
        },
        error: (err: AppError) => {
          this.showConfirmDelete = false;
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message ?? 'No se pudo eliminar.',
          });
        },
      });
  }

  /**
   * Alterna la visibilidad del panel de categorías. Si se muestra, carga las categorías para mostrar en el panel.
   */
  toggleCatsPanel(): void {
    this.showCatsPanel = !this.showCatsPanel;
    if (this.showCatsPanel) this.loadCatRows();
  }

  /**
   * Carga las categorías de gastos para mostrarlas en el panel de administración de categorías. Muestra mensajes de error en caso de fallo.
   */
  loadCatRows(): void {
    this.loadingCats = true;
    this.catSvc
      .getAll(true)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loadingCats = false)),
      )
      .subscribe({
        next: (r) => {
          this.catRows = r;
          this.categories = r;
        },
        error: () =>
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No se pudieron cargar las categorías.',
          }),
      });
  }

  /**
   * Abre el diálogo para crear una nueva categoría de gasto, reseteando los campos y errores previos.
   */
  openCatCreate(): void {
    this.newCatName = '';
    this.catDialogError = '';
    this.showCatDialog = true;
  }

  /**
   * Envía la solicitud para crear una nueva categoría de gasto.
   * @returns
   */
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
          this.msg.add({
            severity: 'success',
            summary: 'Categoría creada',
            detail: '',
          });
          this.loadCatRows();
        },
        error: (err: AppError) => {
          this.catDialogError = err.message ?? 'No se pudo crear la categoría.';
        },
      });
  }

  /**
   * Alterna el estado activo/inactivo de una categoría de gasto. Muestra mensajes de éxito o error según corresponda.
   * @param cat
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
      },
      error: (err: AppError) =>
        this.msg.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message ?? 'Error.',
        }),
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  private todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }
}
