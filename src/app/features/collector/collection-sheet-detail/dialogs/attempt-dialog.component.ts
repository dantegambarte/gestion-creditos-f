import { DatePipe } from '@angular/common';
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
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../core/models/app-error';
import { CollectionAttemptsService } from '../../collection-attempts.service';
import {
  CollectionAttemptCreatePayload,
  CollectionAttemptType,
} from '../../models/collection-attempt.model';
import { CollectionSheetItem } from '../../models/collection.model';
import { CollectionDialogSuccess } from './sheet-dialog.model';

@Component({
  selector: 'app-collection-attempt-dialog',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    DialogModule,
    InputTextModule,
    InputTextareaModule,
  ],
  templateUrl: './attempt-dialog.component.html',
})
export class AttemptDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() item: CollectionSheetItem | null = null;
  @Input() attemptType: CollectionAttemptType = 'NO_PAYMENT';
  /** Emite cuando el intento fue registrado; el padre ejecuta el refresh silencioso. */
  @Output() attempted = new EventEmitter<CollectionDialogSuccess>();

  attemptReason = '';
  attemptNextVisitDate = '';
  attemptNotes = '';
  processingAttempt = false;

  readonly todayDate = new Date();
  readonly todayIso = new Date().toISOString().split('T')[0];

  private readonly attemptsService = inject(CollectionAttemptsService);
  private readonly msg = inject(MessageService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.attemptReason = '';
      this.attemptNextVisitDate = '';
      this.attemptNotes = '';
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  /** Título dinámico del dialog según el tipo de intento. */
  attemptTitle(): string {
    return this.attemptType === 'NO_PAYMENT'
      ? 'Cliente no pagó'
      : 'Cliente no encontrado';
  }

  /**
   * Confirma el intento de cobro. Valida motivo y fecha según el tipo.
   */
  confirmAttempt(): void {
    if (this.processingAttempt) return;
    if (!this.item) return;

    const attemptDateIso =
      this.attemptType === 'NO_PAYMENT' ? this.attemptNextVisitDate : '';

    if (this.attemptType === 'NO_PAYMENT') {
      if (!this.attemptReason.trim()) {
        this.msg.add({
          severity: 'warn',
          summary: 'Motivo requerido',
          detail: 'Ingresá el motivo por el que el cliente no pagó.',
        });
        return;
      }
      if (!attemptDateIso) {
        this.msg.add({
          severity: 'warn',
          summary: 'Fecha requerida',
          detail: 'Indicá la fecha de próxima visita.',
        });
        return;
      }
      if (attemptDateIso < this.todayIso) {
        this.msg.add({
          severity: 'warn',
          summary: 'Fecha inválida',
          detail: 'La próxima visita no puede ser una fecha pasada.',
        });
        return;
      }
    }

    this.processingAttempt = true;
    const payload: CollectionAttemptCreatePayload = {
      installmentId: this.item.installmentId,
      attemptType: this.attemptType,
    };
    if (this.attemptType === 'NO_PAYMENT') {
      payload.reason = this.attemptReason.trim();
      payload.nextVisitDate = attemptDateIso;
    }
    if (this.attemptNotes) payload.notes = this.attemptNotes;

    const itemId = this.item.installmentId;
    const isNoPayment = this.attemptType === 'NO_PAYMENT';
    const nextVisitForToast = attemptDateIso;

    this.attemptsService.create(payload).subscribe({
      next: () => {
        this.processingAttempt = false;
        this.close();
        const toast = isNoPayment
          ? {
              severity: 'success' as const,
              summary: 'Intento registrado',
              detail: `Próxima visita: ${this.formatDate(nextVisitForToast)}.`,
            }
          : {
              severity: 'success' as const,
              summary: 'Intento registrado',
              detail: 'Cliente no encontrado.',
            };
        this.attempted.emit({ itemId, toast });
      },
      error: (err: AppError) => {
        this.processingAttempt = false;
        this.msg.add({
          severity: err.status === 409 || err.status === 422 ? 'warn' : 'error',
          summary:
            err.status === 403
              ? 'Sin acceso'
              : err.status === 422
                ? 'Datos inválidos'
                : 'Error',
          detail: err.message ?? 'No se pudo registrar el intento.',
        });
      },
    });
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
}
