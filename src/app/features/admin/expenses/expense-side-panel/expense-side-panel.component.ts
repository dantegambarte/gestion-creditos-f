import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
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
import { Subject, catchError, finalize, of, switchMap, takeUntil } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { DateService } from '../../../../core/services/date.service';
import { FormatService } from '../../../../core/services/format.service';
import { CashRegisterService } from '../../cash-register/cash-register.service';
import {
  CashSession,
  CashSessionSnapshot,
} from '../../models/cash-session.model';
import { ExpenseCategory } from '../../models/interface/expenses';
import { ExpenseCategoryManagerComponent } from '../expense-category-manager/expense-category-manager.component';
import { Expense, ExpenseCreatePayload } from '../expense.model';
import { ExpensesService } from '../expenses.service';

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
export class ExpenseSidePanelComponent implements OnInit, OnChanges, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly svc = inject(ExpensesService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);
  readonly fmt = inject(FormatService);
  private readonly dateSvc = inject(DateService);

  /** Si true, muestra el panel de gestión de categorías en lugar del formulario. */
  @Input() showCats = false;
  /** Gasto a editar. null = modo creación. */
  @Input() expense: Expense | null = null;
  /** Categorías activas disponibles para el formulario y el filtro. */
  @Input() categories: ExpenseCategory[] = [];

  /**
   * Estado de caja ya cargado por el padre (ej. cash-register.component, que
   * lo mantiene en signals propios). Si se provee (incluso `null`), el panel
   * lo usa directamente y se salta su propio fetch de getActiveSession /
   * getSessionSnapshot / getCashAccounts — evita pedir lo mismo dos veces en
   * la misma carga de página. `undefined` (default) = no provisto, el panel
   * lo pide por su cuenta (caso de uso standalone en /admin/expenses).
   */
  @Input() activeSessionOverride?: CashSession | null;
  @Input() sessionSnapshotOverride?: CashSessionSnapshot | null;
  @Input() generalCashBalanceOverride?: number | null;

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
  createSource: 'DAILY' | 'COMPANY' = 'DAILY';
  createError = '';
  /** Efectivo disponible en la caja activa de la jornada (null = no cargó aún). */
  dailyAvailable: number | null = null;
  /**
   * True si hay una caja operativa OPEN. Si es false, "Caja del día" no es una
   * opción válida. Default optimista en true: hasta que loadAvailableAmounts()
   * resuelva, asumimos que puede existir sesión (evita forzar COMPANY de
   * arranque si el diálogo abre antes de que la llamada a getActiveSession
   * complete).
   */
  hasActiveSession = true;
  /** Saldo actual de Caja General (cuenta GENERAL_CASH). */
  generalAvailable: number | null = null;
  editingExpenseId: string | null = null;
  saving = false;
  // ── Confirmación de eliminación ──────────────────────────────────
  showConfirmDelete = false;
  deletingId: string | null = null;
  deleting = false;

  readonly todayDate: Date = this.dateSvc.startOfToday();

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  readonly sourceOptions = [
    { label: 'Caja del día', value: 'DAILY' },
    { label: 'Caja General', value: 'COMPANY' },
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

  ngOnInit(): void {
    if (this.activeSessionOverride !== undefined) {
      this.applySessionOverride();
    } else {
      this.loadActiveSessionInfo();
    }
    if (this.generalCashBalanceOverride !== undefined) {
      this.generalAvailable = this.generalCashBalanceOverride;
    } else {
      this.loadGeneralAvailable();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expense']) {
      if (this.expense) {
        this.populateFromExpense(this.expense);
      } else {
        this.resetForm();
      }
    }
    if (
      changes['activeSessionOverride'] ||
      changes['sessionSnapshotOverride']
    ) {
      this.applySessionOverride();
    }
    if (changes['generalCashBalanceOverride']) {
      this.generalAvailable = this.generalCashBalanceOverride ?? null;
    }
  }

  /**
   * Aplica el estado de caja provisto por el padre (ver activeSessionOverride).
   * Resincroniza createSource en cada actualización (no solo cuando pasa a
   * sin-sesión) porque el override puede llegar en `null` en el primer change
   * detection (antes de que resuelva el fetch real del padre) y corregirse
   * recién después — si solo forzáramos COMPANY al quedar sin sesión, nunca
   * volveríamos a DAILY cuando la sesión real aparece.
   */
  private applySessionOverride(): void {
    this.hasActiveSession = !!this.activeSessionOverride;
    this.dailyAvailable = this.sessionSnapshotOverride?.expected.cash ?? null;
    if (!this.isEditMode) {
      this.createSource = this.hasActiveSession ? 'DAILY' : 'COMPANY';
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
    this.createSource = this.hasActiveSession ? 'DAILY' : 'COMPANY';
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
      !this.createDescription.trim()
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
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.deleting = false)),
      )
      .subscribe({
        next: () => {
          this.showConfirmDelete = false;
          this.deletingId = null;
          this.resetForm();
          this.msg.add({
            severity: 'success',
            summary: 'Eliminado',
            detail: 'Gasto eliminado.',
          });
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
    if (
      this.createPaymentMethod === 'TRANSFER' &&
      this.createTransferRef.trim()
    ) {
      payload.transferReference = this.createTransferRef.trim();
    }
    if (this.createCategoryId) {
      payload.categoryId = this.createCategoryId;
    }
    payload.source = this.createSource;

    this.svc
      .create(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.saving = false)),
      )
      .subscribe({
        next: () => {
          this.resetForm();
          // Si el padre provee el estado de caja (override), su propio
          // refresh tras el evento "saved" actualiza estos @Input y dispara
          // ngOnChanges → applySessionOverride(). Si no, lo pedimos acá.
          if (this.activeSessionOverride === undefined) {
            this.loadActiveSessionInfo();
          }
          if (this.generalCashBalanceOverride === undefined) {
            this.loadGeneralAvailable();
          }
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
    this.createExpenseDate =
      (expense.expenseDate || '').split('T')[0] || this.todayIso();
    this.createSource = expense.source;
    this.createError = '';
  }

  /**
   * Carga el efectivo disponible en la caja activa y el saldo de Caja General,
   * para mostrarlos como referencia bajo el selector de "Origen del gasto".
   * Si no hay caja activa, fuerza el origen a Caja General (única opción viable).
   */
  /**
   * Pide la sesión activa y su snapshot directamente (caso standalone, sin
   * activeSessionOverride provisto por el padre).
   */
  private loadActiveSessionInfo(): void {
    this.cashRegisterSvc
      .getActiveSession()
      .pipe(
        switchMap((session) => {
          this.hasActiveSession = !!session;
          if (!session) this.createSource = 'COMPANY';
          return session
            ? this.cashRegisterSvc.getSessionSnapshot(session.id)
            : of(null);
        }),
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe((snapshot) => {
        this.dailyAvailable = snapshot?.expected.cash ?? null;
      });
  }

  /** Pide el saldo de Caja General directamente (caso standalone). */
  private loadGeneralAvailable(): void {
    this.cashRegisterSvc
      .getCashAccounts()
      .pipe(
        catchError(() => of([])),
        takeUntil(this.destroy$),
      )
      .subscribe((accounts) => {
        const general = accounts.find((a) => a.type === 'GENERAL_CASH');
        this.generalAvailable = general?.current_balance ?? null;
      });
  }

  private todayIso(): string {
    return this.dateSvc.toLocalIso(new Date());
  }
}
