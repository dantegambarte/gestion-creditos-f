import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageModule } from 'primeng/message';
import { Subject, catchError, of } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { Expense, ExpenseCreatePayload } from './expense.model';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseCategory } from '../models/interface/expenses';
import { CashRegisterService } from '../cash-register/cash-register.service';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    PaginatorModule,
    RadioButtonModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    LoadingStateComponent,
    MessageModule,
  ],
  providers: [MessageService],
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ExpensesService);
  private readonly catSvc = inject(ExpenseCategoriesService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  readonly fmt = inject(FormatService);
  isCashClosed = false;
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
  editingExpenseId: string | null = null;
  showSidePanel = false;
  readonly todayDate = new Date();

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

  private readonly categoryColorByName = new Map<string, string>();

  get periodTotal(): number {
    return this.rows.reduce((sum, e) => sum + e.amount, 0);
  }

  get periodMaxExpense(): Expense | null {
    if (!this.rows.length) return null;
    return this.rows.reduce((max, e) => (e.amount > max.amount ? e : max));
  }

  get periodMostFrequentMethod(): string {
    const cash = this.rows.filter((e) => e.paymentMethod === 'CASH').length;
    const transfer = this.rows.filter((e) => e.paymentMethod === 'TRANSFER').length;
    return cash >= transfer ? `Efectivo (${cash})` : `Transferencia (${transfer})`;
  }

  get currentMonthLabel(): string {
    return new Date().toLocaleString('es-AR', { month: 'long' });
  }

  /**
   * Indica si el formulario derecho está en modo edición.
   */
  get isEditMode(): boolean {
    return !!this.editingExpenseId;
  }

  /**
   * Devuelve un color único y estable para la categoría indicada, evitando repeticiones visuales.
   * @param categoryName nombre de la categoría
   */
  getCategoryBadgeColor(categoryName: string): string {
    if (!categoryName) return 'hsl(222 24% 46%)';
    const cached = this.categoryColorByName.get(categoryName);
    if (cached) return cached;

    const existing = new Set(this.categoryColorByName.values());
    const baseHue = this.hashToHue(categoryName);
    const hue = this.nextFreeHue(baseHue, existing);
    const color = `hsl(${hue} 72% 54%)`;
    this.categoryColorByName.set(categoryName, color);
    return color;
  }

  /**
   * Define el color de texto del badge de categoría para mantener buen contraste con el fondo.
   */
  getCategoryBadgeTextColor(categoryName: string): string {
    const bg = this.getCategoryBadgeColor(categoryName);
    return this.getBestContrastTextColor(bg);
  }

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
    this.checkCashRegisterStatus();
    this.loadCategories();
    this.load();
  }

  /**
   * Verifica el estado de cierre de caja del día actual.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;
      });
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
    this.resetForm();
  }

  /**
   * Resetea el formulario del panel lateral de registro de gastos.
   */
  resetForm(): void {
    this.showCatsPanel = false;
    this.editingExpenseId = null;
    this.createAmount = null;
    this.createDescription = '';
    this.createPaymentMethod = 'CASH';
    this.createTransferRef = '';
    this.createCategoryId = null;
    this.createExpenseDate = this.todayIso();
    this.createError = '';
    this.showSidePanel = true;
  }

  /**
   * Cierra el panel lateral y limpia el estado del formulario.
   */
  closeSidePanel(): void {
    this.showSidePanel = false;
    this.showCatsPanel = false;
    this.editingExpenseId = null;
    this.createAmount = null;
    this.createDescription = '';
    this.createPaymentMethod = 'CASH';
    this.createTransferRef = '';
    this.createCategoryId = null;
    this.createExpenseDate = this.todayIso();
    this.createError = '';
  }

  /**
   * Envía la solicitud para crear un nuevo gasto.
   * @returns
   */
  submitCreate(): void {
    if (
      !this.createAmount ||
      this.createAmount <= 0 ||
      !this.createDescription.trim() ||
      !this.createCategoryId
    )
      return;

    this.saving = true;
    this.createError = '';

    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;

        if (this.isCashClosed) {
          this.saving = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes crear gastos. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        if (this.isEditMode) {
          this.processUpdateExpense();
          return;
        }

        this.processCreateExpense();
      });
  }

  private processCreateExpense(): void {
    const payload: ExpenseCreatePayload = {
      amount: this.createAmount!,
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

    this.svc
      .create(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.resetForm();
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
   * Envía la actualización de un gasto existente usando los datos del formulario lateral.
   */
  private processUpdateExpense(): void {
    if (!this.editingExpenseId) {
      this.saving = false;
      return;
    }

    const payload: ExpenseCreatePayload = {
      amount: this.createAmount!,
      description: this.createDescription.trim(),
      paymentMethod: this.createPaymentMethod,
      expenseDate: this.createExpenseDate || undefined,
    };
    if (this.createPaymentMethod === 'TRANSFER' && this.createTransferRef.trim()) {
      payload.transferReference = this.createTransferRef.trim();
    }
    if (this.createCategoryId) {
      payload.categoryId = this.createCategoryId;
    }

    this.svc
      .update(this.editingExpenseId, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Gasto actualizado',
            detail: 'Los cambios se guardaron correctamente.',
          });
          this.resetForm();
          this.load();
        },
        error: (err: AppError) => {
          this.createError = err.message ?? 'No se pudo actualizar el gasto.';
        },
      });
  }

  /**
   * Carga un gasto en el formulario derecho para editarlo.
   * @param expense
   */
  selectExpense(expense: Expense): void {
    this.showSidePanel = true;
    this.showCatsPanel = false;
    this.editingExpenseId = expense.id;
    this.createAmount = expense.amount;
    this.createDescription = expense.description;
    this.createPaymentMethod = expense.paymentMethod;
    this.createTransferRef = expense.transferReference ?? '';
    this.createCategoryId = expense.categoryId;
    this.createExpenseDate = (expense.expenseDate || '').split('T')[0] || this.todayIso();
    this.createError = '';
  }

  /**
   * Abre confirmación para eliminar el gasto actualmente cargado en edición.
   */
  removeSelectedExpense(): void {
    if (!this.editingExpenseId) return;
    this.confirmDelete(this.editingExpenseId);
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
          const deletedId = this.deletingId;
          this.deletingId = null;
          if (deletedId && this.editingExpenseId === deletedId) {
            this.resetForm();
          }
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
    this.showSidePanel = this.showCatsPanel ? true : this.showSidePanel;
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

  /**
   * Convierte un texto en un tono base HSL determinista.
   * @param text texto a hashear
   */
  private hashToHue(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 360;
  }

  /**
   * Busca el siguiente tono disponible para evitar dos categorías con exactamente el mismo color.
   * @param seed hue inicial sugerido
   * @param existing colores ya utilizados
   */
  private nextFreeHue(seed: number, existing: Set<string>): number {
    let hue = seed;
    for (let i = 0; i < 36; i++) {
      const candidate = `hsl(${hue} 72% 54%)`;
      if (!existing.has(candidate)) return hue;
      hue = (hue + 47) % 360;
    }
    return seed;
  }

  /**
   * Elige automáticamente el color de texto (blanco o oscuro) con mejor contraste.
   * @param hslColor color de fondo en formato hsl(H S% L%)
   */
  private getBestContrastTextColor(hslColor: string): string {
    const rgb = this.hslToRgb(hslColor);
    if (!rgb) return '#ffffff';

    const white = { r: 255, g: 255, b: 255 };
    const dark = { r: 15, g: 23, b: 42 };

    const contrastWithWhite = this.getContrastRatio(rgb, white);
    const contrastWithDark = this.getContrastRatio(rgb, dark);

    return contrastWithDark >= contrastWithWhite ? '#0f172a' : '#ffffff';
  }

  /**
   * Convierte un color HSL a RGB para poder calcular contraste real.
   * @param hslColor color en formato hsl(H S% L%)
   */
  private hslToRgb(hslColor: string): { r: number; g: number; b: number } | null {
    const match = hslColor.match(/hsl\(\s*(\d+)\s+(\d+)%\s+(\d+)%\s*\)/i);
    if (!match) return null;

    const h = Number(match[1]) / 360;
    const s = Number(match[2]) / 100;
    const l = Number(match[3]) / 100;

    if (s === 0) {
      const gray = Math.round(l * 255);
      return { r: gray, g: gray, b: gray };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const hueToRgb = (t: number): number => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };

    return {
      r: Math.round(hueToRgb(h + 1 / 3) * 255),
      g: Math.round(hueToRgb(h) * 255),
      b: Math.round(hueToRgb(h - 1 / 3) * 255),
    };
  }

  /**
   * Calcula el ratio de contraste WCAG entre dos colores RGB.
   */
  private getContrastRatio(
    a: { r: number; g: number; b: number },
    b: { r: number; g: number; b: number },
  ): number {
    const la = this.relativeLuminance(a);
    const lb = this.relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Obtiene la luminancia relativa (sRGB) para métricas de contraste.
   */
  private relativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const normalize = (value: number): number => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };

    const r = normalize(rgb.r);
    const g = normalize(rgb.g);
    const b = normalize(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}
