import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { Subject, interval, of } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { CurrencyAmountInputDirective } from '../../../shared/directives/currency-amount-input.directive';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { ExpenseCategoriesService } from '../expenses/expense-categories.service';
import { ExpenseSidePanelComponent } from '../expenses/expense-side-panel/expense-side-panel.component';
import { ActiveBusinessDay } from '../models/business-day.model';
import {
  CashConversionPayload,
  CashRegisterDashboard,
  CashRegisterMovement,
  CashRegisterMovementType,
} from '../models/cash-register.model';
import { CashSession, CashSessionSnapshot } from '../models/cash-session.model';
import { ExpenseCategory } from '../models/interface/expenses';
import { CashRegisterService } from './cash-register.service';
import { CashSessionCloseDialogComponent } from './cash-session-close-dialog/cash-session-close-dialog.component';
import { CashSessionOpenDialogComponent } from './cash-session-open-dialog/cash-session-open-dialog.component';
import { CashSessionSnapshotDialogComponent } from './cash-session-snapshot-dialog/cash-session-snapshot-dialog.component';

type MovementTypeFilter = 'TODOS' | CashRegisterMovementType;
type MovementMethodFilter = 'TODOS' | 'EFECTIVO' | 'TRANSFERENCIA';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    RadioButtonModule,
    ToastModule,
    SkeletonModule,
    CurrencyAmountInputDirective,
    LoadingStateComponent,
    ErrorStateComponent,
    CashSessionOpenDialogComponent,
    CashSessionCloseDialogComponent,
    CashSessionSnapshotDialogComponent,
    ExpenseSidePanelComponent,
  ],
  providers: [MessageService],
  templateUrl: './cash-register.component.html',
  styleUrl: './cash-register.component.scss',
})
export class CashRegisterComponent implements OnInit, OnDestroy {
  private readonly service = inject(CashRegisterService);
  private readonly expenseCategoryService = inject(ExpenseCategoriesService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  private readonly router = inject(Router);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  readonly dashboard = signal<CashRegisterDashboard | null>(null);
  readonly loadingDashboard = signal(true);
  readonly errorDashboard = signal<AppError | null>(null);

  readonly movements = signal<CashRegisterMovement[]>([]);
  readonly loadingMovements = signal(false);
  readonly errorMovements = signal<AppError | null>(null);
  readonly showMovementsDialog = signal(false);
  readonly movementTypeFilter = signal<MovementTypeFilter>('TODOS');
  readonly movementMethodFilter = signal<MovementMethodFilter>('TODOS');
  readonly movementPage = signal(1);
  readonly movementRows = 10;

  readonly activeBusinessDay = signal<ActiveBusinessDay | null>(null);
  readonly activeSession = signal<CashSession | null>(null);
  /** Snapshot V4 (cash/transfer desglosado) de la única caja de la jornada. */
  readonly sessionSnapshot = signal<CashSessionSnapshot | null>(null);
  readonly loadingJornada = signal(false);
  readonly errorJornada = signal<AppError | null>(null);
  readonly closingJornada = signal(false);

  readonly showOpenSessionDialog = signal(false);
  readonly showCloseSessionDialog = signal(false);
  readonly showSnapshotDialog = signal(false);
  readonly selectedSessionId = signal<string | null>(null);

  readonly showConversionDialog = signal(false);
  readonly conversionCriteria = signal<'DAILY' | 'COMPANY'>('DAILY');
  readonly conversionSourceMethod = signal<'CASH' | 'TRANSFER'>('CASH');
  readonly conversionAmount = signal<number | null>(null);
  readonly conversionNotes = signal('');
  readonly conversionValidationError = signal('');
  readonly conversionSubmitting = signal(false);
  /** Saldo actual de Caja General (cuenta GENERAL_CASH), para la conversión COMPANY. */
  readonly generalCashBalance = signal<number | null>(null);

  readonly showManualIncomeDialog = signal(false);
  /** Destino del ingreso: caja operativa de la jornada o Caja General directa. */
  readonly manualIncomeCriteria = signal<'DAILY' | 'COMPANY'>('DAILY');
  readonly manualIncomeAmount = signal<number | null>(null);
  readonly manualIncomePaymentMethod = signal<'CASH' | 'TRANSFER' | 'MIXED'>(
    'CASH',
  );
  readonly manualIncomeCashAmount = signal<number | null>(null);
  readonly manualIncomeTransferAmount = signal<number | null>(null);
  readonly manualIncomeDescription = signal('');
  readonly manualIncomeReference = signal('');
  readonly manualIncomeValidationError = signal('');
  readonly manualIncomeSubmitting = signal(false);

  readonly showExpenseDialog = signal(false);
  readonly expenseCategories = signal<ExpenseCategory[]>([]);

  readonly conversionSourceOptions = [
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
  ];

  readonly conversionCriteriaOptions = [
    { label: 'Caja del día', value: 'DAILY' as const },
    { label: 'Caja General', value: 'COMPANY' as const },
  ];

  readonly manualIncomeMethodOptions = [
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
    { label: 'Efectivo + transferencia', value: 'MIXED' as const },
  ];

  readonly movementTypeOptions = [
    { label: 'Todos', value: 'TODOS' as const },
    { label: 'INGRESO', value: 'INGRESO' as const },
    { label: 'EGRESO', value: 'EGRESO' as const },
    { label: 'CONVERSION', value: 'CONVERSION' as const },
  ];

  readonly movementMethodOptions = [
    { label: 'Todos', value: 'TODOS' as const },
    { label: 'EFECTIVO', value: 'EFECTIVO' as const },
    { label: 'TRANSFERENCIA', value: 'TRANSFERENCIA' as const },
  ];

  readonly operationsDisabled = computed(() => !this.activeBusinessDay());

  /** True cuando el dashboard muestra una jornada de un día anterior a hoy (post-medianoche). */
  readonly isPostMidnightJornada = computed(() => {
    const d = this.dashboard();
    if (!d) return false;
    const today = new Date().toISOString().split('T')[0];
    return d.date < today;
  });

  /** Esperado en caja (efectivo + transferencia) según el snapshot V4 de la única sesión de la jornada. */
  readonly dailyExpected = computed<{ cash: number; transfer: number }>(() => {
    const snap = this.sessionSnapshot();
    return snap ? snap.expected : { cash: 0, transfer: 0 };
  });

  /** Total de cobros (pagos + enganches + ingresos manuales), separado por método. */
  readonly dailyIncomeTotals = computed<{ cash: number; transfer: number }>(
    () => {
      const snap = this.sessionSnapshot();
      if (!snap) return { cash: 0, transfer: 0 };
      const c = snap.collections;
      return {
        cash: c.payments.cash + c.down_payments.cash + c.manual_incomes.cash,
        transfer:
          c.payments.transfer +
          c.down_payments.transfer +
          c.manual_incomes.transfer,
      };
    },
  );

  /** Total de egresos (gastos + comisiones), separado por método. */
  readonly dailyOutflowTotals = computed<{ cash: number; transfer: number }>(
    () => {
      const snap = this.sessionSnapshot();
      if (!snap) return { cash: 0, transfer: 0 };
      const o = snap.outflows;
      return {
        cash: o.expenses.cash + o.commissions.cash,
        transfer: o.expenses.transfer + o.commissions.transfer,
      };
    },
  );

  /** Delta neto de conversiones internas efectivo↔transferencia de la jornada. */
  readonly dailyConversions = computed<{ cash: number; transfer: number }>(
    () => {
      const snap = this.sessionSnapshot();
      return snap
        ? { cash: snap.conversions.cash_delta, transfer: snap.conversions.transfer_delta }
        : { cash: 0, transfer: 0 };
    },
  );

  readonly estimatedBalance = computed(() => {
    const e = this.dailyExpected();
    return e.cash + e.transfer;
  });

  /**
   * Dinero contado en el último arqueo de cierre de la caja activa.
   * Null si la caja sigue OPEN sin arquear todavía.
   */
  readonly cashCounted = computed<number | null>(
    () => this.activeSession()?.cash_counted ?? null,
  );

  /**
   * Diferencia entre lo contado y el saldo estimado. Null si no hay arqueo
   * registrado todavía (la caja sigue OPEN sin contar).
   */
  readonly currentDifference = computed<number | null>(() => {
    const counted = this.cashCounted();
    if (counted === null) return null;
    return counted - this.estimatedBalance();
  });

  /** Tono visual de la diferencia: cuadrada (success), falta (danger), sobra (warning) o sin arqueo (neutral). */
  readonly differenceTone = computed<
    'neutral' | 'success' | 'danger' | 'warning'
  >(() => {
    const diff = this.currentDifference();
    if (diff === null) return 'neutral';
    if (diff === 0) return 'success';
    return diff < 0 ? 'danger' : 'warning';
  });

  /**
   * Cards de resumen: Saldo Total Empresa (Caja General, real) y Saldo del
   * Día (única caja de la jornada, efectivo y transferencia separados).
   * Ya no mezcla fuentes legacy con V4 — ver discusión del bug original.
   */
  readonly summaryCards = computed(() => {
    const general = this.generalCashBalance() ?? 0;
    const daily = this.dailyExpected();

    return [
      {
        label: 'Saldo Total Empresa',
        value: general,
        kind: 'company',
        tone: general >= 0 ? 'success' : 'danger',
        hint: 'Caja General — tesorería consolidada',
      },
      {
        label: 'Saldo del Día · Efectivo',
        value: daily.cash,
        kind: 'cash',
        tone: daily.cash >= 0 ? 'success' : 'danger',
        hint: 'Esperado en efectivo de la caja de hoy',
      },
      {
        label: 'Saldo del Día · Transferencia',
        value: daily.transfer,
        kind: 'transfer',
        tone: daily.transfer >= 0 ? 'success' : 'danger',
        hint: 'Esperado en transferencia de la caja de hoy',
      },
    ];
  });

  readonly conversionTargetMethod = computed<'CASH' | 'TRANSFER'>(() =>
    this.conversionSourceMethod() === 'CASH' ? 'TRANSFER' : 'CASH',
  );

  readonly conversionSourceAvailable = computed(() => {
    if (this.conversionCriteria() === 'COMPANY') {
      return this.generalCashBalance() ?? 0;
    }
    const expected = this.dailyExpected();
    return this.conversionSourceMethod() === 'CASH'
      ? expected.cash
      : expected.transfer;
  });

  /** True si el monto ingresado supera el disponible del origen seleccionado. */
  readonly conversionExceedsAvailable = computed(() => {
    const amount = this.conversionAmount();
    return amount !== null && amount > this.conversionSourceAvailable();
  });

  readonly canSubmitConversion = computed(() => {
    const amount = this.conversionAmount();
    return !!(
      amount &&
      amount > 0 &&
      amount <= this.conversionSourceAvailable() &&
      !this.conversionSubmitting()
    );
  });

  readonly previewMovements = computed(() => this.movements().slice(0, 5));

  readonly filteredMovements = computed(() => {
    const type = this.movementTypeFilter();
    const method = this.movementMethodFilter();
    return this.movements().filter((movement) => {
      const matchesType = type === 'TODOS' || movement.tipo === type;
      const matchesMethod =
        method === 'TODOS' || movement.metodoPago.includes(method);
      return matchesType && matchesMethod;
    });
  });

  readonly movementTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredMovements().length / this.movementRows)),
  );

  readonly pagedMovements = computed(() => {
    const page = Math.min(this.movementPage(), this.movementTotalPages());
    const start = (page - 1) * this.movementRows;
    return this.filteredMovements().slice(start, start + this.movementRows);
  });

  /** True si la jornada quedó lista para el cierre formal (sin cajas OPEN/PENDING). */
  private isBusinessDayReadyToClose(
    businessDay: ActiveBusinessDay | null,
  ): boolean {
    if (!businessDay) return false;
    if (businessDay.status !== 'READY_TO_CLOSE') return false;
    const counts = businessDay.session_counts;
    return (
      counts.open_count === 0 &&
      counts.pending_count === 0 &&
      counts.total_count > 0
    );
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Caja' }]);
    this.loadExpenseCategories();
    this.loadDashboard();
    this.loadJornadaState();
    this.loadGeneralCashBalance();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Inicia el polling para actualizar el dashboard cada minuto.
   */
  private startPolling(): void {
    interval(60_000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.service.getDashboard()),
      )
      .subscribe({
        next: (d) => {
          this.dashboard.set(d);
        },
      });
  }

  /**
   * Carga los datos del dashboard desde el servidor.
   */
  loadDashboard(): void {
    this.loadingDashboard.set(true);
    this.errorDashboard.set(null);
    this.service
      .getDashboard()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingDashboard.set(false);
        }),
      )
      .subscribe({
        next: (d) => {
          this.dashboard.set(d);
        },
        error: (err: AppError) => {
          this.errorDashboard.set(err);
        },
      });
  }

  /**
   * Carga la fuente temporal de movimientos de caja hasta tener el endpoint
   * unificado de movimientos de jornada.
   */
  loadMovements(sessionId = this.activeSession()?.id ?? null): void {
    if (!sessionId) {
      this.movements.set([]);
      this.loadingMovements.set(false);
      this.errorMovements.set(null);
      return;
    }
    this.loadingMovements.set(true);
    this.errorMovements.set(null);
    this.service
      .getSessionMovements(sessionId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingMovements.set(false);
        }),
      )
      .subscribe({
        next: (movements) => {
          this.movements.set(movements);
          this.movementPage.set(1);
        },
        error: (err: AppError) => {
          this.errorMovements.set(err);
        },
      });
  }

  /**
   * Abre la vista dedicada de auditoría de movimientos desde el preview.
   */
  openMovementsDialog(): void {
    this.movementPage.set(1);
    this.showMovementsDialog.set(true);
  }

  /**
   * Filtra la vista expandida por tipo y vuelve a la primera página.
   * @param value - Tipo de movimiento o TODOS.
   */
  setMovementTypeFilter(value: MovementTypeFilter): void {
    this.movementTypeFilter.set(value);
    this.movementPage.set(1);
  }

  /**
   * Filtra la vista expandida por método de pago y vuelve a la primera página.
   * @param value - Método de pago o TODOS.
   */
  setMovementMethodFilter(value: MovementMethodFilter): void {
    this.movementMethodFilter.set(value);
    this.movementPage.set(1);
  }

  /**
   * Avanza una página en la vista expandida sin exceder el total disponible.
   */
  nextMovementPage(): void {
    this.movementPage.set(
      Math.min(this.movementPage() + 1, this.movementTotalPages()),
    );
  }

  /**
   * Retrocede una página en la vista expandida sin bajar de la primera.
   */
  previousMovementPage(): void {
    this.movementPage.set(Math.max(1, this.movementPage() - 1));
  }

  /**
   * Carga categorías activas para el alta rápida de gastos desde Caja.
   */
  loadExpenseCategories(): void {
    this.expenseCategoryService
      .getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => this.expenseCategories.set(categories),
        error: (err: AppError) => {
          this.msg.add({
            severity: 'error',
            summary: 'No se pudieron cargar categorías',
            detail:
              err.message || 'Intentá nuevamente antes de registrar un gasto.',
          });
        },
      });
  }

  /**
   * Abre el alta rápida de ingreso manual sin crear una operación comercial.
   */
  openManualIncomeDialog(): void {
    this.manualIncomeCriteria.set(this.activeSession() ? 'DAILY' : 'COMPANY');
    this.manualIncomeAmount.set(null);
    this.manualIncomePaymentMethod.set('CASH');
    this.manualIncomeCashAmount.set(null);
    this.manualIncomeTransferAmount.set(null);
    this.manualIncomeDescription.set('');
    this.manualIncomeReference.set('');
    this.manualIncomeValidationError.set('');
    this.showManualIncomeDialog.set(true);
  }

  /**
   * Registra una entrada manual: en la caja operativa de la jornada (DAILY)
   * o directo en Caja General (COMPANY), sin depender de ninguna sesión.
   */
  submitManualIncome(): void {
    this.manualIncomeValidationError.set('');
    const criteria = this.manualIncomeCriteria();
    const session = this.activeSession();
    const amount = this.manualIncomeAmount();
    const amountCash = this.manualIncomeCashAmount() ?? 0;
    const amountTransfer = this.manualIncomeTransferAmount() ?? 0;
    const description = this.manualIncomeDescription().trim();
    if (criteria === 'DAILY' && !session) {
      this.manualIncomeValidationError.set(
        'No hay una caja abierta para imputar el ingreso.',
      );
      return;
    }
    if (!amount || amount <= 0) {
      this.manualIncomeValidationError.set('Ingresá un monto mayor a 0.');
      return;
    }
    if (
      this.manualIncomePaymentMethod() === 'MIXED' &&
      (amountCash <= 0 ||
        amountTransfer <= 0 ||
        Math.round((amountCash + amountTransfer) * 100) !==
          Math.round(amount * 100))
    ) {
      this.manualIncomeValidationError.set(
        'El efectivo y la transferencia deben ser mayores a 0 y sumar el monto total.',
      );
      return;
    }
    if (description.length < 3) {
      this.manualIncomeValidationError.set(
        'Ingresá un concepto de al menos 3 caracteres.',
      );
      return;
    }

    const paymentMethod = this.manualIncomePaymentMethod();
    const splitByMethod: Record<
      'CASH' | 'TRANSFER' | 'MIXED',
      { amountCash: number; amountTransfer: number }
    > = {
      CASH: { amountCash: amount, amountTransfer: 0 },
      TRANSFER: { amountCash: 0, amountTransfer: amount },
      MIXED: { amountCash, amountTransfer },
    };

    this.manualIncomeSubmitting.set(true);
    const request$ =
      criteria === 'COMPANY'
        ? this.service.createManualIncomeCompany({
            amount,
            ...splitByMethod[paymentMethod],
            description,
            receiptReference: this.manualIncomeReference().trim() || undefined,
          })
        : this.service.createManualIncome(session!.id, {
            amount,
            ...(paymentMethod === 'MIXED'
              ? { amountCash, amountTransfer }
              : { paymentMethod }),
            description,
            receiptReference: this.manualIncomeReference().trim() || undefined,
          });

    request$
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.manualIncomeSubmitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Ingreso registrado',
            detail:
              criteria === 'COMPANY'
                ? 'La entrada manual se imputó a Caja General.'
                : 'La entrada manual se imputó a la caja activa.',
          });
          this.showManualIncomeDialog.set(false);
          this.onJornadaStateChanged();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo registrar',
            detail:
              err.message || 'Ocurrió un error al registrar el ingreso manual.',
          });
        },
      });
  }

  /**
   * Abre el alta rápida de gastos sin sacar al usuario del flujo de Caja.
   */
  openExpenseDialog(): void {
    this.showExpenseDialog.set(true);
  }

  /**
   * Cierra el alta rápida de gastos embebida en Caja.
   */
  closeExpenseDialog(): void {
    this.showExpenseDialog.set(false);
  }

  /**
   * Refresca Caja luego de registrar un gasto desde el modal contextual.
   */
  onExpenseSaved(): void {
    this.showExpenseDialog.set(false);
    this.onJornadaStateChanged();
  }

  /**
   * Abre el diálogo de conversión entre efectivo y transferencia.
   */
  openConversionDialog(): void {
    this.conversionCriteria.set(this.activeSession() ? 'DAILY' : 'COMPANY');
    this.conversionSourceMethod.set('CASH');
    this.conversionAmount.set(null);
    this.conversionNotes.set('');
    this.conversionValidationError.set('');
    this.showConversionDialog.set(true);

    this.service
      .getCashAccounts()
      .pipe(
        catchError(() => of([])),
        takeUntil(this.destroy$),
      )
      .subscribe((accounts) => {
        const general = accounts.find((a) => a.type === 'GENERAL_CASH');
        this.generalCashBalance.set(general?.current_balance ?? null);
      });
  }

  /**
   * Devuelve la etiqueta visible para un método interno de pago.
   * @param method - Método CASH o TRANSFER.
   */
  paymentMethodLabel(method: 'CASH' | 'TRANSFER'): string {
    return method === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  /**
   * Registra una conversión de dinero y refresca los saldos de la jornada.
   */
  submitConversion(): void {
    this.conversionValidationError.set('');
    const amount = this.conversionAmount();
    if (!amount || amount <= 0) {
      this.conversionValidationError.set('Ingresá un monto mayor a 0.');
      return;
    }
    if (amount > this.conversionSourceAvailable()) {
      this.conversionValidationError.set(
        'El monto supera el disponible del método seleccionado.',
      );
      return;
    }
    if (!this.canSubmitConversion()) return;

    const payload: CashConversionPayload = {
      criteria: this.conversionCriteria(),
      sourceMethod: this.conversionSourceMethod(),
      amount,
      notes: this.conversionNotes().trim() || undefined,
      registerDate: this.dashboard()?.date,
    };

    this.conversionSubmitting.set(true);
    this.service
      .createConversion(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.conversionSubmitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.msg.add({
            severity: 'success',
            summary: 'Conversión registrada',
            detail: 'El dinero se convirtió correctamente.',
          });
          this.showConversionDialog.set(false);
          this.onJornadaStateChanged();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo convertir',
            detail:
              err.message || 'Ocurrió un error al registrar la conversión.',
          });
        },
      });
  }

  /**
   * Devuelve clases Dark Premium para el badge del tipo de movimiento.
   * @param tipo - Tipo unificado devuelto por el backend.
   */
  movementTypeClass(tipo: CashRegisterMovementType): string {
    if (tipo === 'INGRESO')
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    if (tipo === 'EGRESO')
      return 'border-red-400/30 bg-red-500/10 text-red-300';
    return 'border-blue-400/30 bg-blue-500/10 text-blue-300';
  }

  /**
   * Devuelve clases de monto según el tipo de movimiento.
   * @param tipo - Tipo unificado devuelto por el backend.
   */
  movementAmountClass(tipo: CashRegisterMovementType): string {
    if (tipo === 'INGRESO') return 'text-emerald-300';
    if (tipo === 'EGRESO') return 'text-red-300';
    return 'text-blue-300';
  }

  /**
   * Devuelve el signo visual para la columna de monto.
   * @param tipo - Tipo unificado devuelto por el backend.
   */
  movementAmountPrefix(tipo: CashRegisterMovementType): string {
    if (tipo === 'INGRESO') return '+';
    if (tipo === 'EGRESO') return '-';
    return '';
  }

  /**
   * Formatea un valor como moneda.
   * @param value monto a formatear
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha en el formato dd/mm/yyyy.
   * @param iso fecha en formato ISO
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const d = iso.split('T')[0].split('-');
    return `${d[2]}/${d[1]}/${d[0]}`;
  }

  /**
   * Formatea una fecha ISO con hora en el formato dd/mm/yyyy HH:mm.
   * @param iso fecha con hora en formato ISO
   */
  formatDateTime(iso: string): string {
    if (!iso) return '—';
    const dt = new Date(iso);
    const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
    const time = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${date} ${time}`;
  }

  /**
   * V4: carga jornada activa + caja activa en paralelo. Se llama en ngOnInit
   * y después de cada acción (abrir/cerrar caja, drop) para que la UI no
   * quede desincronizada.
   */
  /**
   * Navega al reporte histórico de cajas (tab "Cajas" en Reportes), con
   * retorno contextual a la pantalla de Caja.
   */
  goToCashSessionsReport(): void {
    this.router.navigate(['/admin/reports'], {
      queryParams: { tab: 'cashSessions', returnTo: '/admin/cash-register' },
    });
  }

  loadJornadaState(): void {
    this.loadingJornada.set(true);
    this.errorJornada.set(null);
    this.service
      .refreshJornadaState()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingJornada.set(false)),
      )
      .subscribe({
        next: ({ businessDay, activeSession }) => {
          this.activeBusinessDay.set(businessDay);
          this.activeSession.set(activeSession);
          this.loadMovements(activeSession?.id ?? null);
          this.loadSessionSnapshot(activeSession?.id ?? null);
        },
        error: (err: AppError) => {
          this.errorJornada.set(err);
        },
      });
  }

  /**
   * Carga el snapshot V4 (desglose efectivo/transferencia) de la única caja
   * de la jornada. null si no hay caja activa.
   */
  loadSessionSnapshot(sessionId = this.activeSession()?.id ?? null): void {
    if (!sessionId) {
      this.sessionSnapshot.set(null);
      return;
    }
    this.service
      .getSessionSnapshot(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (snapshot) => this.sessionSnapshot.set(snapshot),
        error: () => this.sessionSnapshot.set(null),
      });
  }

  /** Carga el saldo actual de Caja General (tesorería consolidada). */
  loadGeneralCashBalance(): void {
    this.service
      .getCashAccounts()
      .pipe(
        catchError(() => of([])),
        takeUntil(this.destroy$),
      )
      .subscribe((accounts) => {
        const general = accounts.find((a) => a.type === 'GENERAL_CASH');
        this.generalCashBalance.set(general?.current_balance ?? null);
      });
  }

  // ── Acciones sobre la caja operativa V4 ─────────────────────────────────

  /**
   * Abre el diálogo de apertura de caja para la jornada activa.
   */
  openOpenSessionDialog(): void {
    this.showOpenSessionDialog.set(true);
  }

  /**
   * Abre el diálogo de cierre para la caja activa, si existe.
   */
  openCloseSessionDialog(): void {
    const session = this.activeSession();
    if (!session) return;
    this.selectedSessionId.set(session.id);
    this.showCloseSessionDialog.set(true);
  }

  /**
   * Abre el snapshot de la caja activa para consultar el estado en vivo.
   */
  openSnapshotDialog(): void {
    const session = this.activeSession();
    if (!session) return;
    this.selectedSessionId.set(session.id);
    this.showSnapshotDialog.set(true);
  }

  /**
   * Refresca jornada, dashboard y movimientos después de operar la caja.
   */
  onJornadaStateChanged(): void {
    this.loadJornadaState();
    this.loadDashboard();
    this.loadGeneralCashBalance();
  }

  // ── Cierre unificado: caja + jornada en una sola acción ─────────────────

  /**
   * Tras cerrar la caja operativa, encadena automáticamente el cierre formal
   * de la jornada (este negocio opera con una sola caja por jornada, así que
   * el cierre de caja siempre deja la jornada en READY_TO_CLOSE).
   */
  onSessionClosed(): void {
    this.closingJornada.set(true);
    this.service
      .refreshJornadaState()
      .pipe(
        switchMap(({ businessDay, activeSession }) => {
          this.activeBusinessDay.set(businessDay);
          this.activeSession.set(activeSession);
          this.loadMovements(activeSession?.id ?? null);
          this.loadSessionSnapshot(activeSession?.id ?? null);
          return this.isBusinessDayReadyToClose(businessDay)
            ? this.service.closeBusinessDay(businessDay!.id)
            : of(null);
        }),
        finalize(() => this.closingJornada.set(false)),
      )
      .subscribe({
        next: (result) => {
          if (result !== null) {
            this.msg.add({
              severity: 'success',
              summary: 'Jornada cerrada',
              detail: 'La jornada quedó cerrada formalmente.',
            });
            this.loadJornadaState();
          }
          this.loadDashboard();
          this.loadGeneralCashBalance();
        },
        error: (err: AppError) => {
          this.errorJornada.set(err);
          this.loadDashboard();
        },
      });
  }

  // ── Helpers de UI para Jornada Actual ───────────────────────────────────

  /** Etiqueta legible del status de jornada. */
  businessDayStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'Abierta';
      case 'READY_TO_CLOSE':
        return 'Lista para cerrar';
      case 'CLOSED':
        return 'Cerrada';
      case 'AUDITED':
        return 'Auditada';
      default:
        return status;
    }
  }
}
