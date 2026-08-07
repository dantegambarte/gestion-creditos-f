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
import { RadioButtonModule } from 'primeng/radiobutton';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { PaymentsService } from '../../../../collector/payments.service';
import { PaymentCreatePayload } from '../../../../collector/models/payment.model';
import { RenewPayload } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

/**
 * Diálogo de renovación de un préstamo de una sola cuota. El cargo (interés
 * congelado + mora) es fijo; el admin elige el medio de pago y la modalidad:
 *   · Directo: se registra y aprueba en el acto (POST /credits/:id/renew).
 *   · Pre-carga: queda pendiente de aprobación (POST /payments, RENEWAL).
 * Es la misma operación de negocio RENEWAL por sus dos caminos de pago.
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
    RadioButtonModule,
    CurrencyAmountInputDirective,
  ],
  templateUrl: './renew-dialog.component.html',
})
export class RenewDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() creditId: string | null = null;
  /** Cuota única del préstamo; requerida para el camino pre-carga (POST /payments). */
  @Input() installmentId: string | null = null;
  /** Interés del período a cobrar (monto fijo). */
  @Input() interest = 0;
  /** Mora (manual) acumulada en la cuota; se cobra junto con la renovación. */
  @Input() mora = 0;
  /** Emite cuando la renovación fue registrada; el padre recarga el crédito. */
  @Output() renewed = new EventEmitter<void>();

  /** PRE_CARGA: queda pendiente de aprobación. DIRECT: se registra y aprueba ya. */
  registerMode: 'PRE_CARGA' | 'DIRECT' = 'PRE_CARGA';
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
  private readonly paymentsSvc = inject(PaymentsService);
  private readonly msg = inject(MessageService);

  /** Resetea el formulario cada vez que se abre el diálogo. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.registerMode = 'PRE_CARGA';
      this.method = 'CASH';
      this.amountCash = null;
      this.amountTransfer = null;
      this.transferRef = '';
    }
  }

  /** Total a cobrar = interés del período + mora acumulada en la cuota. */
  get total(): number {
    return this.interest + this.mora;
  }

  /** Total ingresado: en mixto la suma de los medios; en un solo medio, el total. */
  get effectiveAmount(): number {
    return this.method === 'MIXED'
      ? (this.amountCash ?? 0) + (this.amountTransfer ?? 0)
      : this.total;
  }

  get formValid(): boolean {
    if (this.total <= 0) return false;
    if (this.method !== 'MIXED') return true;
    return (
      (this.amountCash ?? 0) > 0 &&
      (this.amountTransfer ?? 0) > 0 &&
      Math.round(this.effectiveAmount * 100) === Math.round(this.total * 100)
    );
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Registra la renovación por la modalidad elegida. En ambas el cargo es el mismo
   * (interés + mora); cambia solo el camino de pago: directo (aprobado ya) o
   * pre-carga (pendiente de aprobación).
   */
  confirm(): void {
    if (this.processing || !this.formValid) return;
    if (this.registerMode === 'DIRECT' && !this.creditId) return;
    if (this.registerMode === 'PRE_CARGA' && !this.installmentId) return;
    this.processing = true;

    const isMixed = this.method === 'MIXED';
    const onSettled = {
      next: () => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Renovación registrada',
          detail:
            this.registerMode === 'DIRECT'
              ? 'Se cobró el interés y se extendió el vencimiento un período.'
              : 'La renovación quedó registrada y pendiente de aprobación.',
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
    };

    if (this.registerMode === 'DIRECT') {
      const payload: RenewPayload = { paymentMethod: this.method };
      if (isMixed) {
        payload.amountCash = this.amountCash ?? 0;
        payload.amountTransfer = this.amountTransfer ?? 0;
      }
      if (this.transferRef) payload.transferReference = this.transferRef;
      this.creditsService.renew(this.creditId!, payload).subscribe(onSettled);
    } else {
      const payload: PaymentCreatePayload = {
        installmentId: this.installmentId!,
        generationType: 'RENEWAL',
        ...(isMixed
          ? {
              amountCash: this.amountCash ?? 0,
              amountTransfer: this.amountTransfer ?? 0,
            }
          : { amountReceived: this.total, paymentMethod: this.method }),
        ...(this.transferRef ? { transferReference: this.transferRef } : {}),
      };
      this.paymentsSvc.create(payload).subscribe(onSettled);
    }
  }
}
