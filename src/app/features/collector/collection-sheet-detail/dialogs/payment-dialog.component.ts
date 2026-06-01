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
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { CollectionSheetItem } from '../../models/collection.model';
import { PaymentCreatePayload } from '../../models/payment.model';
import { PaymentsService } from '../../payments.service';
import { CollectionDialogSuccess } from './sheet-dialog.model';

@Component({
  selector: 'app-collection-payment-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyAmountInputDirective,
    CurrencyArsPipe,
  ],
  templateUrl: './payment-dialog.component.html',
})
export class PaymentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() item: CollectionSheetItem | null = null;
  /** Emite cuando el cobro fue enviado; el padre ejecuta el refresh silencioso. */
  @Output() paid = new EventEmitter<CollectionDialogSuccess>();

  paymentAmount: number | null = null;
  paymentMethod: 'CASH' | 'TRANSFER' = 'CASH';
  transferReference = '';
  paymentNotes = '';
  paymentNextVisitDate = '';
  processingPayment = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
  ];
  readonly todayDate = new Date();
  readonly todayIso = new Date().toISOString().split('T')[0];

  private readonly paymentsService = inject(PaymentsService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.item) {
      this.paymentAmount = this.availableBalance(this.item);
      this.paymentMethod = 'CASH';
      this.transferReference = '';
      this.paymentNotes = '';
      this.paymentNextVisitDate = '';
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Devuelve el saldo pendiente de la cuota (monto - pagado).
   * @param item Cuota a evaluar.
   */
  availableBalance(item: CollectionSheetItem): number {
    return Math.max(0, item.amountDue - item.amountPaid);
  }

  /** True si el monto ingresado dejaría la cuota en estado parcial. */
  isPartialPayment(): boolean {
    if (!this.item || !this.paymentAmount) return false;
    return this.paymentAmount < this.availableBalance(this.item);
  }

  /** Limpia next_visit_date si el monto cubre el saldo completo. */
  onPaymentAmountChange(): void {
    if (!this.isPartialPayment()) {
      this.paymentNextVisitDate = '';
    }
  }

  /**
   * Confirma el cobro. Valida monto y fecha de próxima visita antes de enviar.
   */
  confirmPayment(): void {
    if (this.processingPayment) return;
    if (!this.item || !this.paymentAmount || this.paymentAmount <= 0) return;

    const balance = this.availableBalance(this.item);
    if (this.paymentAmount > balance) {
      this.msg.add({
        severity: 'warn',
        summary: 'Monto inválido',
        detail: `El monto no puede superar el saldo disponible ($${balance.toFixed(2)})`,
      });
      return;
    }

    const isPartial = this.paymentAmount < balance;
    const partialDateIso = isPartial ? this.paymentNextVisitDate : '';
    if (isPartial && !partialDateIso) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha requerida',
        detail: 'Indicá la fecha de próxima visita para el cobro parcial.',
      });
      return;
    }
    if (isPartial && partialDateIso < this.todayIso) {
      this.msg.add({
        severity: 'warn',
        summary: 'Fecha inválida',
        detail: 'La próxima visita no puede ser una fecha pasada.',
      });
      return;
    }

    this.processingPayment = true;
    const payload: PaymentCreatePayload = {
      installmentId: this.item.installmentId,
      amountReceived: this.paymentAmount,
      paymentMethod: this.paymentMethod,
    };
    if (this.paymentMethod === 'TRANSFER' && this.transferReference) {
      payload.transferReference = this.transferReference;
    }
    if (this.paymentNotes) payload.notes = this.paymentNotes;
    if (isPartial) payload.nextVisitDate = partialDateIso;

    const itemId = this.item.installmentId;
    const itemNumber = this.item.installmentNumber;

    this.paymentsService.create(payload).subscribe({
      next: (result) => {
        this.processingPayment = false;
        this.close();
        const toast = result.warning
          ? {
              severity: 'warn' as const,
              summary: 'Cobro registrado con advertencia',
              detail: result.warning,
            }
          : isPartial
            ? {
                severity: 'success' as const,
                summary: 'Cobro parcial registrado',
                detail: `Pre-carga registrada. Próxima visita: ${this.formatDate(partialDateIso)}.`,
              }
            : {
                severity: 'success' as const,
                summary: 'Cobro registrado',
                detail: `Pre-carga registrada para la cuota ${itemNumber}. Pendiente de aprobación.`,
              };
        this.paid.emit({ itemId, toast });
      },
      error: (err: AppError) => {
        this.processingPayment = false;
        this.msg.add({
          severity: err.status === 409 || err.status === 422 ? 'warn' : 'error',
          summary:
            err.status === 422
              ? 'Datos inválidos'
              : err.status === 409
                ? 'Advertencia'
                : 'Error',
          detail: err.message ?? 'No se pudo registrar el cobro.',
        });
      },
    });
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
