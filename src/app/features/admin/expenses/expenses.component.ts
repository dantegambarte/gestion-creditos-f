import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { DedupMessageService } from '../../../core/services/dedup-message.service';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ExpenseCategory } from '../models/interface/expenses';
import { CategoryColorService } from './category-color.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseSidePanelComponent } from './expense-side-panel/expense-side-panel.component';
import { Expense } from './expense.model';
import { ExpensesService } from './expenses.service';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DropdownModule,
    PaginatorModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    MessageModule,
    ExpenseSidePanelComponent,
    FfBackTopFabComponent,
  ],
  providers: [{ provide: MessageService, useClass: DedupMessageService }],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ExpensesService);
  private readonly catSvc = inject(ExpenseCategoriesService);
  private readonly colorSvc = inject(CategoryColorService);
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

  showSidePanel = false;
  showCatsPanel = false;
  selectedExpense: Expense | null = null;

  get periodTotal(): number {
    return this.rows.reduce((sum, e) => sum + e.amount, 0);
  }

  get periodMaxExpense(): Expense | null {
    if (!this.rows.length) return null;
    return this.rows.reduce((max, e) => (e.amount > max.amount ? e : max));
  }

  get periodMostFrequentMethod(): string {
    const cash = this.rows.filter((e) => e.paymentMethod === 'CASH').length;
    const transfer = this.rows.filter(
      (e) => e.paymentMethod === 'TRANSFER',
    ).length;
    return cash >= transfer
      ? `Efectivo (${cash})`
      : `Transferencia (${transfer})`;
  }

  get currentMonthLabel(): string {
    return new Date().toLocaleString('es-AR', { month: 'long' });
  }

  /**
   * Devuelve el color de fondo para el badge de categoría en la tabla.
   * @param categoryName nombre de la categoría
   */
  getCategoryBadgeColor(categoryName: string): string {
    return this.colorSvc.getColor(categoryName);
  }

  /**
   * Devuelve el color de texto con contraste adecuado para el badge de categoría.
   * @param categoryName nombre de la categoría
   */
  getCategoryBadgeTextColor(categoryName: string): string {
    return this.colorSvc.getTextColor(categoryName);
  }

  get categoryOptions(): { label: string; value: string | null }[] {
    return this.categories
      .filter((c) => c.active)
      .map((c) => ({ label: c.name, value: c.id as string | null }));
  }

  get filterCategoryOptions(): { label: string; value: string | null }[] {
    return [{ label: 'Todas', value: null }, ...this.categoryOptions];
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
   * Carga las categorías activas para los filtros del listado.
   */
  loadCategories(): void {
    this.catSvc
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (r) => (this.categories = r), error: () => {} });
  }

  /**
   * Carga los gastos aplicando los filtros y la paginación actuales.
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
   * Aplica los filtros activos y recarga desde la primera página.
   */
  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  /**
   * Limpia todos los filtros y recarga desde la primera página.
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
   * @param event estado del paginador
   */
  onPageChange(event: PaginatorState): void {
    this.page = Math.floor((event.first ?? 0) / (event.rows ?? this.limit)) + 1;
    this.load();
  }

  /**
   * Abre el panel lateral en modo creación.
   */
  openCreate(): void {
    this.selectedExpense = null;
    this.showCatsPanel = false;
    this.showSidePanel = true;
  }

  /**
   * Abre el panel lateral cargando el gasto seleccionado para editar.
   * @param expense gasto a editar
   */
  selectExpense(expense: Expense): void {
    this.selectedExpense = expense;
    this.showCatsPanel = false;
    this.showSidePanel = true;
  }

  /**
   * Alterna la visibilidad del panel de administración de categorías.
   */
  toggleCatsPanel(): void {
    this.showCatsPanel = !this.showCatsPanel;
    if (this.showCatsPanel) {
      this.selectedExpense = null;
      this.showSidePanel = true;
    }
  }

  /**
   * Cierra el panel lateral y limpia el estado de selección.
   */
  onSidePanelClosed(): void {
    this.showSidePanel = false;
    this.showCatsPanel = false;
    this.selectedExpense = null;
  }

  /**
   * Recarga la lista desde la primera página tras guardar un gasto.
   */
  onExpenseSaved(): void {
    this.page = 1;
    this.load();
  }

  /**
   * Recarga la lista tras eliminar un gasto.
   */
  onExpenseDeleted(): void {
    this.load();
  }

  /**
   * Recarga las categorías tras crear o cambiar el estado de una.
   */
  onCategoriesChanged(): void {
    this.loadCategories();
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }
}
