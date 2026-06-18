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
import { Router } from '@angular/router';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Subject, combineLatest } from 'rxjs';
import { catchError, of, takeUntil } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { Credit } from '../../../seller/models/credit.model';
import { CreditsService } from '../../../seller/operations/credits.service';
import { PaymentsService } from '../../../collector/payments.service';
import { Payment, PendingCreditGroup, PendingPaymentGroup } from '../../models/interface/dashboard';
import { DashboardApprovePaymentDialogComponent } from '../dashboard-approve-payment-dialog/dashboard-approve-payment-dialog.component';

@Component({
  selector: 'app-dashboard-pending',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    SkeletonModule,
    DashboardApprovePaymentDialogComponent,
  ],
  templateUrl: './dashboard-pending.component.html',
})
export class DashboardPendingComponent implements OnInit, OnDestroy, OnChanges {
  /** True si no hay caja operativa abierta (V4): deshabilita aprobar/revisar. */
  @Input() isCashClosed = false;
  /** Emite cuando debe mostrarse o limpiarse una alerta en la página. */
  @Output() alertUpdated = new EventEmitter<{
    show: boolean;
    message: string;
  }>();
  /** Emite tras aprobar un cobro para que el padre recargue KPIs y gráficos. */
  @Output() paymentApproved = new EventEmitter<void>();

  loadingPending = true;
  approvingPaymentId: string | null = null;
  approveDialogVisible = false;
  selectedPaymentToApprove: Payment | null = null;
  pendingCredits: PendingCreditGroup[] = [];
  pendingPayments: PendingPaymentGroup[] = [];

  private readonly router = inject(Router);
  private readonly creditsSvc = inject(CreditsService);
  private readonly paymentsSvc = inject(PaymentsService);
  private readonly messageService = inject(MessageService);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.loadPending();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isCashClosed']) {
      // Limpiar alerta de caja si el estado cambia
      this.alertUpdated.emit({ show: false, message: '' });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Carga los créditos y cobros pendientes, agrupados por vendedor/cobrador.
   * También verifica si hay cobros pendientes con más de 48 horas sin aprobar.
   */
  loadPending(): void {
    this.loadingPending = true;

    combineLatest([
      this.creditsSvc
        .list({ status: 'PENDING_APPROVAL' })
        .pipe(catchError(() => of([]))),
      this.paymentsSvc
        .list({ status: 'PENDING' })
        .pipe(catchError(() => of([]))),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([credits, payments]) => {
        this.pendingCredits = this.groupCreditsBySeller(credits);
        this.pendingPayments = this.groupPaymentsByCollector(payments);
        this.checkPendingAlerts(payments);
        this.loadingPending = false;
      });
  }

  /**
   * Retorna el total de créditos pendientes sumando el count de cada grupo.
   */
  getTotalCredits(): number {
    return this.pendingCredits.reduce((sum, group) => sum + group.count, 0);
  }

  /**
   * Retorna el total de cobros pendientes sumando el count de cada grupo.
   */
  getTotalPayments(): number {
    return this.pendingPayments.reduce((sum, group) => sum + group.count, 0);
  }

  /**
   * Calcula tiempo transcurrido desde una fecha en formato legible.
   * @param dateStr fecha ISO
   */
  timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);

    if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `hace ${diffHours}h`;
    return 'hace poco';
  }

  /**
   * Navega a la vista de aprobación de un crédito. Valida que la caja no esté cerrada.
   * @param creditId id del crédito
   */
  reviewCredit(creditId: string): void {
    if (this.isCashClosed) {
      this.alertUpdated.emit({
        show: true,
        message:
          'No hay una caja operativa abierta. Abrí una caja para aprobar créditos.',
      });
      return;
    }
    this.router.navigate(['/admin/operations', creditId]);
  }

  /**
   * Abre el modal de doble validación para aprobar un cobro pendiente.
   * Si la caja está cerrada, muestra alerta y no abre el modal.
   * @param payment cobro seleccionado
   */
  openApprovePaymentDialog(payment: Payment): void {
    if (this.isCashClosed) {
      this.alertUpdated.emit({
        show: true,
        message:
          'No hay una caja operativa abierta. Abrí una caja para aprobar cobros.',
      });
      return;
    }

    this.selectedPaymentToApprove = payment;
    this.approveDialogVisible = true;
  }

  /**
   * Cierra el modal de aprobación y limpia el cobro seleccionado.
   */
  closeApprovePaymentDialog(): void {
    this.approveDialogVisible = false;
    this.selectedPaymentToApprove = null;
  }

  /**
   * Sincroniza el estado de visibilidad del modal desde el diálogo hijo.
   * Si se cierra, también limpia el cobro seleccionado.
   * @param visible estado de visibilidad emitido por el diálogo
   */
  onApproveDialogVisibleChange(visible: boolean): void {
    this.approveDialogVisible = visible;
    if (!visible) this.selectedPaymentToApprove = null;
  }

  /**
   * Confirma la aprobación desde el modal de doble validación.
   * Ejecuta la aprobación, recarga datos y actualiza KPIs del dashboard.
   */
  confirmApprovePayment(): void {
    if (!this.selectedPaymentToApprove) return;

    const paymentId = this.selectedPaymentToApprove.id;
    this.approvingPaymentId = paymentId;

    this.paymentsSvc
      .approve(paymentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.closeApprovePaymentDialog();
          this.approvingPaymentId = null;
          this.messageService.add({
            severity: 'success',
            summary: 'Cobro aprobado',
            detail: 'Cobro aprobado correctamente.',
            life: 5000,
          });
          this.loadPending();
          this.paymentApproved.emit();
        },
        error: (err: AppError) => {
          this.approvingPaymentId = null;
          this.closeApprovePaymentDialog();
          // 409 = condición operativa esperada (sin caja abierta, cuota ya
          // pagada, etc.): mostramos el mensaje del backend, no uno genérico.
          this.messageService.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary:
              err.status === 409 ? 'No se pudo aprobar el cobro' : 'Error',
            detail: err.message ?? 'Error al aprobar el cobro. Intenta nuevamente.',
            life: 6000,
          });
        },
      });
  }

  private checkPendingAlerts(payments: { createdAt: string }[]): void {
    const now = new Date();
    const overdue48h = payments.filter((payment) => {
      if (!payment.createdAt) return false;
      const diffHours =
        (now.getTime() - new Date(payment.createdAt).getTime()) /
        (1000 * 60 * 60);
      return diffHours > 48;
    });

    if (overdue48h.length > 0) {
      const count = overdue48h.length;
      this.alertUpdated.emit({
        show: true,
        message: `${count} cobro${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''} con más de 48 horas sin revisar. Revisión recomendada.`,
      });
    } else {
      this.alertUpdated.emit({ show: false, message: '' });
    }
  }

  private groupCreditsBySeller(credits: Credit[]): PendingCreditGroup[] {
    const grouped = new Map<string | null, Credit[]>();

    credits.forEach((credit) => {
      const seller = credit.createdByName ?? 'Sin asignar';
      if (!grouped.has(seller)) grouped.set(seller, []);
      grouped.get(seller)!.push(credit);
    });

    return Array.from(grouped.entries()).map(([sellerName, items]) => {
      const sortedItems = items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        sellerName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, c) => sum + c.totalAmount, 0),
        oldestDate: sortedItems.reduce(
          (oldest, c) =>
            new Date(c.createdAt) < new Date(oldest) ? c.createdAt : oldest,
          sortedItems[0].createdAt,
        ),
        credits: sortedItems,
      };
    });
  }

  private groupPaymentsByCollector(payments: Payment[]): PendingPaymentGroup[] {
    const grouped = new Map<string | null, Payment[]>();

    payments.forEach((payment) => {
      const collector = payment.collectorName ?? 'Sin asignar';
      if (!grouped.has(collector)) grouped.set(collector, []);
      grouped.get(collector)!.push(payment);
    });

    return Array.from(grouped.entries()).map(([collectorName, items]) => {
      const sortedItems = items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return {
        collectorName,
        count: sortedItems.length,
        totalAmount: sortedItems.reduce((sum, p) => sum + p.amountReceived, 0),
        oldestDate: sortedItems.reduce(
          (oldest, p) =>
            new Date(p.createdAt) < new Date(oldest) ? p.createdAt : oldest,
          sortedItems[0].createdAt,
        ),
        payments: sortedItems,
      };
    });
  }
}
