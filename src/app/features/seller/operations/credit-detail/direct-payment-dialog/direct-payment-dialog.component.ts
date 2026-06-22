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
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { RadioButtonModule } from 'primeng/radiobutton';
import { catchError, of } from 'rxjs';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { DateService } from '../../../../../core/services/date.service';
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
    CalendarModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    InputTextareaModule,
    RadioButtonModule,
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

  private readonly dateSvc = inject(DateService);

  /** PRE_CARGA: pasa por el flujo normal (pendiente de aprobación). DIRECT: se registra y aprueba en el mismo paso. */
  registerMode: 'PRE_CARGA' | 'DIRECT' = 'PRE_CARGA';
  maxAmount = 0;
  amount: number | null = null;
  method: 'CASH' | 'TRANSFER' | 'MIXED' = 'CASH';
  amountCash: number | null = null;
  amountTransfer: number | null = null;
  transferRef = '';
  notes = '';
  nextVisitDate = '';
  processing = false;
  readonly todayDate: Date = this.dateSvc.startOfToday();

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Efectivo + transferencia', value: 'MIXED' },
  ];

  private readonly paymentsSvc = inject(PaymentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  /** Precarga el monto máximo cada vez que cambia la cuota seleccionada. */
  ngOnChanges(): void {
    if (this.installment) {
      this.maxAmount = this.installment.amountDue - this.installment.amountPaid;
      this.amount = this.maxAmount;
      this.registerMode = 'PRE_CARGA';
      this.method = 'CASH';
      this.amountCash = null;
      this.amountTransfer = null;
      this.transferRef = '';
      this.notes = '';
      this.nextVisitDate = '';
    }
  }

  /** Un cobro parcial (no cubre el saldo total de la cuota) exige próxima visita en modo pre-carga. */
  get isPartial(): boolean {
    return (this.amount ?? 0) < this.maxAmount;
  }

  get formValid(): boolean {
    return (
      !!this.installment &&
      (this.amount ?? 0) > 0 &&
      (this.amount ?? 0) <= this.maxAmount &&
      (this.registerMode !== 'PRE_CARGA' ||
        !this.isPartial ||
        !!this.nextVisitDate) &&
      (this.method !== 'MIXED' ||
        (Math.round(
          ((this.amountCash ?? 0) + (this.amountTransfer ?? 0)) * 100,
        ) === Math.round((this.amount ?? 0) * 100) &&
          (this.amountCash ?? 0) > 0 &&
          (this.amountTransfer ?? 0) > 0))
    );
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Verifica caja en tiempo real antes de un cobro directo. La pre-carga no
   * mueve caja (igual que un cobrador en la calle), así que no requiere
   * caja abierta.
   */
  confirm(): void {
    if (this.processing || !this.formValid) return;
    this.processing = true;

    if (this.registerMode === 'PRE_CARGA') {
      this.processPayment();
      return;
    }

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
    const payload = {
      installmentId: this.installment!.id,
      amountReceived: this.amount!,
      ...(this.method === 'MIXED'
        ? {
            amountCash: this.amountCash ?? 0,
            amountTransfer: this.amountTransfer ?? 0,
          }
        : { paymentMethod: this.method }),
      transferReference: this.transferRef || undefined,
      notes: this.notes || undefined,
      ...(this.registerMode === 'PRE_CARGA' && this.isPartial
        ? { nextVisitDate: this.nextVisitDate }
        : {}),
    };

    const onSettled = {
      next: () => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Cobro registrado',
          detail:
            this.registerMode === 'DIRECT'
              ? 'El cobro fue registrado y aprobado correctamente.'
              : 'El cobro fue registrado y está pendiente de aprobación.',
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
    };

    if (this.registerMode === 'DIRECT') {
      this.paymentsSvc.adminDirect(payload).subscribe(onSettled);
    } else {
      this.paymentsSvc.create(payload).subscribe(onSettled);
    }
  }
}
