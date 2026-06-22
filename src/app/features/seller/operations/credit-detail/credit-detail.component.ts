import { CommonModule, DatePipe, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, catchError, of, takeUntil } from 'rxjs';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { HeaderService } from '../../../../core/services/header.service';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { CashRegisterService } from '../../../admin/cash-register/cash-register.service';
import { CreditPayment } from '../../../collector/models/payment.model';
import { PaymentsService } from '../../../collector/payments.service';
import {
  CreditDetail,
  CreditStatus,
  CreditUnit,
} from '../../models/credit.model';
import { Installment } from '../../models/installment.model';
import { CreditsService } from '../credits.service';
import { ApproveDialogComponent } from './approve-dialog/approve-dialog.component';
import { WriteOffDialogComponent } from './write-off-dialog/write-off-dialog.component';
import { CreditSchedulePanelComponent } from './credit-schedule-panel/credit-schedule-panel.component';
import { PlanChangeDialogComponent } from './plan-change-dialog/plan-change-dialog.component';
import { RefinanceDialogComponent } from './refinance-dialog/refinance-dialog.component';
import { RejectDialogComponent } from './reject-dialog/reject-dialog.component';
import { SettlementDialogComponent } from './settlement-dialog/settlement-dialog.component';

@Component({
  selector: 'app-credit-detail',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    CommonModule,
    ButtonModule,
    TagModule,
    TableModule,
    ToastModule,
    InputTextModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    MessageModule,
    ApproveDialogComponent,
    RejectDialogComponent,
    RefinanceDialogComponent,
    PlanChangeDialogComponent,
    WriteOffDialogComponent,
    SettlementDialogComponent,
    CreditSchedulePanelComponent,
    BackButtonComponent,
  ],
  providers: [MessageService],
  templateUrl: './credit-detail.component.html',
  styleUrl: './credit-detail.component.scss',
})
export class CreditDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly creditsService = inject(CreditsService);
  private readonly paymentsService = inject(PaymentsService);
  private readonly location = inject(Location);
  private readonly header = inject(HeaderService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  readonly auth = inject(AuthServiceBase);
  private readonly msg = inject(MessageService);

  private readonly destroy$ = new Subject<void>();

  credit: CreditDetail | null = null;
  loading = false;
  error: AppError | null = null;
  isCashClosed = false;

  // ── Settlement dialog ─────────────────────────────────────────
  showSettlementDialog = false;
  settlementPayments: CreditPayment[] = [];

  showApproveDialog = false;
  showRejectDialog = false;
  showRefinanceDialog = false;
  showPlanChangeDialog = false;
  showWriteOffDialog = false;

  get installmentAmount(): number | null {
    return this.credit?.installments[0]?.amountDue ?? null;
  }

  /**
   * Resume cómo debe mostrarse el pago inicial cuando el backend no distingue su origen.
   * @returns {string} Etiqueta visible para el bloque financiero.
   */
  get initialPaymentLabel(): string {
    if (
      this.credit?.prepaidInstallments &&
      this.credit.prepaidInstallments > 0
    ) {
      return 'Cuotas adelantadas';
    }
    return 'Enganche';
  }

  /**
   * Describe la limitación actual del detalle para pagos iniciales de ventas pendientes.
   * @returns {string | null} Texto auxiliar si falta metadata para distinguir el origen.
   */
  get initialPaymentNote(): string | null {
    if (!this.credit || this.credit.type !== 'SALE') {
      return null;
    }

    if (this.credit.prepaidInstallments > 0) {
      return `${this.credit.prepaidInstallments} cuota(s) · ${this.paymentMethodLabel(this.credit.prepaidInstallmentsMethod)}`;
    }

    if (this.credit.downPayment > 0) {
      return this.paymentMethodLabel(this.credit.downPaymentMethod);
    }

    return null;
  }

  /**
   * Calcula el monto estimado asociado al adelanto de cuotas.
   * @returns {number} Importe equivalente al adelanto cuando existe.
   */
  get prepaidInstallmentsAmount(): number {
    if (!this.credit || this.credit.prepaidInstallments <= 0) return 0;
    const installmentsCount = this.credit.installmentsCount || 0;
    if (installmentsCount <= 0) return 0;
    return Math.round(
      (this.credit.financedAmount / installmentsCount) *
        this.credit.prepaidInstallments,
    );
  }

  /**
   * Traduce un método de pago interno a su etiqueta visible.
   * @param {string | null | undefined} method - Código interno del método.
   * @returns {string} Etiqueta legible para la UI.
   */
  paymentMethodLabel(method: string | null | undefined): string {
    if (method === 'TRANSFER') return 'Transferencia';
    if (method === 'CASH') return 'Efectivo';
    return 'Sin especificar';
  }

  get settlementTotalAmount(): number {
    if (!this.credit?.installments) return 0;
    return this.credit.installments
      .filter((inst) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inst.status))
      .reduce((sum, inst) => sum + (inst.amountDue - inst.amountPaid), 0);
  }

  /**
   * Tasa efectiva del crédito: interestRate para LOAN; para SALE la tasa
   * histórica congelada en el producto (units[0].historicalRate).
   * @returns {number | null} Tasa en decimal (0.5 = 50%) o null si aún no hay.
   */
  get effectiveRate(): number | null {
    if (!this.credit) return null;
    if (this.credit.interestRate != null) return this.credit.interestRate;
    const unit = this.credit.units?.[0];
    return unit && unit.historicalRate != null ? unit.historicalRate : null;
  }

  /**
   * Total a devolver = suma de las cuotas vigentes (excluye anuladas por cambio
   * de plan y castigadas). Es lo que efectivamente paga el cliente en cuotas.
   * @returns {number}
   */
  get totalToReturn(): number {
    if (!this.credit?.installments) return 0;
    return this.credit.installments
      .filter(
        (inst) =>
          inst.status !== 'PLAN_CHANGE_CANCELLED' &&
          inst.status !== 'WRITTEN_OFF',
      )
      .reduce((sum, inst) => sum + inst.amountDue, 0);
  }

  /**
   * Total de interés = total a devolver − monto financiado.
   * @returns {number}
   */
  get totalInterest(): number {
    return Math.max(this.totalToReturn - (this.credit?.financedAmount ?? 0), 0);
  }

  get hasPendingPayments(): boolean {
    return this.settlementPayments.some((p) => p.status === 'PENDING');
  }

  /**
   * Verifica si el usuario actual es un administrador.
   */
  get isAdmin(): boolean {
    return this.auth.hasRole('ADMIN');
  }

  /** Un crédito REFINANCED o SETTLED no acepta más acciones sobre sus cuotas. */
  get canActOnInstallments(): boolean {
    return (
      this.isAdmin &&
      this.credit?.status !== 'REFINANCED' &&
      this.credit?.status !== 'SETTLED'
    );
  }

  /** ID del crédito predecesor (el que fue refinanciado para crear este). */
  get predecessorCreditId(): string | null {
    return this.credit?.refinancingChain?.predecessorId ?? null;
  }

  /** ID del crédito sucesor (el creado al refinanciar este). */
  get successorCreditId(): string | null {
    return this.credit?.refinancingChain?.successorId ?? null;
  }

  /**
   * Obtiene el ID del crédito desde la URL.
   */
  private get creditId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Operaciones', route: '/seller/operations' },
      { label: 'Detalle' },
    ]);
    this.checkCashRegisterStatus();
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.credit = null;
      this.settlementPayments = [];
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Verifica el estado de cierre de caja del día actual.
   */
  private checkCashRegisterStatus(): void {
    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        this.isCashClosed = dashboard?.isClosed ?? false;
      });
  }

  /**
   * Navega hacia atrás o a la pantalla contextual indicada por query params.
   */
  goBack(): void {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const sheetId = this.route.snapshot.queryParamMap.get('sheetId');
    const openTab = this.route.snapshot.queryParamMap.get('openTab');
    const reportTab = this.route.snapshot.queryParamMap.get('tab');
    const dateFrom = this.route.snapshot.queryParamMap.get('dateFrom');
    const dateTo = this.route.snapshot.queryParamMap.get('dateTo');
    const businessDayId =
      this.route.snapshot.queryParamMap.get('businessDayId');
    const cashSessionId =
      this.route.snapshot.queryParamMap.get('cashSessionId');
    if (returnTo === 'admin-collections') {
      this.router.navigate(['/admin/collections'], {
        queryParams: {
          ...(sheetId ? { openSheetId: sheetId } : {}),
          ...(openTab ? { openTab } : {}),
        },
      });
      return;
    }
    if (returnTo === 'admin-reports') {
      this.router.navigate(['/admin/reports'], {
        queryParams: {
          ...(reportTab ? { tab: reportTab } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
          ...(businessDayId ? { businessDayId } : {}),
          ...(cashSessionId ? { cashSessionId } : {}),
        },
      });
      return;
    }
    this.location.back();
  }

  /**
   * Devuelve la etiqueta de la variante del producto.
   * @param u Unidad del crédito
   */
  variantLabel(u: CreditUnit): string {
    const parts = [u.color, u.size, u.capacity].filter((s) => !!s);
    return parts.length > 0 ? parts.join(' / ') : '—';
  }

  /**
   * Devuelve la etiqueta del estado del crédito.
   * @param status Estado del crédito
   */
  statusLabel(status: CreditStatus): string {
    const map: Record<CreditStatus, string> = {
      PENDING_APPROVAL: 'Pendiente de aprobación',
      ACTIVE: 'Activo',
      SETTLED: 'Liquidado',
      REJECTED: 'Rechazado',
      EXPIRED: 'Aprobación vencida',
      REFINANCED: 'Refinanciado',
      WRITTEN_OFF: 'Castigado',
    };
    return map[status];
  }

  /**
   * Devuelve la severidad de color del estado del crédito.
   * @param status Estado del crédito
   */
  statusSeverity(
    status: CreditStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      CreditStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      PENDING_APPROVAL: 'warning',
      ACTIVE: 'success',
      SETTLED: 'secondary',
      REJECTED: 'danger',
      EXPIRED: 'danger',
      REFINANCED: 'contrast',
      WRITTEN_OFF: 'danger',
    };
    return map[status];
  }

  /**
   * Devuelve la etiqueta de frecuencia de pago.
   * @param frequency Frecuencia de pago
   */
  frequencyLabel(frequency: string): string {
    const map: Record<string, string> = {
      WEEKLY: 'Semanal',
      BIWEEKLY: 'Quincenal',
      MONTHLY: 'Mensual',
    };
    return map[frequency] ?? frequency;
  }

  openApproveDialog(): void {
    this.showApproveDialog = true;
  }

  /**
   * Actualiza el crédito local cuando el diálogo de aprobación confirma con éxito.
   * @param updated Crédito actualizado devuelto por el backend
   */
  onApproved(updated: CreditDetail): void {
    this.credit = updated;
  }

  openRejectDialog(): void {
    this.showRejectDialog = true;
  }

  /**
   * Carga los pagos actualizados antes de abrir el diálogo de cancelación anticipada.
   */
  openSettlementDialog(): void {
    if (!this.credit) return;
    this.paymentsService.listByCredit(this.credit.id).subscribe({
      next: (data) => {
        this.settlementPayments = data;
        this.showSettlementDialog = true;
      },
      error: () => {
        this.settlementPayments = [];
        this.showSettlementDialog = true;
      },
    });
  }

  /**
   * Abre el wizard de refinanciación.
   */
  openRefinanceDialog(): void {
    this.showRefinanceDialog = true;
  }

  /**
   * Actualiza una cuota en la lista del crédito. Lo emite el panel de cronograma tras penalty/waive.
   * @param updated Cuota con los cambios aplicados
   */
  updateInstallmentInList(updated: Partial<Installment>): void {
    if (!this.credit || !updated.id) return;
    this.credit = {
      ...this.credit,
      installments: this.credit.installments.map((inst) =>
        inst.id === updated.id ? { ...inst, ...updated } : inst,
      ),
    };
  }

  /**
   * Navega al crédito de la cadena de refinanciación preservando el contexto admin/seller.
   * @param id ID del crédito de la cadena
   */
  navigateToChainCredit(id: string): void {
    const segments = this.router.url.split('/');
    const base = `/${segments[1]}/${segments[2]}`;
    this.router.navigate([base, id]);
  }

  /**
   * Handler del evento refinanced: recarga el crédito tras confirmar la refinanciación.
   */
  onRefinanced(): void {
    this.load();
  }

  /**
   * Indica si el crédito ya tuvo un cambio de plan. Se infiere de la presencia
   * de cuotas anuladas por cambio de plan (un cambio exitoso siempre anula al
   * menos una). Solo se permite un cambio de plan por crédito.
   */
  get planAlreadyChanged(): boolean {
    return !!this.credit?.installments.some(
      (i) => i.status === 'PLAN_CHANGE_CANCELLED',
    );
  }

  /** Abre el diálogo de cambio de plan (simula al abrir). */
  openPlanChangeDialog(): void {
    this.showPlanChangeDialog = true;
  }

  /** Recarga el crédito tras un cambio de plan exitoso. */
  onPlanChanged(): void {
    this.load();
  }

  /** Abre el diálogo de castigo de crédito. */
  openWriteOffDialog(): void {
    this.showWriteOffDialog = true;
  }

  /** Recarga el crédito tras castigarlo con éxito. */
  onWrittenOff(): void {
    this.load();
  }

  /**
   * Carga los detalles del crédito desde el backend y actualiza el header de la página.
   */
  load(): void {
    this.loading = true;
    this.error = null;
    this.creditsService.getById(this.creditId).subscribe({
      next: (data) => {
        this.credit = data;
        this.header.set([
          { label: 'Operaciones', route: '/seller/operations' },
          {
            label: `${data.type === 'SALE' ? 'Venta' : 'Préstamo'} — ${data.customerName}`,
          },
        ]);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
