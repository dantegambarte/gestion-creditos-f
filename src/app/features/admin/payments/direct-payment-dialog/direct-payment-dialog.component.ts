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
import { catchError, of } from 'rxjs';
import { AppError } from '../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../core/pipes/currency-ars.pipe';
import { DateService } from '../../../../core/services/date.service';
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
import { PaymentMethod } from '../../../collector/models/payment.model';
import { PaymentsService } from '../../../collector/payments.service';
import { CashRegisterService } from '../../cash-register/cash-register.service';

@Component({
  selector: 'app-direct-payment-dialog',
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
    CurrencyArsPipe,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './direct-payment-dialog.component.html',
})
export class DirectPaymentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Emite tras registrar el cobro con éxito. El padre recarga la lista. */
  @Output() created = new EventEmitter<void>();

  private readonly paymentsService = inject(PaymentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly dateSvc = inject(DateService);
  private readonly msg = inject(MessageService);

  directInstallmentId = '';
  directCashAmount: number | null = null;
  directTransferAmount: number | null = null;
  directMethod: PaymentMethod = 'CASH';
  directTransferRef = '';
  directNotes = '';
  directNextVisitDate = '';
  processingDirect = false;
  readonly todayDate: Date = this.dateSvc.startOfToday();

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
    { label: 'Efectivo + transferencia', value: 'MIXED' as const },
  ];

  private readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.directInstallmentId = '';
      this.directCashAmount = null;
      this.directTransferAmount = null;
      this.directMethod = 'CASH';
      this.directTransferRef = '';
      this.directNotes = '';
      this.directNextVisitDate = '';
      this.processingDirect = false;
    }
  }

  get directFormValid(): boolean {
    return (
      this.UUID_RE.test(this.directInstallmentId.trim()) &&
      this.directAmount > 0
    );
  }

  /** Devuelve el total del cobro directo sumando los importes por medio. */
  get directAmount(): number {
    return this.roundMoney(
      (this.directCashAmount ?? 0) + (this.directTransferAmount ?? 0),
    );
  }

  /** Indica si el método seleccionado usa efectivo. */
  get usesCash(): boolean {
    return this.directMethod === 'CASH' || this.directMethod === 'MIXED';
  }

  /** Indica si el método seleccionado usa transferencia. */
  get usesTransfer(): boolean {
    return this.directMethod === 'TRANSFER' || this.directMethod === 'MIXED';
  }

  get directInstallmentIdInvalid(): boolean {
    return (
      this.directInstallmentId.trim().length > 0 &&
      !this.UUID_RE.test(this.directInstallmentId.trim())
    );
  }

  /** Ajusta importes visibles cuando se cambia el método del cobro directo. */
  onDirectMethodChange(): void {
    if (this.directMethod === 'CASH') {
      this.directCashAmount = null;
      this.directTransferAmount = null;
      this.directTransferRef = '';
    } else if (this.directMethod === 'TRANSFER') {
      this.directCashAmount = null;
      this.directTransferAmount = null;
    } else {
      this.directCashAmount = null;
      this.directTransferAmount = null;
    }
  }

  /**
   * Valida caja y registra el cobro directo.
   */
  confirmDirect(): void {
    if (this.processingDirect || !this.directFormValid) return;
    this.processingDirect = true;

    this.cashRegisterSvc
      .getDashboard()
      .pipe(catchError(() => of(null)))
      .subscribe((dashboard) => {
        if (dashboard?.isClosed) {
          this.processingDirect = false;
          this.msg.add({
            severity: 'error',
            summary: 'Caja Cerrada',
            detail: 'No puedes crear cobros. La caja del día está CERRADA.',
            life: 5000,
          });
          return;
        }
        this.processDirect();
      });
  }

  private processDirect(): void {
    this.paymentsService
      .adminDirect({
        installmentId: this.directInstallmentId.trim(),
        amountCash: this.usesCash ? (this.directCashAmount ?? 0) : 0,
        amountTransfer: this.usesTransfer
          ? (this.directTransferAmount ?? 0)
          : 0,
        transferReference: this.directTransferRef || undefined,
        notes: this.directNotes || undefined,
        nextVisitDate: this.directNextVisitDate || undefined,
      })
      .subscribe({
        next: () => {
          this.processingDirect = false;
          this.visibleChange.emit(false);
          this.msg.add({
            severity: 'success',
            summary: 'Cobro registrado',
            detail: 'El cobro fue registrado y aprobado correctamente.',
            life: 5000,
          });
          this.created.emit();
        },
        error: (err: AppError) => {
          this.processingDirect = false;
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

  /** Redondea importes monetarios para evitar decimales residuales en la suma. */
  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
