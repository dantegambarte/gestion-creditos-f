import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { CashStatusService } from '../../../../admin/cash-register/cash-status.service';
import { CreditDetail, EarlySettlementResult } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

@Component({
  selector: 'app-settlement-dialog',
  imports: [
    FormsModule,
    CurrencyArsPipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    TooltipModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './settlement-dialog.component.html',
})
export class SettlementDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  @Input() hasPendingPayments = false;
  @Input() settlementTotalAmount = 0;
  /** Se emite cuando la cancelación fue procesada; el padre debe recargar. */
  @Output() settled = new EventEmitter<void>();

  paymentMethod: 'CASH' | 'TRANSFER' | 'MIXED' = 'CASH';
  amountCash: number | null = null;
  amountTransfer: number | null = null;
  transferRef = '';
  processing = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Efectivo + transferencia', value: 'MIXED' },
  ];

  private readonly creditsSvc = inject(CreditsService);
  private readonly cashStatusSvc = inject(CashStatusService);
  private readonly msg = inject(MessageService);

  /** Reinicia los campos de pago cuando se abre una cancelación nueva. */
  ngOnChanges(): void {
    if (!this.visible) return;
    this.paymentMethod = 'CASH';
    this.amountCash = null;
    this.amountTransfer = null;
    this.transferRef = '';
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Valida el pago. En mixto los montos deben sumar el total y la referencia de
   * transferencia es obligatoria (como indica el texto del formulario).
   */
  get formValid(): boolean {
    if (this.paymentMethod !== 'MIXED') return true;
    const cash = this.amountCash ?? 0;
    const transfer = this.amountTransfer ?? 0;
    return (
      Math.round((cash + transfer) * 100) === Math.round(this.settlementTotalAmount * 100) &&
      cash > 0 &&
      transfer > 0 &&
      !!this.transferRef.trim()
    );
  }

  /**
   * Verifica caja en tiempo real antes de procesar para evitar cancelaciones con caja cerrada.
   */
  confirm(): void {
    if (!this.credit || !this.formValid) return;

    if (this.hasPendingPayments) {
      this.msg.add({
        severity: 'error',
        summary: 'Pagos Pendientes',
        detail: 'Este crédito tiene pagos pendientes de aprobación. Resuelvalos antes de cancelar.',
        life: 5000,
      });
      return;
    }

    this.processing = true;
    this.cashStatusSvc
      .checkAction(
        'cancelar créditos',
        'No puedes cancelar créditos. La caja del día está CERRADA.',
      )
      .subscribe((block) => {
        if (block) {
          this.processing = false;
          this.msg.add(block);
          return;
        }
        this.processSettlement();
      });
  }

  private processSettlement(): void {
    if (!this.credit) return;
    const payload = {
      ...(this.paymentMethod === 'MIXED'
        ? {
            amountCash: this.amountCash ?? 0,
            amountTransfer: this.amountTransfer ?? 0,
          }
        : { paymentMethod: this.paymentMethod }),
      ...((this.paymentMethod === 'TRANSFER' || this.paymentMethod === 'MIXED') && this.transferRef
        ? { transferReference: this.transferRef }
        : {}),
    };

    this.creditsSvc.earlySettlement(this.credit.id, payload).subscribe({
      next: (result: EarlySettlementResult) => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Cancelación anticipada creada',
          detail: `Monto: $${result.settlementAmount}`,
          life: 6000,
        });
        this.settled.emit();
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo procesar.',
        });
      },
    });
  }
}
