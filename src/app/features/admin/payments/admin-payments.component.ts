import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { DateService } from '../../../core/services/date.service';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from '../../collector/models/payment.model';
import { PaymentsService } from '../../collector/payments.service';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { PaymentDetailDialogComponent } from './payment-detail-dialog/payment-detail-dialog.component';
import { FfBackTopFabComponent } from '../../../shared/components/back-top-fab/ff-back-top-fab.component';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    DatePipe,
    FormsModule,
    ButtonModule,
    CardModule,
    TableModule,
    TagModule,
    DropdownModule,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    ErrorStateComponent,
    MessageModule,
    PaymentDetailDialogComponent,
    FfBackTopFabComponent,
  ],
  providers: [MessageService],
  templateUrl: './admin-payments.component.html',
})
export class AdminPaymentsComponent implements OnInit {
  private readonly paymentsService = inject(PaymentsService);
  private readonly usersService = inject(UsersService);
  private readonly dateSvc = inject(DateService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);
  private readonly router = inject(Router);

  payments: Payment[] = [];
  collectors: User[] = [];
  loading = true;
  error: AppError | null = null;

  filterStatus: PaymentStatus | null = null;
  filterCollectorId: string | null = null;

  showDetailDialog = false;
  selectedPaymentId: string | null = null;

  readonly STATUS_OPTIONS = [
    { label: 'Pendiente', value: 'PENDING' as PaymentStatus },
    { label: 'Aprobado', value: 'APPROVED' as PaymentStatus },
    { label: 'Rechazado', value: 'REJECTED' as PaymentStatus },
  ];

  /**
   * Devuelve las opciones de cobradores para el filtro.
   */
  get collectorOptions(): { label: string; value: string }[] {
    return this.collectors.map((c) => ({ label: c.fullName, value: c.id }));
  }

  /**
   * Devuelve la lista de cobros filtrada por estado y cobrador.
   */
  get filteredPayments(): Payment[] {
    return this.payments.filter((p) => {
      const matchStatus = !this.filterStatus || p.status === this.filterStatus;
      const matchCollector =
        !this.filterCollectorId ||
        p.collectorName ===
          this.collectors.find((c) => c.id === this.filterCollectorId)
            ?.fullName;
      return matchStatus && matchCollector;
    });
  }

  /**
   * Devuelve la severidad del tag según el estado del cobro.
   * @param status estado del cobro
   */
  statusSeverity(
    status: PaymentStatus,
  ): 'success' | 'warning' | 'danger' | 'secondary' {
    return { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[
      status
    ] as 'success' | 'warning' | 'danger';
  }

  /**
   * Devuelve la etiqueta legible del estado del cobro.
   * @param status estado del cobro
   */
  statusLabel(status: PaymentStatus): string {
    return {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
    }[status];
  }

  /**
   * Devuelve la etiqueta de tipo de cobro para mostrar en la lista.
   * @param p cobro
   */
  paymentTypeLabel(p: Payment): string | null {
    if (p.reversalPaymentId) return 'Revertido';
    if (p.isReversal) return 'Reversión';
    if (p.adminDirect) return 'Directo';
    if (p.parentPaymentId) return 'Adelanto';
    return null;
  }

  /**
   * Devuelve la severidad del tag de tipo de cobro.
   * @param p cobro
   */
  paymentTypeSeverity(
    p: Payment,
  ): 'danger' | 'info' | 'secondary' | 'warning' | null {
    if (p.reversalPaymentId) return 'warning';
    if (p.isReversal) return 'danger';
    if (p.adminDirect) return 'info';
    if (p.parentPaymentId) return 'secondary';
    return null;
  }

  /**
   * Devuelve la etiqueta legible del tipo de crédito asociado al cobro.
   * @param creditType tipo de crédito recibido desde la API
   */
  creditTypeLabel(creditType: Payment['creditType']): string {
    return { SALE: 'Venta', LOAN: 'Préstamo' }[creditType];
  }

  /**
   * Devuelve la etiqueta legible del método de pago.
   * @param method método de pago registrado en el cobro
   */
  paymentMethodLabel(method: PaymentMethod): string {
    return {
      CASH: 'Efectivo',
      TRANSFER: 'Transferencia',
      MIXED: 'Mixto',
    }[method];
  }

  /**
   * Devuelve la severidad visual del método de pago para distinguirlo rápido.
   * @param method método de pago registrado en el cobro
   */
  paymentMethodSeverity(
    method: PaymentMethod,
  ): 'info' | 'secondary' | 'warning' {
    return {
      CASH: 'warning',
      TRANSFER: 'info',
      MIXED: 'secondary',
    }[method] as 'info' | 'secondary' | 'warning';
  }

  /**
   * Indica si la cuota del cobro ya venció y todavía requiere atención.
   * @param payment cobro de la lista
   */
  isOverdue(payment: Payment): boolean {
    if (payment.status !== 'PENDING') return false;
    return this.dateSvc.isOverdue(payment.dueDate);
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Cobros' }]);
    this.usersService.listCollectors().subscribe((c) => (this.collectors = c));
    this.load();
  }

  refresh(): void {
    this.load();
  }

  /**
   * Lleva al admin al listado de operaciones para buscar el crédito y
   * registrar el cobro directo desde el cronograma de cuotas.
   */
  goToDirectPayment(): void {
    this.router.navigate(['/admin/operations']);
  }

  /**
   * Abre el dialog de detalle para el cobro seleccionado.
   * @param payment cobro de la lista
   */
  openDetail(payment: Payment): void {
    this.selectedPaymentId = payment.id;
    this.showDetailDialog = true;
  }

  /**
   * Actualiza el estado de un cobro en la lista local sin recargar del servidor.
   * @param id id del cobro
   * @param status nuevo estado
   */
  onStatusChanged({ id, status }: { id: string; status: PaymentStatus }): void {
    this.payments = this.payments.map((p) =>
      p.id === id ? { ...p, status } : p,
    );
  }

  /**
   * Recarga la lista completa tras una reversión o cobro directo.
   */
  onReloaded(): void {
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.error = null;
    this.paymentsService.list().subscribe({
      next: (data) => {
        this.payments = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
