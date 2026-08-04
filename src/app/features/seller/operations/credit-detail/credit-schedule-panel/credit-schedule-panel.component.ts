import { DatePipe } from '@angular/common';
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
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CreditPayment } from '../../../../collector/models/payment.model';
import { PaymentsService } from '../../../../collector/payments.service';
import { CreditDetail, InstallmentStatus } from '../../../models/credit.model';
import { Installment } from '../../../models/installment.model';
import { DirectPaymentDialogComponent } from '../direct-payment-dialog/direct-payment-dialog.component';
import { PenaltyDialogComponent } from '../penalty-dialog/penalty-dialog.component';
import { WaiveDialogComponent } from '../waive-dialog/waive-dialog.component';
import { FfBackTopFabComponent } from '../../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { ScheduleVisitDialogComponent } from '../schedule-visit-dialog/schedule-visit-dialog.component';

@Component({
  selector: 'app-credit-schedule-panel',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyArsPipe,
    ButtonModule,
    TableModule,
    TooltipModule,
    PenaltyDialogComponent,
    WaiveDialogComponent,
    DirectPaymentDialogComponent,
    FfBackTopFabComponent,
    ScheduleVisitDialogComponent,
  ],
  templateUrl: './credit-schedule-panel.component.html',
})
export class CreditSchedulePanelComponent implements OnChanges, OnDestroy {
  @Input() credit: CreditDetail | null = null;
  @Input() canActOnInstallments = false;
  /** Habilita SOLO el botón "Programar visita" (admin, vendedor y mixto). */
  @Input() canScheduleVisits = false;
  /** Emite cuando penalty/waive actualiza una cuota localmente. */
  @Output() installmentPatched = new EventEmitter<Partial<Installment>>();
  /** Emite cuando el cobro directo exige recargar el crédito completo. */
  @Output() reloadNeeded = new EventEmitter<void>();

  private readonly paymentsService = inject(PaymentsService);
  private destroy$ = new Subject<void>();

  selectedInstallment: CreditDetail['installments'][number] | null = null;
  activeTab: 'all' | 'paid' | 'pending' | 'overdue' = 'all';

  mainTab: 'installments' | 'payments' = 'installments';
  creditPayments: CreditPayment[] = [];
  loadingPayments = false;
  paymentsLoaded = false;

  showPenaltyDialog = false;
  penaltyInstallment: CreditDetail['installments'][number] | null = null;
  showWaiveDialog = false;
  waiveInstallment: CreditDetail['installments'][number] | null = null;
  showDirectDialog = false;
  directInstallment: CreditDetail['installments'][number] | null = null;
  showScheduleVisitDialog = false;
  scheduleVisitInstallment: CreditDetail['installments'][number] | null = null;

  /** Estados de cuota sobre los que el admin puede programar una visita. */
  private readonly SCHEDULABLE_STATUSES = ['PENDING', 'PARTIAL', 'OVERDUE'];

  /** True si la cuota admite programar una visita (no pagada / no terminal). */
  canScheduleVisit(inst: CreditDetail['installments'][number]): boolean {
    return this.SCHEDULABLE_STATUSES.includes(inst.status);
  }

  get paidCount(): number {
    return (
      this.credit?.installments.filter((i) => i.status === 'PAID').length ?? 0
    );
  }

  get pendingCount(): number {
    return (
      this.credit?.installments.filter(
        (i) => i.status === 'PENDING' || i.status === 'PARTIAL',
      ).length ?? 0
    );
  }

  get overdueCount(): number {
    return (
      this.credit?.installments.filter((i) => i.status === 'OVERDUE').length ??
      0
    );
  }

  /**
   * Monto que adeuda el cliente: suma de (amountDue - amountPaid) de las
   * cuotas vigentes (pendiente/parcial/vencida). Misma fórmula que
   * settlementTotalAmount en credit-detail.component.ts.
   */
  get owedAmount(): number {
    if (!this.credit?.installments) return 0;
    return this.credit.installments
      .filter((inst) =>
        ['PENDING', 'PARTIAL', 'OVERDUE'].includes(inst.status),
      )
      .reduce((sum, inst) => sum + (inst.amountDue - inst.amountPaid), 0);
  }

  /**
   * Resetea el estado del panel cuando cambia el crédito.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['credit'] && this.credit) {
      this.selectedInstallment = null;
      this.mainTab = 'installments';
      this.paymentsLoaded = false;
      this.creditPayments = [];
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Selecciona o deselecciona una cuota para mostrar el panel lateral.
   * @param inst Cuota clickeada
   */
  selectInstallment(inst: CreditDetail['installments'][number]): void {
    this.selectedInstallment =
      this.selectedInstallment?.id === inst.id ? null : inst;
  }

  /**
   * Cambia al tab de cobros y carga el historial si aún no fue cargado.
   */
  switchToPayments(): void {
    this.mainTab = 'payments';
    if (this.paymentsLoaded || !this.credit) return;
    this.loadingPayments = true;
    this.paymentsService
      .listByCredit(this.credit.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.creditPayments = data;
          this.loadingPayments = false;
          this.paymentsLoaded = true;
        },
        error: () => {
          this.loadingPayments = false;
        },
      });
  }

  openPenaltyDialog(inst: CreditDetail['installments'][number]): void {
    this.penaltyInstallment = inst;
    this.showPenaltyDialog = true;
  }

  openWaiveDialog(inst: CreditDetail['installments'][number]): void {
    this.waiveInstallment = inst;
    this.showWaiveDialog = true;
  }

  openDirectDialog(inst: CreditDetail['installments'][number]): void {
    this.directInstallment = inst;
    this.showDirectDialog = true;
  }

  openScheduleVisitDialog(inst: CreditDetail['installments'][number]): void {
    this.scheduleVisitInstallment = inst;
    this.showScheduleVisitDialog = true;
  }

  /**
   * Propaga el patch de cuota al padre para actualizar el crédito local.
   * @param updated Cuota actualizada parcialmente
   */
  onInstallmentPatched(updated: Partial<Installment>): void {
    this.installmentPatched.emit(updated);
  }

  /**
   * El cobro directo exige recargar el crédito completo desde el padre.
   */
  onDirectPaid(): void {
    this.paymentsLoaded = false;
    this.reloadNeeded.emit();
  }

  /**
   * Severidad de color según el estado de la cuota.
   * @param status Estado de la cuota
   */
  installmentSeverity(
    status: InstallmentStatus,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      InstallmentStatus,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      PENDING: 'info',
      PAID: 'success',
      OVERDUE: 'danger',
      PARTIAL: 'warning',
      PLAN_CHANGE_CANCELLED: 'secondary',
      WRITTEN_OFF: 'danger',
      WAIVED: 'secondary',
      SETTLED: 'success',
    };
    return map[status] ?? 'secondary';
  }

  /**
   * Etiqueta legible del estado de la cuota.
   * @param status Estado de la cuota
   */
  installmentLabel(status: InstallmentStatus): string {
    const map: Record<InstallmentStatus, string> = {
      PENDING: 'Pendiente',
      PAID: 'Pagada',
      OVERDUE: 'Vencida',
      PARTIAL: 'Parcial',
      PLAN_CHANGE_CANCELLED: 'Anulada (cambio de plan)',
      WRITTEN_OFF: 'Castigada',
      WAIVED: 'Condonada',
      SETTLED: 'Liquidada',
    };
    return map[status] ?? status;
  }

  /**
   * Etiqueta del método de pago.
   * @param method Método de pago
   */
  paymentMethodLabel(method: string | null): string {
    if (method === 'CASH') return 'Efectivo';
    if (method === 'TRANSFER') return 'Transferencia';
    if (method === 'MIXED') return 'Mixto';
    return '—';
  }

  /**
   * True si la cuota fue cancelada como adelanto al aprobar la venta.
   * @param inst Cuota a evaluar
   */
  isPrepaidOnApproval(inst: CreditDetail['installments'][number]): boolean {
    return inst.generationType === 'APPROVAL_PREPAYMENT';
  }

  /**
   * Formatea una fecha 'YYYY-MM-DD' a 'dd/MM/yyyy' sin sesgo de zona horaria.
   * El pipe date interpreta el string plano como UTC y en AR (GMT-3) puede
   * correr un día; acá se reordena la cadena directamente.
   * @param iso Fecha en formato 'YYYY-MM-DD' (o null).
   */
  formatIsoDate(iso: string | null): string {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Etiqueta de ORIGEN del cobro derivada de generation_type. Devuelve null para
   * un cobro normal (no agrega ruido en el caso común).
   * @param inst Cuota a evaluar
   */
  installmentOriginLabel(
    inst: CreditDetail['installments'][number],
  ): string | null {
    if (inst.generationType === 'APPROVAL_PREPAYMENT') {
      // En contado la única cuota representa el pago total al aprobar, no un adelanto.
      return this.credit?.paymentCondition === 'CASH'
        ? 'Pago de contado'
        : 'Cuota adelantada';
    }
    if (inst.generationType === 'ADVANCE_DISTRIBUTION') return 'Pago adelantado';
    return null;
  }
}
