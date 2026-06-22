import { DatePipe } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { catchError, of } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import {
  PaymentDetail,
  PaymentStatus,
} from '../../../collector/models/payment.model';
import { PaymentsService } from '../../../collector/payments.service';
import { CashRegisterService } from '../../cash-register/cash-register.service';

@Component({
  selector: 'app-payment-detail-dialog',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextareaModule,
    SkeletonModule,
    TagModule,
    CurrencyArsPipe,
  ],
  templateUrl: './payment-detail-dialog.component.html',
})
export class PaymentDetailDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** ID del cobro a mostrar. Se carga automáticamente al abrir el dialog. */
  @Input() paymentId: string | null = null;
  /** Emite tras aprobar o rechazar un cobro. El padre actualiza la fila en lista. */
  @Output() statusChanged = new EventEmitter<{
    id: string;
    status: PaymentStatus;
  }>();
  /** Emite tras revertir un cobro. El padre recarga la lista completa. */
  @Output() reloaded = new EventEmitter<void>();

  selectedPayment: PaymentDetail | null = null;
  loadingDetail = false;

  showRejectDialog = false;
  rejectReason = '';
  processingReject = false;
  processingApprove = false;

  showReverseDialog = false;
  reopenDetailOnReverseClose = false;
  reverseReason = '';
  processingReverse = false;

  private readonly paymentsService = inject(PaymentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.paymentId) {
      this.selectedPayment = null;
      this.loadingDetail = true;
      this.rejectReason = '';
      this.reverseReason = '';
      this.processingApprove = false;
      this.processingReject = false;
      this.processingReverse = false;
      this.loadDetail();
    }
  }

  rejectCharCount(): number {
    return this.rejectReason.length;
  }

  reverseCharCount(): number {
    return this.reverseReason.length;
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
   * Abre el dialog de rechazo del cobro activo.
   */
  openRejectDialog(): void {
    this.rejectReason = '';
    this.showRejectDialog = true;
  }

  /**
   * Cierra el detalle y abre el dialog de reversión.
   * Marca la bandera para reabrir el detalle al cerrar la reversión.
   */
  openReverseDialog(): void {
    if (!this.selectedPayment) return;
    this.reverseReason = '';
    this.reopenDetailOnReverseClose = true;
    this.visibleChange.emit(false);
    this.showReverseDialog = true;
  }

  /**
   * Reabre el detalle si la reversión fue cancelada sin confirmar.
   */
  onReverseDialogHide(): void {
    if (this.reopenDetailOnReverseClose && this.selectedPayment) {
      this.visibleChange.emit(true);
    }
    this.reopenDetailOnReverseClose = false;
  }

  /**
   * Valida caja y aprueba el cobro seleccionado.
   */
  confirmApprove(): void {
    if (!this.selectedPayment) return;
    this.processingApprove = true;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard?.isClosed) {
          this.processingApprove = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes aprobar cobros. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }
        this.processApproval();
      });
  }

  /**
   * Valida caja y rechaza el cobro seleccionado.
   */
  confirmReject(): void {
    if (!this.selectedPayment || this.rejectReason.length < 5) return;
    this.processingReject = true;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard?.isClosed) {
          this.processingReject = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes rechazar cobros. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }
        this.processReject();
      });
  }

  /**
   * Confirma y ejecuta la reversión del cobro.
   */
  confirmReverse(): void {
    if (!this.selectedPayment || this.reverseReason.length < 5) return;
    this.processingReverse = true;
    this.paymentsService
      .reverse(this.selectedPayment.id, { reason: this.reverseReason })
      .subscribe({
        next: () => {
          this.processingReverse = false;
          this.reopenDetailOnReverseClose = false;
          this.showReverseDialog = false;
          this.visibleChange.emit(false);
          this.msg.add({
            severity: 'info',
            summary: 'Cobro revertido',
            detail: 'El cobro y sus sub-pagos fueron revertidos correctamente.',
            life: 5000,
          });
          this.reloaded.emit();
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

  private loadDetail(): void {
    this.paymentsService.getById(this.paymentId!).subscribe({
      next: (detail) => {
        this.selectedPayment = detail;
        this.loadingDetail = false;
      },
      error: () => {
        this.loadingDetail = false;
        this.visibleChange.emit(false);
      },
    });
  }

  private processApproval(): void {
    this.paymentsService.approve(this.selectedPayment!.id).subscribe({
      next: (detail) => {
        this.processingApprove = false;
        this.visibleChange.emit(false);
        const isPaid = detail.amountPaid >= detail.amountDue;
        this.msg.add({
          severity: 'success',
          summary: 'Cobro aprobado',
          detail: isPaid
            ? 'Cobro aprobado. La cuota quedó pagada.'
            : 'Cobro aprobado correctamente.',
          life: 5000,
        });
        this.statusChanged.emit({ id: detail.id, status: 'APPROVED' });
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

  private processReject(): void {
    this.paymentsService
      .reject(this.selectedPayment!.id, this.rejectReason)
      .subscribe({
        next: () => {
          this.processingReject = false;
          this.showRejectDialog = false;
          this.visibleChange.emit(false);
          this.msg.add({
            severity: 'info',
            summary: 'Cobro rechazado',
            detail: 'El cobro fue rechazado.',
            life: 4000,
          });
          this.statusChanged.emit({
            id: this.selectedPayment!.id,
            status: 'REJECTED',
          });
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
}
