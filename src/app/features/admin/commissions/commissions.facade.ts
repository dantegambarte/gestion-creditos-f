import { Injectable, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Subject, catchError, of } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import {
  Commission,
  LiquidatePayload,
  Liquidation,
  PaymentMethod,
  Salary,
  WeeklySummaryEmployee,
} from '../models/commission.model';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { CommissionsService } from './commissions.service';

export type CommissionsTab = 'resumen' | 'historial' | 'sueldos';

@Injectable()
export class CommissionsFacade {
  private readonly commissionsService = inject(CommissionsService);
  private readonly usersService = inject(UsersService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  private readonly format = inject(FormatService);
  private readonly destroy$ = new Subject<void>();

  readonly isCashClosed = signal(false);
  readonly activeTab = signal<CommissionsTab>('resumen');
  readonly employees = signal<WeeklySummaryEmployee[]>([]);
  readonly loadingSummary = signal(true);
  readonly errorSummary = signal<AppError | null>(null);
  readonly liquidations = signal<Liquidation[]>([]);
  readonly loadingLiquidations = signal(true);
  readonly selectedHistoryId = signal<string | null>(null);
  readonly historyEmployeeFilter = signal('ALL');
  readonly historyMethodFilter = signal<'ALL' | PaymentMethod>('ALL');
  readonly showLiquidateDialog = signal(false);
  readonly selectedEmployee = signal<WeeklySummaryEmployee | null>(null);
  readonly liquidatePaymentMethod = signal<PaymentMethod>('CASH');
  readonly liquidateTransferReference = signal('');
  readonly liquidating = signal(false);
  readonly showConfirmDialog = signal(false);
  readonly employeeCommissions = signal<Commission[]>([]);
  readonly loadingCommissions = signal(false);
  readonly collectors = signal<User[]>([]);
  readonly selectedCollectorId = signal<string | null>(null);
  readonly currentSalary = signal<Salary | null>(null);
  readonly loadingSalary = signal(false);
  readonly newWeeklyAmount = signal<number | null>(null);
  readonly savingSalary = signal(false);
  readonly salarySearchTerm = signal('');

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' as PaymentMethod },
    { label: 'Transferencia', value: 'TRANSFER' as PaymentMethod },
  ];

  readonly collectorOptions = computed(() =>
    this.collectors().map((collector) => ({
      label: collector.fullName,
      value: collector.id,
    })),
  );

  readonly salaryRows = computed(() =>
    this.collectors().map((collector) => {
      const summary = this.employees().find(
        (employee) => employee.userId === collector.id,
      );
      return {
        userId: collector.id,
        fullName: collector.fullName,
        role: collector.role,
        weeklyAmount: summary?.salaryAmount ?? 0,
      };
    }),
  );

  readonly filteredSalaryRows = computed(() => {
    const term = this.salarySearchTerm().trim().toLowerCase();
    if (!term) return this.salaryRows();
    return this.salaryRows().filter((row) =>
      row.fullName.toLowerCase().includes(term),
    );
  });

  readonly salaryStats = computed(() => {
    const rows = this.salaryRows();
    const configured = rows.filter((row) => row.weeklyAmount > 0).length;
    const weeklyTotal = rows.reduce((sum, row) => sum + row.weeklyAmount, 0);
    return {
      collectors: rows.length,
      configured,
      weeklyTotal,
    };
  });

  readonly historyRows = computed(() =>
    this.liquidations().filter((liq) => {
      const byEmployee =
        this.historyEmployeeFilter() === 'ALL' ||
        liq.userId === this.historyEmployeeFilter();
      const byMethod =
        this.historyMethodFilter() === 'ALL' ||
        liq.paymentMethod === this.historyMethodFilter();
      return byEmployee && byMethod;
    }),
  );

  readonly historyEmployeeOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const liq of this.liquidations()) {
      if (!seen.has(liq.userId)) seen.set(liq.userId, liq.userName);
    }
    const options = Array.from(seen.entries()).map(([value, label]) => ({
      label,
      value,
    }));
    return [{ label: 'Todos los empleados', value: 'ALL' }, ...options];
  });

  readonly historyMethodOptions = computed(() => [
    { label: 'Todos los métodos', value: 'ALL' as const },
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
  ]);

  readonly historyStats = computed(() => {
    const rows = this.historyRows();
    const totalCommissions = rows.reduce(
      (sum, liq) => sum + liq.commissionsTotal,
      0,
    );
    const totalSalary = rows.reduce((sum, liq) => sum + liq.salaryAmount, 0);
    const totalPaid = rows.reduce((sum, liq) => sum + liq.totalPaid, 0);
    return {
      totalPaid,
      totalCommissions,
      totalSalary,
      count: rows.length,
    };
  });

  readonly selectedHistory = computed(() => {
    const selectedId = this.selectedHistoryId();
    if (!selectedId) return null;
    const selected = this.historyRows().find((liq) => liq.id === selectedId);
    return selected ?? null;
  });

  readonly recentLiquidations = computed(() =>
    this.liquidations().slice(0, 10),
  );

  /**
   * Inicializa la pantalla cargando encabezado, resumen, historial y cobradores.
   */
  init(): void {
    this.header.set([{ label: 'Liquidaciones y comisiones' }]);
    this.checkCashRegisterStatus();
    this.loadSummary();
    this.loadLiquidations();
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((collectors) => {
        this.collectors.set(collectors);
      });
  }

  /**
   * Libera suscripciones y limpia el header al salir del módulo.
   */
  destroy(): void {
    this.header.reset();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Cambia la pestaña activa de la pantalla de comisiones.
   * @param tab
   */
  setTab(tab: CommissionsTab): void {
    this.activeTab.set(tab);
  }

  /**
   * Actualiza el filtro por empleado del historial.
   * @param value
   */
  setHistoryEmployeeFilter(value: string): void {
    this.historyEmployeeFilter.set(value);
  }

  /**
   * Actualiza el filtro por método del historial.
   * @param value
   */
  setHistoryMethodFilter(value: 'ALL' | PaymentMethod): void {
    this.historyMethodFilter.set(value);
  }

  /**
   * Actualiza el término de búsqueda de sueldos.
   * @param value
   */
  setSalarySearchTerm(value: string): void {
    this.salarySearchTerm.set(value);
  }

  /**
   * Actualiza el cobrador seleccionado para edición de sueldo.
   * @param value
   */
  setSelectedCollectorId(value: string | null): void {
    this.selectedCollectorId.set(value);
  }

  /**
   * Actualiza el monto semanal en edición.
   * @param value
   */
  setNewWeeklyAmount(value: number | null): void {
    this.newWeeklyAmount.set(value);
  }

  /**
   * Cierra el panel lateral de historial.
   */
  clearSelectedHistory(): void {
    this.selectedHistoryId.set(null);
  }

  /**
   * Actualiza visibilidad del diálogo principal de liquidación.
   * @param visible
   */
  setShowLiquidateDialog(visible: boolean): void {
    this.showLiquidateDialog.set(visible);
  }

  /**
   * Actualiza visibilidad del diálogo de confirmación.
   * @param visible
   */
  setShowConfirmDialog(visible: boolean): void {
    this.showConfirmDialog.set(visible);
  }

  /**
   * Actualiza el método de pago para la liquidación.
   * @param method
   */
  setLiquidatePaymentMethod(method: PaymentMethod): void {
    this.liquidatePaymentMethod.set(method);
  }

  /**
   * Actualiza la referencia de transferencia para la liquidación.
   * @param reference
   */
  setLiquidateTransferReference(reference: string): void {
    this.liquidateTransferReference.set(reference);
  }

  /**
   * Verifica si la caja del día está cerrada para bloquear liquidaciones.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        this.isCashClosed.set(dashboard?.isClosed ?? false);
      });
  }

  /**
   * Carga el resumen semanal de comisiones y actualiza estado de carga/error.
   */
  loadSummary(): void {
    this.loadingSummary.set(true);
    this.errorSummary.set(null);
    this.commissionsService
      .getWeeklySummary()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingSummary.set(false);
        }),
      )
      .subscribe({
        next: (summary) => {
          this.employees.set(summary.employees);
        },
        error: (err: AppError) => {
          this.errorSummary.set(err);
        },
      });
  }

  /**
   * Carga el historial completo de liquidaciones.
   */
  loadLiquidations(): void {
    this.loadingLiquidations.set(true);
    this.commissionsService
      .getLiquidations()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingLiquidations.set(false);
        }),
      )
      .subscribe({
        next: (liquidations) => {
          this.liquidations.set(liquidations);
        },
        error: () => {
          this.loadingLiquidations.set(false);
        },
      });
  }

  /**
   * Abre el diálogo de liquidación inicializando método, referencia y cargando las
   * comisiones pendientes del empleado para mostrar el detalle de ventas (LI-03).
   * @param employee
   */
  openLiquidateDialog(employee: WeeklySummaryEmployee): void {
    this.selectedEmployee.set(employee);
    this.liquidatePaymentMethod.set('CASH');
    this.liquidateTransferReference.set('');
    this.employeeCommissions.set([]);
    this.showLiquidateDialog.set(true);

    this.loadingCommissions.set(true);
    this.commissionsService
      .getCommissions({ userId: employee.userId, status: 'PENDING' })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loadingCommissions.set(false)),
      )
      .subscribe({
        next: (commissions) => this.employeeCommissions.set(commissions),
        error: () => this.employeeCommissions.set([]),
      });
  }

  /**
   * Abre el diálogo de confirmación previo a ejecutar la liquidación.
   */
  openConfirmDialog(): void {
    this.showConfirmDialog.set(true);
  }

  /**
   * Valida estado de caja y, si corresponde, ejecuta la liquidación.
   */
  confirmLiquidate(): void {
    if (!this.selectedEmployee()) return;
    this.showConfirmDialog.set(false);
    this.liquidating.set(true);

    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        this.isCashClosed.set(dashboard?.isClosed ?? false);
        if (this.isCashClosed()) {
          this.liquidating.set(false);
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail:
              'No puedes liquidar comisiones. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        this.processLiquidation();
      });
  }

  /**
   * Ejecuta la liquidación en backend y refresca el resumen al completar.
   */
  private processLiquidation(): void {
    const employee = this.selectedEmployee();
    if (!employee) return;

    const payload: LiquidatePayload = {
      userId: employee.userId,
      paymentMethod: this.liquidatePaymentMethod(),
    };
    if (
      this.liquidatePaymentMethod() === 'TRANSFER' &&
      this.liquidateTransferReference().trim()
    ) {
      payload.transferReference = this.liquidateTransferReference().trim();
    }

    this.commissionsService
      .liquidate(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.liquidating.set(false);
        }),
      )
      .subscribe({
        next: (liquidation) => {
          this.showLiquidateDialog.set(false);
          this.msg.add({
            severity: 'success',
            summary: 'Liquidación ejecutada',
            detail: `${employee.fullName} liquidado correctamente.`,
            life: 4000,
          });
          this.liquidations.update((current) => [liquidation, ...current]);
          this.loadSummary();
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Sin monto' : 'Error',
            detail: err.message ?? 'No se pudo liquidar.',
            life: 5000,
          });
        },
      });
  }

  /**
   * Indica si una fila no tiene monto para liquidar.
   * @param emp
   */
  rowDisabled(emp: WeeklySummaryEmployee): boolean {
    return emp.totalNet === 0;
  }

  /**
   * Carga el sueldo del cobrador seleccionado desde el dropdown.
   */
  onCollectorChange(): void {
    const selectedCollectorId = this.selectedCollectorId();
    if (!selectedCollectorId) {
      this.currentSalary.set(null);
      this.newWeeklyAmount.set(null);
      return;
    }

    this.loadingSalary.set(true);
    this.commissionsService
      .getSalary(selectedCollectorId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingSalary.set(false);
        }),
      )
      .subscribe({
        next: (salary) => {
          this.currentSalary.set(salary);
          this.newWeeklyAmount.set(salary.weeklyAmount);
        },
        error: () => {
          this.currentSalary.set(null);
        },
      });
  }

  /**
   * Guarda el monto semanal del cobrador activo.
   */
  saveSalary(): void {
    const selectedCollectorId = this.selectedCollectorId();
    const newWeeklyAmount = this.newWeeklyAmount();
    if (!selectedCollectorId || newWeeklyAmount == null) return;

    this.savingSalary.set(true);
    this.commissionsService
      .setSalary(selectedCollectorId, newWeeklyAmount)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.savingSalary.set(false);
        }),
      )
      .subscribe({
        next: (salary) => {
          this.msg.add({
            severity: 'success',
            summary: 'Sueldo actualizado',
            detail: `Nuevo sueldo semanal: ${this.formatCurrency(salary.weeklyAmount)}`,
            life: 3000,
          });
          // LI-01: refresca la tabla y el Resumen Semanal
          this.loadSummary();
          // LI-02: limpia el editor después de guardar
          this.selectedCollectorId.set(null);
          this.currentSalary.set(null);
          this.newWeeklyAmount.set(null);
        },
        error: (err: AppError) => {
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message ?? 'No se pudo guardar.',
            life: 4000,
          });
        },
      });
  }

  /**
   * Selecciona un cobrador desde tabla evitando requests duplicados.
   * @param userId
   */
  selectCollectorFromRow(userId: string): void {
    if (this.loadingSalary()) return;
    if (this.selectedCollectorId() === userId && this.currentSalary()) return;
    this.selectedCollectorId.set(userId);
    this.onCollectorChange();
  }

  /**
   * Devuelve etiqueta legible para cada rol de usuario.
   * @param role
   */
  roleLabel(role: string): string {
    const map: Record<string, string> = {
      SELLER: 'VENDEDOR',
      COLLECTOR: 'COBRADOR',
      SELLER_COLLECTOR: 'VENDEDOR-COBRADOR',
    };
    return map[role] ?? role;
  }

  /**
   * Devuelve clases visuales para el tag de rol.
   * @param role
   */
  roleTagClass(role: string): string {
    const map: Record<string, string> = {
      SELLER:
        '!bg-emerald-500/15 !text-emerald-400 !border !border-emerald-500/20 text-[11px] font-semibold',
      COLLECTOR:
        '!bg-amber-500/15 !text-amber-400 !border !border-amber-500/20 text-[11px] font-semibold',
      SELLER_COLLECTOR:
        '!bg-violet-500/15 !text-violet-300 !border !border-violet-500/20 text-[11px] font-semibold',
    };
    return map[role] ?? 'text-[11px] font-semibold';
  }

  /**
   * Traduce el método de pago para mostrar en UI.
   * @param pm
   */
  paymentMethodLabel(pm: PaymentMethod): string {
    return pm === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  /**
   * Selecciona o deselecciona una fila del historial.
   * @param liq
   */
  selectHistory(liq: Liquidation): void {
    this.selectedHistoryId.set(
      this.selectedHistoryId() === liq.id ? null : liq.id,
    );
  }

  /**
   * Obtiene el rol visual para un usuario del historial.
   * @param userId
   */
  roleByUserId(userId: string): string {
    const row = this.employees().find((employee) => employee.userId === userId);
    return row ? this.roleLabel(row.role) : '—';
  }

  /**
   * Obtiene la clase visual del rol para un usuario del historial.
   * @param userId
   */
  roleClassByUserId(userId: string): string {
    const row = this.employees().find((employee) => employee.userId === userId);
    return this.roleTagClass(row?.role ?? '');
  }

  /**
   * Formatea un monto a moneda local para visualización.
   * @param value
   */
  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha ISO con formato dd/mm/yyyy.
   * @param iso
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [year, month, day] = iso.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }
}
