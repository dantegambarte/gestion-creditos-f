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
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { finalize } from 'rxjs/operators';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import {
  CashSessionDropResponse,
  DropPaymentMethod,
} from '../../models/cash-session.model';
import { CashRegisterService } from '../cash-register.service';

/**
 * V4: dialog para hacer un drop (envío de efectivo o transferencia) de la
 * caja operativa hacia Caja General. Genera DROP_IN automático en la cuenta
 * destino (default = Caja General) dentro de la misma tx del backend.
 *
 * Solo CASH y TRANSFER son métodos válidos para drops.
 */
@Component({
  selector: 'app-cash-session-drop-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './cash-session-drop-dialog.component.html',
})
export class CashSessionDropDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() sessionId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() dropCreated = new EventEmitter<CashSessionDropResponse>();

  private readonly service = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  readonly methodOptions: Array<{ label: string; value: DropPaymentMethod }> = [
    { label: 'Efectivo',     value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  amount: number | null = null;
  paymentMethod: DropPaymentMethod = 'CASH';
  reason = '';
  receiptReference = '';
  submitting = false;
  errorMessage: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.amount = null;
    this.paymentMethod = 'CASH';
    this.reason = '';
    this.receiptReference = '';
    this.errorMessage = null;
    this.submitting = false;
  }

  canSubmit(): boolean {
    return (
      this.amount != null &&
      this.amount > 0 &&
      this.sessionId != null &&
      !this.submitting
    );
  }

  submit(): void {
    if (!this.canSubmit() || !this.sessionId) return;
    this.submitting = true;
    this.errorMessage = null;

    this.service
      .createDrop(this.sessionId, {
        amount:            this.amount!,
        payment_method:    this.paymentMethod,
        reason:            this.reason.trim() || undefined,
        receipt_reference: this.receiptReference.trim() || undefined,
      })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (drop) => {
          this.msg.add({
            severity: 'success',
            summary: 'Drop registrado',
            detail: `Drop ${drop.payment_method} de ${drop.amount} hacia Caja General.`,
          });
          this.dropCreated.emit(drop);
          this.close();
        },
        error: (err) => {
          this.errorMessage = err?.message || 'No se pudo registrar el drop.';
        },
      });
  }

  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }
}
