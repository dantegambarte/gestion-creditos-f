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
import { DateService } from '../../../../core/services/date.service';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { CollectionSheetItem } from '../../models/collection.model';
import {
  PaymentCreatePayload,
  PaymentMethod,
} from '../../models/payment.model';
import { PaymentsService } from '../../payments.service';
import { CollectionDialogSuccess } from '../sheet-dialog.model';

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

  paymentCashAmount: number | null = null;
  paymentTransferAmount: number | null = null;
  paymentMethod: PaymentMethod = 'CASH';
  transferReference = '';
  paymentNotes = '';
  paymentNextVisitDate = '';
  processingPayment = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Efectivo + transferencia', value: 'MIXED' },
  ];
  private readonly paymentsService = inject(PaymentsService);
  private readonly msg = inject(MessageService);
  private readonly dateSvc = inject(DateService);

  readonly todayDate: Date = this.dateSvc.startOfToday();
  get todayIso(): string {
    return this.dateSvc.toLocalIso(new Date());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true && this.item) {
      this.paymentCashAmount = null;
      this.paymentTransferAmount = null;
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

  /** Devuelve el total ingresado sumando los importes habilitados por medio. */
  get paymentAmount(): number {
    return this.roundMoney(
      (this.paymentCashAmount ?? 0) + (this.paymentTransferAmount ?? 0),
    );
  }

  /** Indica si el método seleccionado usa efectivo. */
  get usesCash(): boolean {
    return this.paymentMethod === 'CASH' || this.paymentMethod === 'MIXED';
  }

  /** Indica si el método seleccionado usa transferencia. */
  get usesTransfer(): boolean {
    return this.paymentMethod === 'TRANSFER' || this.paymentMethod === 'MIXED';
  }

  /** True cuando el formulario no tiene montos válidos o falta referencia bancaria. */
  get paymentFormInvalid(): boolean {
    return (
      this.paymentAmount <= 0 ||
      (!!this.item && this.paymentAmount > this.availableBalance(this.item)) ||
      (this.isPartialPayment() && !this.paymentNextVisitDate)
    );
  }

  /** True si el monto ingresado dejaría la cuota en estado parcial. */
  isPartialPayment(): boolean {
    if (!this.item || this.paymentAmount <= 0) return false;
    return this.paymentAmount < this.availableBalance(this.item);
  }

  /** Ajusta los importes visibles al cambiar entre pago simple y mixto. */
  onPaymentMethodChange(): void {
    if (this.paymentMethod === 'CASH') {
      this.paymentCashAmount = null;
      this.paymentTransferAmount = null;
      this.transferReference = '';
    } else if (this.paymentMethod === 'TRANSFER') {
      this.paymentCashAmount = null;
      this.paymentTransferAmount = null;
    } else {
      this.paymentCashAmount = null;
      this.paymentTransferAmount = null;
    }
    this.onPaymentAmountChange();
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
    if (!this.item || this.paymentFormInvalid) return;

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
      amountCash: this.usesCash ? (this.paymentCashAmount ?? 0) : 0,
      amountTransfer: this.usesTransfer ? (this.paymentTransferAmount ?? 0) : 0,
    };
    if (this.usesTransfer && this.transferReference) {
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

  /** Redondea importes monetarios para evitar decimales residuales en la suma. */
  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
