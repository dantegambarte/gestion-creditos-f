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
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../../core/models/app-error';
import { CreditDetail } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';

@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [FormsModule, ButtonModule, DialogModule, InputTextareaModule],
  templateUrl: './reject-dialog.component.html',
})
export class RejectDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() credit: CreditDetail | null = null;
  /** Se emite cuando el rechazo fue persistido; el padre debe recargar. */
  @Output() rejected = new EventEmitter<void>();

  reason = '';
  processing = false;

  private readonly creditsSvc = inject(CreditsService);
  private readonly msg = inject(MessageService);

  /**
   * Limpia el motivo cada vez que el diálogo se abre o cambia el crédito,
   * para no arrastrar texto de un rechazo anterior.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true || changes['credit']) {
      this.reason = '';
    }
  }

  /**
   * Cantidad de caracteres reales del motivo (sin espacios en los extremos).
   */
  charCount(): number {
    return this.reason.trim().length;
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Confirma el rechazo validando longitud mínima del motivo recortado e
   * ignorando confirmaciones repetidas mientras hay una request en curso.
   */
  confirm(): void {
    const reason = this.reason.trim();
    if (!this.credit || this.processing || reason.length < 5) return;
    this.processing = true;
    this.creditsSvc.reject(this.credit.id, { rejectionReason: reason }).subscribe({
      next: () => {
        this.processing = false;
        this.close();
        this.msg.add({
          severity: 'info',
          summary: 'Rechazado',
          detail: 'Crédito rechazado.',
          life: 4000,
        });
        this.rejected.emit();
      },
      error: (err: AppError) => {
        this.processing = false;
        this.msg.add({
          severity: err.status === 409 ? 'warn' : 'error',
          summary: err.status === 409 ? 'Advertencia' : 'Error',
          detail: err.message ?? 'No se pudo rechazar.',
        });
      },
    });
  }
}
