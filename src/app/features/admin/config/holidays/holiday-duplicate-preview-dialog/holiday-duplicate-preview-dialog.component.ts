import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { AppError } from '../../../../../core/models/app-error';
import {
  HolidayDuplicatePreviewResult,
  HolidayDuplicateResult,
} from '../../models/interfaces/holiday.model';
import { HolidaysService } from '../../services/holidays.service';

@Component({
  selector: 'app-holiday-duplicate-preview-dialog',
  standalone: true,
  imports: [DatePipe, ButtonModule, DialogModule],
  templateUrl: './holiday-duplicate-preview-dialog.component.html',
})
export class HolidayDuplicatePreviewDialogComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() preview: HolidayDuplicatePreviewResult | null = null;
  /** Emite cuando la duplicación se completa con éxito para que el padre recargue. */
  @Output() duplicated = new EventEmitter<void>();

  private readonly holidaysService = inject(HolidaysService);
  private readonly messageService = inject(MessageService);

  duplicating = false;

  /**
   * Cierra el diálogo y emite el cambio de visibilidad.
   */
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /**
   * Ejecuta la duplicación anual confirmada y notifica al padre para recargar la lista.
   */
  confirmDuplicate(): void {
    if (!this.preview) return;

    this.duplicating = true;
    this.holidaysService
      .duplicateToNextYear({ sourceYear: this.preview.sourceYear })
      .subscribe({
        next: (result) => {
          this.duplicating = false;
          this.close();
          this.showDuplicateSuccessToast(result);
          this.duplicated.emit();
        },
        error: (error: AppError) => {
          this.duplicating = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error al duplicar',
            detail: error.message || 'No se pudo duplicar el año de feriados.',
          });
        },
      });
  }

  /**
   * Traduce motivos técnicos de omisión a mensajes legibles.
   * @param reason Código de omisión retornado por backend.
   */
  skippedReasonLabel(reason?: string): string {
    if (reason === 'not_recurring_annual')
      return 'No marcado como anual repetible';
    if (reason === 'duplicate_in_target') return 'Ya existe en año destino';
    if (reason === 'conflict_on_insert') return 'Conflicto al insertar';
    if (reason === 'invalid_target_date')
      return 'Fecha inválida en año destino';
    return 'Omitido';
  }

  /**
   * Muestra un toast con el resumen de la duplicación anual completada.
   * @param result Resultado devuelto por backend.
   */
  private showDuplicateSuccessToast(result: HolidayDuplicateResult): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Duplicación completada',
      detail: `Año ${result.sourceYear} → ${result.targetYear}: ${result.createdCount} creado(s), ${result.skippedCount} omitido(s), ${result.conflictsCount} conflicto(s).`,
    });
  }
}
