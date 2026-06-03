import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import {
  Holiday,
  HolidayDuplicatePreviewResult,
  HolidayType,
} from '../models/interfaces/holiday.model';
import { HolidaysService } from '../services/holidays.service';
import { HolidayDuplicatePreviewDialogComponent } from './holiday-duplicate-preview-dialog/holiday-duplicate-preview-dialog.component';
import { HolidayFormDialogComponent } from './holiday-form-dialog/holiday-form-dialog.component';

@Component({
  selector: 'app-holidays-config',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    InputTextModule,
    SkeletonModule,
    TagModule,
    ToastModule,
    HolidayFormDialogComponent,
    HolidayDuplicatePreviewDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './holidays-config.component.html',
  styleUrl: './holidays-config.component.scss',
})
export class HolidaysConfigComponent implements OnInit {
  private readonly holidaysService = inject(HolidaysService);
  private readonly messageService = inject(MessageService);

  loading = true;
  previewLoading = false;
  holidays: Holiday[] = [];
  duplicateSourceYear = new Date().getFullYear();

  showFormDialog = false;
  editingHoliday: Holiday | null = null;

  showDuplicatePreviewDialog = false;
  duplicatePreview: HolidayDuplicatePreviewResult | null = null;

  /**
   * Inicializa la pantalla cargando feriados al montar el componente.
   */
  ngOnInit(): void {
    this.loadHolidays();
  }

  /**
   * Devuelve una etiqueta amigable para el tipo de feriado.
   * @param type Tipo de feriado recibido desde backend.
   */
  typeLabel(type: HolidayType): string {
    const labels: Record<HolidayType, string> = {
      EXTRAORDINARY: 'Extraordinario',
      NATIONAL: 'Nacional',
      LOCAL: 'Local',
      BANKING: 'Bancario',
    };
    return labels[type];
  }

  /**
   * Abre el diálogo en modo creación.
   */
  openCreateDialog(): void {
    this.editingHoliday = null;
    this.showFormDialog = true;
  }

  /**
   * Abre el diálogo en modo edición con los datos del feriado seleccionado.
   * @param holiday Feriado a editar.
   */
  openEditDialog(holiday: Holiday): void {
    this.editingHoliday = holiday;
    this.showFormDialog = true;
  }

  /**
   * Agrega el feriado creado a la lista local y muestra toast de confirmación.
   * @param result Resultado de creación emitido por el diálogo hijo.
   */
  onHolidayCreated(result: {
    holiday: Holiday;
    recalculatedInstallments: number;
  }): void {
    this.holidays = [...this.holidays, result.holiday].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    const recalculationSuffix =
      result.recalculatedInstallments > 0
        ? ` Se recalcularon ${result.recalculatedInstallments} cuota(s) futura(s).`
        : '';
    this.messageService.add({
      severity: 'success',
      summary: 'Feriado creado',
      detail: `El feriado se registró correctamente.${recalculationSuffix}`,
    });
  }

  /**
   * Reemplaza el feriado actualizado en la lista local y muestra toast de confirmación.
   * @param updated Feriado actualizado emitido por el diálogo hijo.
   */
  onHolidayUpdated(updated: Holiday): void {
    this.holidays = this.holidays.map((row) =>
      row.id === updated.id ? updated : row,
    );
    this.messageService.add({
      severity: 'success',
      summary: 'Feriado actualizado',
      detail: 'Los cambios se guardaron correctamente.',
    });
  }

  /**
   * Genera vista previa de duplicación al próximo año sin ejecutar escritura.
   */
  previewDuplicateToNextYear(): void {
    if (
      !Number.isInteger(this.duplicateSourceYear) ||
      this.duplicateSourceYear < 2000
    ) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Año inválido',
        detail: 'Ingresá un año origen válido (ej: 2026).',
      });
      return;
    }

    this.previewLoading = true;
    this.holidaysService
      .previewDuplicateToNextYear({ sourceYear: this.duplicateSourceYear })
      .subscribe({
        next: (result) => {
          this.previewLoading = false;
          this.duplicatePreview = result;
          this.showDuplicatePreviewDialog = true;
        },
        error: (error: AppError) => {
          this.previewLoading = false;
          this.messageService.add({
            severity: 'error',
            summary: 'Error de vista previa',
            detail:
              error.message ||
              'No se pudo calcular la vista previa de duplicación.',
          });
        },
      });
  }

  /**
   * Recarga la lista tras una duplicación anual exitosa.
   */
  onDuplicated(): void {
    this.loadHolidays();
  }

  /**
   * Carga feriados desde backend y ordena por fecha descendente.
   */
  private loadHolidays(): void {
    this.loading = true;
    this.holidaysService.getAll().subscribe({
      next: (rows) => {
        this.holidays = [...rows].sort((a, b) => b.date.localeCompare(a.date));
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar los feriados.',
        });
      },
    });
  }
}
