import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AppError } from '../../../../../core/models/app-error';
import { CreditDetail } from '../../../models/credit.model';
import {
  ApplyPenaltyPayload,
  Installment,
} from '../../../models/installment.model';
import { InstallmentsService } from '../../installments.service';

@Component({
  selector: 'app-penalty-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule],
  templateUrl: './penalty-dialog.component.html',
})
export class PenaltyDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() installment: CreditDetail['installments'][number] | null = null;
  /** Emite la cuota actualizada para que el padre sincronice su lista. */
  @Output() penaltyApplied = new EventEmitter<Partial<Installment>>();

  amount: number | null = null;
  reason = '';
  processing = false;

  private readonly installmentsSvc = inject(InstallmentsService);
  private readonly msg = inject(MessageService);

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Aplica la mora a la cuota y emite el resultado al padre.
   */
  confirm(): void {
    if (!this.installment || !this.amount || this.amount <= 0) return;
    this.processing = true;

    const payload: ApplyPenaltyPayload = { penaltyAmount: this.amount };
    if (this.reason) payload.reason = this.reason;

    this.installmentsSvc.applyPenalty(this.installment.id, payload).subscribe({
      next: (updated) => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Mora aplicada',
          detail: 'La mora fue aplicada a la cuota.',
          life: 3000,
        });
        this.penaltyApplied.emit(updated);
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo aplicar mora.',
        });
      },
    });
  }
}
