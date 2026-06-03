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
import { CurrencyAmountInputDirective } from '../../../../shared/directives/currency-amount-input.directive';
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
    CurrencyAmountInputDirective,
  ],
  templateUrl: './direct-payment-dialog.component.html',
})
export class DirectPaymentDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Emite tras registrar el cobro con éxito. El padre recarga la lista. */
  @Output() created = new EventEmitter<void>();

  directInstallmentId = '';
  directAmount: number | null = null;
  directMethod: 'CASH' | 'TRANSFER' = 'CASH';
  directTransferRef = '';
  directNotes = '';
  directNextVisitDate = '';
  processingDirect = false;
  readonly todayDate = new Date();

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' as const },
    { label: 'Transferencia', value: 'TRANSFER' as const },
  ];

  private readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private readonly paymentsService = inject(PaymentsService);
  private readonly cashRegisterSvc = inject(CashRegisterService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.directInstallmentId = '';
      this.directAmount = null;
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
        amountReceived: this.directAmount!,
        paymentMethod: this.directMethod,
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
}
