import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
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
import { catchError, of } from 'rxjs';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { CashRegisterService } from '../../../../admin/cash-register/cash-register.service';
import { PaymentsService } from '../../../../collector/payments.service';
import { CreditDetail } from '../../../models/credit.model';

@Component({
  selector: 'app-direct-payment-dialog',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './direct-payment-dialog.component.html',
})
export class DirectPaymentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() installment: CreditDetail['installments'][number] | null = null;
  /** Se emite cuando el cobro fue registrado; el padre debe recargar. */
  @Output() paid = new EventEmitter<void>();

  maxAmount = 0;
  amount: number | null = null;
  method: 'CASH' | 'TRANSFER' = 'CASH';
  transferRef = '';
  notes = '';
  processing = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];

  private readonly paymentsSvc = inject(PaymentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  /** Precarga el monto máximo cada vez que cambia la cuota seleccionada. */
  ngOnChanges(): void {
    if (this.installment) {
      this.maxAmount = this.installment.amountDue - this.installment.amountPaid;
      this.amount = this.maxAmount;
      this.method = 'CASH';
      this.transferRef = '';
      this.notes = '';
    }
  }

  get formValid(): boolean {
    return (
      !!this.installment &&
      (this.amount ?? 0) > 0 &&
      (this.amount ?? 0) <= this.maxAmount &&
      (this.method !== 'TRANSFER' || this.transferRef.trim().length > 0)
    );
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Verifica caja en tiempo real antes de crear el cobro.
   */
  confirm(): void {
    if (this.processing || !this.formValid) return;
    this.processing = true;
    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard?.isClosed) {
          this.processing = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes crear cobros. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }
        this.processPayment();
      });
  }

  private processPayment(): void {
    this.paymentsSvc
      .create({
        installmentId: this.installment!.id,
        amountReceived: this.amount!,
        paymentMethod: this.method,
        transferReference: this.transferRef || undefined,
        notes: this.notes || undefined,
      })
      .subscribe({
        next: () => {
          this.processing = false;
          this.close();
          this.msg.add({
            severity: 'success',
            summary: 'Cobro registrado',
            detail: 'El cobro fue registrado y está pendiente de aprobación.',
            life: 5000,
          });
          this.paid.emit();
        },
        error: (err: AppError) => {
          this.processing = false;
          this.msg.add({
            severity:
              err.status === 409 || err.status === 422 ? 'warn' : 'error',
            summary:
              err.status === 409 || err.status === 422
                ? 'Advertencia'
                : 'Error',
            detail: err.message ?? 'No se pudo registrar el cobro.',
          });
        },
      });
  }
}
