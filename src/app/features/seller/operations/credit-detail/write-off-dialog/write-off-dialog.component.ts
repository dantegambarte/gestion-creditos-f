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
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { CreditDetail, WriteOffResult } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

/**
 * Castigo de un crédito ACTIVE (write off): lo retira de la operatoria de
 * cobranza marcando las cuotas abiertas como incobrables. El saldo pagado y el
 * historial quedan intactos. Operación definitiva (sin reversión), admin-only,
 * sin movimientos de caja. El motivo es obligatorio.
 */
@Component({
  selector: 'app-write-off-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
    CurrencyArsPipe,
  ],
  templateUrl: './write-off-dialog.component.html',
})
export class WriteOffDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  /** Emite cuando el castigo se aplicó con éxito. El padre recarga el crédito. */
  @Output() writtenOff = new EventEmitter<void>();

  reason = '';
  observations = '';
  processing = false;

  private readonly creditsService = inject(CreditsService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.reason = '';
      this.observations = '';
      this.processing = false;
    }
  }

  /** Saldo pendiente que se dejará de cobrar al castigar (cuotas abiertas). */
  get pendingBalance(): number {
    if (!this.credit?.installments) return 0;
    return this.credit.installments
      .filter((i) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(i.status))
      .reduce((sum, i) => sum + (i.amountDue - i.amountPaid), 0);
  }

  /** El motivo es obligatorio (mín. 5 caracteres, igual que el backend). */
  get canConfirm(): boolean {
    return this.reason.trim().length >= 5;
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /** Confirma y ejecuta el castigo del crédito. */
  confirm(): void {
    if (this.processing || !this.credit || !this.canConfirm) return;
    this.processing = true;
    this.creditsService
      .writeOff(this.credit.id, {
        reason: this.reason.trim(),
        observations: this.observations.trim() || undefined,
      })
      .subscribe({
        next: (res: WriteOffResult) => {
          this.processing = false;
          this.close();
          this.msg.add({
            severity: 'success',
            summary: 'Crédito castigado',
            detail: res.message,
            life: 7000,
          });
          this.writtenOff.emit();
        },
        error: (err: AppError) => {
          this.processing = false;
          this.msg.add({
            severity: err.status === 409 ? 'warn' : 'error',
            summary: 'No se pudo castigar el crédito',
            detail: err.message ?? 'Error al castigar el crédito.',
          });
        },
      });
  }
}
