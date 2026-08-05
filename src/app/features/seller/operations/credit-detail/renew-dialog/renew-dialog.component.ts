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
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { RenewPayload } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

/**
 * Diálogo de renovación de un préstamo de una sola cuota. El interés del período
 * es fijo (calculado en el detalle: cuota − capital); el admin solo elige el medio
 * de pago. En mixto, el efectivo + la transferencia deben sumar el interés.
 */
@Component({
  selector: 'app-renew-dialog',
  standalone: true,
  imports: [
    FormsModule,
    CurrencyArsPipe,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './renew-dialog.component.html',
})
export class RenewDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() creditId: string | null = null;
  /** Interés del período a cobrar (monto fijo). */
  @Input() interest = 0;
  /** Emite cuando la renovación fue registrada; el padre recarga el crédito. */
  @Output() renewed = new EventEmitter<void>();

  method: 'CASH' | 'TRANSFER' | 'MIXED' = 'CASH';
  amountCash: number | null = null;
  amountTransfer: number | null = null;
  transferRef = '';
  processing = false;

  readonly PAYMENT_METHOD_OPTIONS = [
    { label: 'Efectivo', value: 'CASH' },
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Efectivo + transferencia', value: 'MIXED' },
  ];

  private readonly creditsService = inject(CreditsService);
  private readonly msg = inject(MessageService);

  /** Resetea el formulario cada vez que se abre el diálogo. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.method = 'CASH';
      this.amountCash = null;
      this.amountTransfer = null;
      this.transferRef = '';
    }
  }

  /** Total ingresado: en mixto la suma de los medios; en un solo medio, el interés. */
  get effectiveAmount(): number {
    return this.method === 'MIXED'
      ? (this.amountCash ?? 0) + (this.amountTransfer ?? 0)
      : this.interest;
  }

  get formValid(): boolean {
    if (this.interest <= 0) return false;
    if (this.method !== 'MIXED') return true;
    return (
      (this.amountCash ?? 0) > 0 &&
      (this.amountTransfer ?? 0) > 0 &&
      Math.round(this.effectiveAmount * 100) === Math.round(this.interest * 100)
    );
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /** Registra la renovación (cobra el interés y extiende el vencimiento). */
  confirm(): void {
    if (this.processing || !this.formValid || !this.creditId) return;
    this.processing = true;

    const payload: RenewPayload = { paymentMethod: this.method };
    if (this.method === 'MIXED') {
      payload.amountCash = this.amountCash ?? 0;
      payload.amountTransfer = this.amountTransfer ?? 0;
    }
    if (this.transferRef) payload.transferReference = this.transferRef;

    this.creditsService.renew(this.creditId, payload).subscribe({
      next: () => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Renovación registrada',
          detail:
            'Se cobró el interés y se extendió el vencimiento un período.',
          life: 5000,
        });
        this.renewed.emit();
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity:
            err.status === 409 || err.status === 422 ? 'warn' : 'error',
          summary:
            err.status === 409 || err.status === 422 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo registrar la renovación.',
        });
      },
    });
  }
}
