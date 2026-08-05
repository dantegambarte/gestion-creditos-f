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
import * as overpayment from '../../../../../shared/utils/overpayment.util';

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
  /**
   * Saldo total pendiente del crédito (settlementTotalAmount del detalle). Tope
   * hasta el que el admin puede ingresar un excedente que se reparte a las cuotas
   * siguientes. Si es 0 (no se pasó), se cae al saldo de la cuota.
   */
  @Input() creditPendingBalance = 0;
  /** Se emite cuando el cobro fue registrado; el padre debe recargar. */
  @Output() paid = new EventEmitter<void>();

  private readonly dateSvc = inject(DateService);

  /** PRE_CARGA: pasa por el flujo normal (pendiente de aprobación). DIRECT: se registra y aprueba en el mismo paso. */
  registerMode: 'PRE_CARGA' | 'DIRECT' = 'PRE_CARGA';
  /** Saldo pendiente de la cuota seleccionada (base del concepto de pago parcial). */
  installmentBalance = 0;
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
      this.installmentBalance =
        this.installment.amountDue - this.installment.amountPaid;
      // El monto inicial es el de la cuota; el admin decide si cobra un excedente.
      this.amount = this.installmentBalance;
      this.registerMode = 'PRE_CARGA';
      this.method = 'CASH';
      this.amountCash = null;
      this.amountTransfer = null;
      this.transferRef = '';
      this.notes = '';
      this.nextVisitDate = '';
    }
  }

  /**
   * Tope máximo cobrable: el saldo pendiente del crédito. Si no se recibió (0),
   * cae al saldo de la cuota (comportamiento anterior).
   */
  get maxAllowed(): number {
    return this.creditPendingBalance > 0
      ? this.creditPendingBalance
      : this.installmentBalance;
  }

  /**
   * Monto efectivo ingresado. En un solo medio es `amount`; en mixto es la suma de
   * efectivo + transferencia (el total se deriva, no se ingresa por separado, para
   * quedar alineado con el flujo del cobrador).
   */
  get effectiveAmount(): number {
    return this.method === 'MIXED'
      ? (this.amountCash ?? 0) + (this.amountTransfer ?? 0)
      : (this.amount ?? 0);
  }

  /** Un cobro parcial (no cubre el saldo de la cuota) exige próxima visita en pre-carga. */
  get isPartial(): boolean {
    return overpayment.isPartialPayment(
      this.effectiveAmount,
      this.installmentBalance,
    );
  }

  /** El monto supera la cuota y el excedente se aplicará a las cuotas siguientes. */
  get advancesNextInstallments(): boolean {
    return overpayment.advancesNextInstallments(
      this.effectiveAmount,
      this.installmentBalance,
      this.maxAllowed,
    );
  }

  /** El monto supera el saldo total del crédito (tope máximo). */
  get exceedsCreditBalance(): boolean {
    return overpayment.exceedsCreditBalance(
      this.effectiveAmount,
      this.maxAllowed,
    );
  }

  /**
   * Sugiere el máximo cobrable. En un solo medio setea ese monto. En mixto reparte
   * efectivo/transferencia en números ENTEROS que suman el máximo, respetando la
   * proporción ya ingresada, y avisa que son montos SUGERIDOS para verificar/ajustar
   * a los reales.
   */
  adjustToMax(): void {
    if (this.effectiveAmount <= this.maxAllowed) return;
    // Enteros y ≤ máximo: floor evita decimales y no supera el tope.
    const target = Math.floor(this.maxAllowed);
    if (this.method === 'MIXED') {
      const current = (this.amountCash ?? 0) + (this.amountTransfer ?? 0);
      const cash =
        current > 0
          ? Math.round(((this.amountCash ?? 0) / current) * target)
          : Math.floor(target / 2);
      this.amountCash = cash;
      this.amountTransfer = target - cash;
      this.msg.add({
        severity: 'info',
        summary: 'Montos sugeridos',
        detail: `Repartimos efectivo y transferencia para que sumen el máximo ($${target.toLocaleString('es-AR')}). Verificá y ajustá a los montos reales si hace falta.`,
        life: 6000,
      });
    } else {
      this.amount = target;
    }
  }

  get formValid(): boolean {
    return (
      !!this.installment &&
      this.effectiveAmount > 0 &&
      this.effectiveAmount <= this.maxAllowed &&
      (this.registerMode !== 'PRE_CARGA' ||
        !this.isPartial ||
        !!this.nextVisitDate) &&
      (this.method !== 'MIXED' ||
        ((this.amountCash ?? 0) > 0 && (this.amountTransfer ?? 0) > 0))
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
      amountReceived: this.effectiveAmount,
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
          detail: this.errorDetail(err),
        });
      },
    };

    if (this.registerMode === 'DIRECT') {
      this.paymentsSvc.adminDirect(payload).subscribe(onSettled);
    } else {
      this.paymentsSvc.create(payload).subscribe(onSettled);
    }
  }

  /**
   * Mensaje de error legible. El 422 por saldo (caso de concurrencia: el saldo del
   * crédito cambió por una pre-carga pendiente u otra actualización mientras se
   * operaba) se explica de forma clara e invita a revisar el detalle y reintentar.
   */
  private errorDetail(err: AppError): string {
    if (err.message?.includes('WRITTEN_OFF'))
      return 'No se pueden registrar cobros: este crédito está castigado (incobrable).';
    if (err.status === 422 && err.message?.includes('saldo total pendiente'))
      return 'El saldo disponible del crédito cambió mientras realizabas la operación (por ejemplo, por una pre-carga pendiente u otra actualización). Revisá el detalle e intentá nuevamente.';
    return err.message ?? 'No se pudo registrar el cobro.';
  }
}
