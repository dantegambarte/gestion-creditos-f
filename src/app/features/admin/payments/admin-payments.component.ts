import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../core/models/app-error';
import { HeaderService } from '../../../core/services/header.service';
import { ErrorStateComponent } from '../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../shared/states/loading-state/loading-state.component';
import {
  Payment,
  PaymentDetail,
  PaymentStatus,
} from '../../collector/models/payment.model';
import { PaymentsService } from '../../collector/payments.service';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';

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
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    SkeletonModule,
    ToastModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './admin-payments.component.html',
})
export class AdminPaymentsComponent implements OnInit {
  private readonly paymentsService = inject(PaymentsService);
  private readonly usersService = inject(UsersService);
  private readonly header = inject(HeaderService);
  private readonly msg = inject(MessageService);

  payments: Payment[] = [];
  collectors: User[] = [];
  loading = true;
  error: AppError | null = null;

  filterStatus: PaymentStatus | null = null;
  filterCollectorId: string | null = null;

  showDetailDialog = false;
  selectedPayment: PaymentDetail | null = null;
  loadingDetail = false;

  showRejectDialog = false;
  rejectReason = '';
  processingReject = false;
  processingApprove = false;

  // ── Cobro directo ──────────────────────────────────────────────
  showDirectDialog = false;
  directInstallmentId = '';
  directAmount: number | null = null;
  directMethod: 'CASH' | 'TRANSFER' = 'CASH';
  directTransferRef = '';
  directNotes = '';
  processingDirect = false;

  // ── Reversión ─────────────────────────────────────────────────
  showReverseDialog = false;
  reverseReason = '';
  processingReverse = false;

  readonly STATUS_OPTIONS = [
    { label: 'Pendiente', value: 'PENDING' as PaymentStatus },
    { label: 'Aprobado', value: 'APPROVED' as PaymentStatus },
    { label: 'Rechazado', value: 'REJECTED' as PaymentStatus },
  ];

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
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

  rejectCharCount(): number {
    return this.rejectReason.length;
  }

  reverseCharCount(): number {
    return this.reverseReason.length;
  }

  ngOnInit(): void {
    this.header.set([{ label: 'Cobros' }]);
    this.usersService.listCollectors().subscribe((c) => (this.collectors = c));
    this.load();
  }

  /**
   * Devuelve la severidad del tag según el estado del cobro.
   */
  statusSeverity(
    status: PaymentStatus,
  ): 'success' | 'warning' | 'danger' | 'secondary' {
    return { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[
      status
    ] as any;
  }

  /**
   * Devuelve la etiqueta legible del estado.
   */
  statusLabel(status: PaymentStatus): string {
    return {
      PENDING: 'Pendiente',
      APPROVED: 'Aprobado',
      REJECTED: 'Rechazado',
    }[status];
  }

  refresh(): void {
    this.load();
  }

  openDetail(payment: Payment): void {
    this.showDetailDialog = true;
    this.selectedPayment = null;
    this.loadingDetail = true;
    this.paymentsService.getById(payment.id).subscribe({
      next: (detail) => {
        this.selectedPayment = detail;
        this.loadingDetail = false;
      },
      error: () => {
        this.loadingDetail = false;
        this.showDetailDialog = false;
      },
    });
  }

  openRejectDialog(): void {
    this.rejectReason = '';
    this.showRejectDialog = true;
  }

  confirmApprove(): void {
    if (!this.selectedPayment) return;
    this.processingApprove = true;
    this.paymentsService.approve(this.selectedPayment.id).subscribe({
      next: (detail) => {
        this.processingApprove = false;
        this.showDetailDialog = false;
        const isPaid = detail.amountPaid >= detail.amountDue;
        this.msg.add({
          severity: 'success',
          summary: 'Cobro aprobado',
          detail: isPaid
            ? 'Cobro aprobado. La cuota quedó pagada.'
            : 'Cobro aprobado correctamente.',
          life: 5000,
        });
        this.updatePaymentInList(detail.id, 'APPROVED');
      },
      error: (err: AppError) => {
        this.processingApprove = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo aprobar.',
        });
      },
    });
  }

  confirmReject(): void {
    if (!this.selectedPayment || this.rejectReason.length < 5) return;
    this.processingReject = true;
    this.paymentsService
      .reject(this.selectedPayment.id, this.rejectReason)
      .subscribe({
        next: () => {
          this.processingReject = false;
          this.showRejectDialog = false;
          this.showDetailDialog = false;
          this.msg.add({
            severity: 'info',
            summary: 'Cobro rechazado',
            detail: 'El cobro fue rechazado.',
            life: 4000,
          });
          this.updatePaymentInList(this.selectedPayment!.id, 'REJECTED');
        },
        error: (err: AppError) => {
          this.processingReject = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo rechazar.',
          });
        },
      });
  }

  // ── Cobro directo ──────────────────────────────────────────────

  openDirectDialog(): void {
    this.directInstallmentId = '';
    this.directAmount = null;
    this.directMethod = 'CASH';
    this.directTransferRef = '';
    this.directNotes = '';
    this.showDirectDialog = true;
  }

  /**
   * Indica si el formulario de cobro directo es válido para enviar.
   */
  private readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  get directFormValid(): boolean {
    return (
      this.UUID_RE.test(this.directInstallmentId.trim()) &&
      (this.directAmount ?? 0) > 0 &&
      (this.directMethod !== 'TRANSFER' ||
        this.directTransferRef.trim().length > 0)
    );
  }

  get directInstallmentIdInvalid(): boolean {
    return (
      this.directInstallmentId.trim().length > 0 &&
      !this.UUID_RE.test(this.directInstallmentId.trim())
    );
  }

  /**
   * Devuelve la etiqueta de tipo de cobro para mostrar en la lista.
   */
  paymentTypeLabel(p: Payment): string | null {
    if (p.isReversal) return 'Reversión';
    if (p.adminDirect) return 'Directo';
    if (p.parentPaymentId) return 'Adelanto';
    return null;
  }

  paymentTypeSeverity(p: Payment): 'danger' | 'info' | 'secondary' | null {
    if (p.isReversal) return 'danger';
    if (p.adminDirect) return 'info';
    if (p.parentPaymentId) return 'secondary';
    return null;
  }

  confirmDirect(): void {
    if (!this.directFormValid) return;
    this.processingDirect = true;
    this.paymentsService
      .adminDirect({
        installmentId: this.directInstallmentId.trim(),
        amountReceived: this.directAmount!,
        paymentMethod: this.directMethod,
        transferReference: this.directTransferRef || undefined,
        notes: this.directNotes || undefined,
      })
      .subscribe({
        next: () => {
          this.processingDirect = false;
          this.showDirectDialog = false;
          this.msg.add({
            severity: 'success',
            summary: 'Cobro registrado',
            detail: 'El cobro fue registrado y aprobado correctamente.',
            life: 5000,
          });
          this.load();
        },
        error: (err: AppError) => {
          this.processingDirect = false;
          this.msg.add({
            severity: err.status === 409 || err.status === 422 ? 'warn' : 'error',
            summary: err.status === 409 || err.status === 422 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo registrar el cobro.',
          });
        },
      });
  }

  // ── Reversión ─────────────────────────────────────────────────

  openReverseDialog(): void {
    this.reverseReason = '';
    this.showReverseDialog = true;
  }

  confirmReverse(): void {
    if (!this.selectedPayment || this.reverseReason.length < 5) return;
    this.processingReverse = true;
    this.paymentsService
      .reverse(this.selectedPayment.id, { reason: this.reverseReason })
      .subscribe({
        next: () => {
          this.processingReverse = false;
          this.showReverseDialog = false;
          this.showDetailDialog = false;
          this.msg.add({
            severity: 'info',
            summary: 'Cobro revertido',
            detail: 'El cobro y sus sub-pagos fueron revertidos correctamente.',
            life: 5000,
          });
          this.load();
        },
        error: (err: AppError) => {
          this.processingReverse = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: err.status === 409 ? 'Advertencia' : 'Error',
            detail: err.message ?? 'No se pudo revertir el cobro.',
          });
        },
      });
  }

  private updatePaymentInList(id: string, status: PaymentStatus): void {
    this.payments = this.payments.map((p) =>
      p.id === id ? { ...p, status } : p,
    );
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
