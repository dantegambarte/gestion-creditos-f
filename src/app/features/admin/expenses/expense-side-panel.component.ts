import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { Subject, catchError, finalize, of, takeUntil } from 'rxjs';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { ExpenseCategory } from '../models/interface/expenses';
import { Expense, ExpenseCreatePayload } from './expense.model';
import { ExpensesService } from './expenses.service';
import { ExpenseCategoryManagerComponent } from './expense-category-manager.component';

@Component({
  selector: 'app-expense-side-panel',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    RadioButtonModule,
    ExpenseCategoryManagerComponent,
  ],
  templateUrl: './expense-side-panel.component.html',
})
export class ExpenseSidePanelComponent implements OnChanges, OnDestroy {
  /** Si true, muestra el panel de gestión de categorías en lugar del formulario. */
  @Input() showCats = false;
  /** Gasto a editar. null = modo creación. */
  @Input() expense: Expense | null = null;
  /** Categorías activas disponibles para el formulario y el filtro. */
  @Input() categories: ExpenseCategory[] = [];

  /** Stats del período para el resumen en el footer del panel. */
  @Input() periodTotal = 0;
  @Input() totalCount = 0;
  @Input() periodMax: Expense | null = null;
  @Input() periodMostFrequent = '';
  @Input() showStats = false;

  /** Emite cuando el usuario cierra el panel con el botón X. */
  @Output() closed = new EventEmitter<void>();
  /** Emite tras crear o editar un gasto con éxito. El padre recarga la lista. */
  @Output() saved = new EventEmitter<void>();
  /** Emite tras eliminar un gasto con éxito. El padre recarga la lista. */
  @Output() deleted = new EventEmitter<void>();
  /** Emite tras crear o cambiar el estado de una categoría. El padre recarga categorías. */
  @Output() categoriesChanged = new EventEmitter<void>();

  // ── Formulario ──────────────────────────────────────────────────
  createAmount: number | null = null;
  createDescription = '';
  createPaymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  createTransferRef = '';
  createCategoryId: string | null = null;
  createExpenseDate: string = this.todayIso();
  createError = '';
  editingExpenseId: string | null = null;
  saving = false;
  readonly todayDate = new Date();

  // ── Confirmación de eliminación ──────────────────────────────────
  showConfirmDelete = false;
  deletingId: string | null = null;
  deleting = false;

  private destroy$ = new Subject<void>();
  private readonly svc = inject(ExpensesService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  readonly fmt = inject(FormatService);

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  /** Indica si el formulario está en modo edición. */
  get isEditMode(): boolean {
    return !!this.editingExpenseId;
  }

  get categoryOptions(): { label: string; value: string | null }[] {
    return this.categories
      .filter((c) => c.active)
      .map((c) => ({ label: c.name, value: c.id as string | null }));
  }

  get createCategoryOptions(): { label: string; value: string | null }[] {
    return [{ label: 'Sin categoría', value: null }, ...this.categoryOptions];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expense']) {
      if (this.expense) {
        this.populateFromExpense(this.expense);
      } else {
        this.resetForm();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Cierra el panel emitiendo el evento al padre. */
  close(): void {
    this.closed.emit();
  }

  /** Resetea el formulario al estado de creación. */
  resetForm(): void {
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
   * Envía el formulario: crea o actualiza según el modo activo.
   * Verifica que la caja esté abierta antes de proceder.
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
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe((dashboard) => {
        const isCashClosed = dashboard?.isClosed ?? false;

        if (isCashClosed) {
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

  /**
   * Abre el diálogo de confirmación de eliminación para el gasto en edición.
   */
  removeSelectedExpense(): void {
    if (!this.editingExpenseId) return;
    this.deletingId = this.editingExpenseId;
    this.showConfirmDelete = true;
  }

  /** Ejecuta la eliminación del gasto confirmado. */
  doDelete(): void {
    if (!this.deletingId) return;
    this.deleting = true;
    this.svc
      .remove(this.deletingId)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.deleting = false)))
      .subscribe({
        next: () => {
          this.showConfirmDelete = false;
          this.deletingId = null;
          this.resetForm();
          this.msg.add({ severity: 'success', summary: 'Eliminado', detail: 'Gasto eliminado.' });
          this.deleted.emit();
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

  private processCreateExpense(): void {
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
      .create(payload)
      .pipe(takeUntil(this.destroy$), finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.resetForm();
          this.msg.add({
            severity: 'success',
            summary: 'Gasto registrado',
            detail: 'El gasto fue registrado correctamente.',
          });
          this.saved.emit();
        },
        error: (err: AppError) => {
          this.createError = err.message ?? 'No se pudo registrar el gasto.';
        },
      });
  }

  /** Actualiza el gasto actualmente en edición. */
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
      .pipe(takeUntil(this.destroy$), finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Gasto actualizado',
            detail: 'Los cambios se guardaron correctamente.',
          });
          this.resetForm();
          this.saved.emit();
        },
        error: (err: AppError) => {
          this.createError = err.message ?? 'No se pudo actualizar el gasto.';
        },
      });
  }

  private populateFromExpense(expense: Expense): void {
    this.editingExpenseId = expense.id;
    this.createAmount = expense.amount;
    this.createDescription = expense.description;
    this.createPaymentMethod = expense.paymentMethod;
    this.createTransferRef = expense.transferReference ?? '';
    this.createCategoryId = expense.categoryId;
    this.createExpenseDate = (expense.expenseDate || '').split('T')[0] || this.todayIso();
    this.createError = '';
  }

  private todayIso(): string {
    return new Date().toISOString().split('T')[0];
  }
}
