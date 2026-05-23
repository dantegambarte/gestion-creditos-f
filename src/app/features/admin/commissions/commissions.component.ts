import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, catchError, of } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { AppError } from '../../../core/models/app-error';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import { CurrencyAmountInputDirective } from '../../../shared/directives/currency-amount-input.directive';
import {
  LiquidatePayload,
  Liquidation,
  PaymentMethod,
  Salary,
  WeeklySummaryEmployee,
} from '../models/commission.model';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { CommissionsService } from './commissions.service';
import { CashRegisterService } from '../cash-register/cash-register.service';

type CommissionsTab = 'liquidaciones' | 'historial';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CardModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextareaModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
    TooltipModule,
    CurrencyAmountInputDirective,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './commissions.component.html',
})
export class CommissionsComponent implements OnInit, OnDestroy {
  private readonly commissionsService = inject(CommissionsService);
  private readonly usersService = inject(UsersService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  readonly format = inject(FormatService);
  private destroy$ = new Subject<void>();

  isCashClosed = false;
  activeTab: CommissionsTab = 'liquidaciones';

  employees: WeeklySummaryEmployee[] = [];
  loadingSummary = true;
  errorSummary: AppError | null = null;

  liquidations: Liquidation[] = [];
  loadingLiquidations = true;

  showLiquidateDialog = false;
  selectedEmployee: WeeklySummaryEmployee | null = null;
  liquidatePaymentMethod: PaymentMethod = 'CASH';
  liquidateTransferReference = '';
  liquidating = false;

  showConfirmDialog = false;

  readonly paymentMethodOptions = [
    { label: 'Efectivo', value: 'CASH' as PaymentMethod },
    { label: 'Transferencia', value: 'TRANSFER' as PaymentMethod },
  ];

  showSalaryPanel = false;
  collectors: User[] = [];
  selectedCollectorId: string | null = null;
  currentSalary: Salary | null = null;
  loadingSalary = false;
  newWeeklyAmount: number | null = null;
  savingSalary = false;

  ngOnInit(): void {
    this.header.set([{ label: 'Liquidaciones' }]);
    this.checkCashRegisterStatus();
    this.loadSummary();
    this.loadLiquidations();
    this.usersService
      .listCollectors()
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => {
        this.collectors = c;
      });
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
   * Setea la pestaña activa del componente.
   * @param tab
   */
  setTab(tab: CommissionsTab): void {
    this.activeTab = tab;
  }

  /**
   * Carga el resumen semanal de comisiones, mostrando un estado de carga mientras se realiza la petición y manejando posibles errores.
   */
  loadSummary(): void {
    this.loadingSummary = true;
    this.errorSummary = null;
    this.commissionsService
      .getWeeklySummary()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingSummary = false;
        }),
      )
      .subscribe({
        next: (s) => {
          this.employees = s.employees;
        },
        error: (err: AppError) => {
          this.errorSummary = err;
        },
      });
  }

  /**
   * Carga el historial de liquidaciones, mostrando un estado de carga mientras se realiza la petición y manejando posibles errores.
   */
  loadLiquidations(): void {
    this.loadingLiquidations = true;
    this.commissionsService
      .getLiquidations()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingLiquidations = false;
        }),
      )
      .subscribe({
        next: (l) => {
          this.liquidations = l;
        },
        error: () => {
          this.loadingLiquidations = false;
        },
      });
  }

  /**
   * Abre el diálogo para liquidar comisiones de un empleado.
   * @param employee
   */
  openLiquidateDialog(employee: WeeklySummaryEmployee): void {
    this.selectedEmployee = employee;
    this.liquidatePaymentMethod = 'CASH';
    this.liquidateTransferReference = '';
    this.showLiquidateDialog = true;
  }

  /**
   * Abre un diálogo de confirmación antes de ejecutar la liquidación, para evitar ejecuciones accidentales.
   */
  openConfirmDialog(): void {
    this.showConfirmDialog = true;
  }

  /**
   * Confirma la liquidación de comisiones para el empleado seleccionado.
   * @returns
   */
  confirmLiquidate(): void {
    if (!this.selectedEmployee) return;

    this.showConfirmDialog = false;
    this.liquidating = true;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(
        catchError(() => of(null)),
      )
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;

        if (this.isCashClosed) {
          this.liquidating = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes liquidar comisiones. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }

        this.processLiquidation();
      });
  }

  private processLiquidation(): void {
    const payload: LiquidatePayload = {
      userId: this.selectedEmployee!.userId,
      paymentMethod: this.liquidatePaymentMethod,
    };
    if (
      this.liquidatePaymentMethod === 'TRANSFER' &&
      this.liquidateTransferReference.trim()
    ) {
      payload.transferReference = this.liquidateTransferReference.trim();
    }
    this.commissionsService
      .liquidate(payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.liquidating = false;
        }),
      )
      .subscribe({
        next: (liq) => {
          this.showLiquidateDialog = false;
          this.msg.add({
            severity: 'success',
            summary: 'Liquidación ejecutada',
            detail: `${this.selectedEmployee!.fullName} liquidado correctamente.`,
            life: 4000,
          });
          this.liquidations = [liq, ...this.liquidations];
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
   * Determina si una fila en la tabla de empleados debe estar deshabilitada.
   * @param emp
   * @returns
   */
  rowDisabled(emp: WeeklySummaryEmployee): boolean {
    return emp.totalNet === 0;
  }

  /**
   * Alterna la visibilidad del panel de sueldos, que permite ver y editar el sueldo semanal de los cobradores.
   */
  toggleSalaryPanel(): void {
    this.showSalaryPanel = !this.showSalaryPanel;
  }

  /**
   * Maneja el cambio de cobrador seleccionado, cargando su sueldo actual.
   * @returns
   */
  onCollectorChange(): void {
    if (!this.selectedCollectorId) {
      this.currentSalary = null;
      this.newWeeklyAmount = null;
      return;
    }
    this.loadingSalary = true;
    this.commissionsService
      .getSalary(this.selectedCollectorId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.loadingSalary = false;
        }),
      )
      .subscribe({
        next: (s) => {
          this.currentSalary = s;
          this.newWeeklyAmount = s.weeklyAmount;
        },
        error: () => {
          this.currentSalary = null;
        },
      });
  }

  /**
   * Guarda el nuevo sueldo semanal para el cobrador seleccionado.
   * @returns
   */
  saveSalary(): void {
    if (!this.selectedCollectorId || this.newWeeklyAmount == null) return;
    this.savingSalary = true;
    this.commissionsService
      .setSalary(this.selectedCollectorId, this.newWeeklyAmount)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.savingSalary = false;
        }),
      )
      .subscribe({
        next: (s) => {
          this.currentSalary = s;
          this.newWeeklyAmount = s.weeklyAmount;
          this.msg.add({
            severity: 'success',
            summary: 'Sueldo actualizado',
            detail: `Nuevo sueldo semanal: ${this.formatCurrency(s.weeklyAmount)}`,
            life: 3000,
          });
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
   * Obtiene las opciones de cobradores para el dropdown.
   * @returns
   */
  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  /**
   * Obtiene la etiqueta para un rol específico.
   * @param role
   * @returns
   */
  roleLabel(role: string): string {
    const map: Record<string, string> = {
      SELLER: 'Vendedor',
      COLLECTOR: 'Cobrador',
      SELLER_COLLECTOR: 'Vend./Cobr.',
    };
    return map[role] ?? role;
  }

  /**
   * Obtiene la etiqueta para un método de pago específico.
   * @param pm
   * @returns
   */
  paymentMethodLabel(pm: PaymentMethod): string {
    return pm === 'CASH' ? 'Efectivo' : 'Transferencia';
  }

  formatCurrency(value: number): string {
    return this.format.currency(value);
  }

  /**
   * Formatea una fecha ISO como cadena.
   * @param iso
   * @returns
   */
  formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
}
