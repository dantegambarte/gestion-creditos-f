import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AppError } from '../../../../../core/models/app-error';
import { CreditDetail } from '../../../models/credit.model';
import { Installment } from '../../../models/installment.model';
import { InstallmentsService } from '../../installments.service';

@Component({
  selector: 'app-waive-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule],
  templateUrl: './waive-dialog.component.html',
})
export class WaiveDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() installment: CreditDetail['installments'][number] | null = null;
  /** Emite la cuota actualizada para que el padre sincronice su lista. */
  @Output() waived = new EventEmitter<Partial<Installment>>();

  processing = false;

  private readonly installmentsSvc = inject(InstallmentsService);
  private readonly msg = inject(MessageService);

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Confirma la condonación de mora y emite el resultado al padre.
   */
  confirm(): void {
    if (!this.installment) return;
    this.processing = true;
    this.installmentsSvc.waivePenalty(this.installment.id).subscribe({
      next: (updated) => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'success',
          summary: 'Mora condonada',
          detail: 'La mora fue condonada.',
          life: 3000,
        });
        this.waived.emit(updated);
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo condonar mora.',
        });
      },
    });
  }
}
