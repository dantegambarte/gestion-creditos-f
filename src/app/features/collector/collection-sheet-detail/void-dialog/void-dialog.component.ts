import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AppError } from '../../../../core/models/app-error';
import { CollectionAttemptsService } from '../../collection-attempts.service';
import {
  ANTECEDENT_TYPE_LABELS,
  AntecedentType,
  CollectionSheetItem,
} from '../../models/collection.model';
import { CollectionDialogSuccess } from '../sheet-dialog.model';

@Component({
  selector: 'app-collection-void-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule],
  templateUrl: './void-dialog.component.html',
})
export class VoidDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() item: CollectionSheetItem | null = null;
  /** Emite cuando la anulación fue exitosa; el padre ejecuta el refresh silencioso. */
  @Output() voided = new EventEmitter<CollectionDialogSuccess>();

  processingVoid = false;

  private readonly attemptsService = inject(CollectionAttemptsService);
  private readonly msg = inject(MessageService);

  close(): void {
    this.visibleChange.emit(false);
  }

  /**
   * Devuelve la etiqueta legible del tipo de antecedente.
   * @param type Tipo de antecedente a mostrar.
   */
  antecedentLabel(type: AntecedentType): string {
    return ANTECEDENT_TYPE_LABELS[type] ?? '';
  }

  /**
   * Confirma la anulación del intento del día.
   */
  confirmVoid(): void {
    if (this.processingVoid) return;
    if (!this.item?.antecedentId) return;
    this.processingVoid = true;
    this.attemptsService.void(this.item.antecedentId).subscribe({
      next: () => {
        this.processingVoid = false;
        this.close();
        this.voided.emit({
          itemId: this.item!.installmentId,
          toast: {
            severity: 'success',
            summary: 'Gestión anulada',
            detail: 'Podés volver a registrar la gestión de la cuota.',
          },
        });
      },
      error: (err: AppError) => {
        this.processingVoid = false;
        this.msg.add({
          severity: err.status === 403 || err.status === 409 ? 'warn' : 'error',
          summary:
            err.status === 403
              ? 'No autorizado'
              : err.status === 409
                ? 'No se pudo anular'
                : 'Error',
          detail: err.message ?? 'No se pudo anular la gestión.',
        });
      },
    });
  }
}
