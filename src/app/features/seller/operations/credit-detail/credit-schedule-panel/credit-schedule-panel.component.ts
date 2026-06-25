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
    ScheduleVisitDialogComponent,
  ],
  templateUrl: './credit-schedule-panel.component.html',
})
export class CreditSchedulePanelComponent implements OnChanges, OnDestroy {
  @Input() credit: CreditDetail | null = null;
  @Input() canActOnInstallments = false;
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
    };
    return map[status] ?? status;
  }

  /**
   * Etiqueta del método de pago.
   * @param method Método de pago
   */
  paymentMethodLabel(method: 'CASH' | 'TRANSFER' | 'MIXED'): string {
    if (method === 'CASH') return 'Efectivo';
    if (method === 'TRANSFER') return 'Transferencia';
    return 'Mixto';
  }
}
