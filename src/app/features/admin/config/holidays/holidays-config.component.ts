import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import {
  Holiday,
  HolidayCreatePayload,
  HolidayDuplicatePreviewResult,
  HolidayDuplicateResult,
  HolidayType,
  HolidayUpdatePayload,
} from '../models/interfaces/holiday.model';
import { HolidaysService } from '../services/holidays.service';

interface HolidayForm {
  date: Date | null;
  name: string;
  type: HolidayType;
  affectsDueDates: boolean;
  active: boolean;
  repeatsAnnually: boolean;
  recalculateFutureInstallments: boolean;
}

@Component({
  selector: 'app-holidays-config',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    CalendarModule,
    CheckboxModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    SkeletonModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './holidays-config.component.html',
  styleUrl: './holidays-config.component.scss',
})
export class HolidaysConfigComponent implements OnInit {
  private readonly holidaysService = inject(HolidaysService);
  private readonly messageService = inject(MessageService);

  loading = true;
  saving = false;
  duplicating = false;
  previewLoading = false;
  holidays: Holiday[] = [];
  errorMessage = '';
  duplicateSourceYear = new Date().getFullYear();
  showDuplicatePreviewDialog = false;
  duplicatePreview: HolidayDuplicatePreviewResult | null = null;

  showCreateDialog = false;
  showEditDialog = false;

  createForm: HolidayForm = this.emptyForm();
  editForm: HolidayForm = this.emptyForm();
  editingHoliday: Holiday | null = null;

  readonly holidayTypeOptions = [
    { label: 'Extraordinario', value: 'EXTRAORDINARY' as HolidayType },
    { label: 'Nacional', value: 'NATIONAL' as HolidayType },
    { label: 'Local', value: 'LOCAL' as HolidayType },
    { label: 'Bancario', value: 'BANKING' as HolidayType },
  ];

  /**
   * Inicializa la pantalla cargando feriados al montar el componente.
   */
  ngOnInit(): void {
    this.loadHolidays();
  }

  /**
   * Devuelve una etiqueta amigable para el tipo de feriado.
   * @param {HolidayType} type - Tipo de feriado recibido desde backend.
   * @returns {string} Etiqueta en español para mostrar en UI.
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
   * Indica si el formulario actual debe mostrar recálculo de cuotas futuras.
   * @param {HolidayForm} form - Formulario de alta o edición.
   * @returns {boolean} Verdadero cuando el tipo es extraordinario.
   */
  shouldShowRecalculation(form: HolidayForm): boolean {
    return form.type === 'EXTRAORDINARY';
  }

  /**
   * Sincroniza defaults del flag anual al cambiar tipo en formularios.
   * @param {HolidayForm} form - Formulario activo en create o edit.
   */
  onTypeChanged(form: HolidayForm): void {
    if (form.type === 'EXTRAORDINARY') {
      form.repeatsAnnually = false;
      form.recalculateFutureInstallments = false;
      return;
    }

    if (!form.repeatsAnnually) {
      form.repeatsAnnually = true;
    }
  }

  /**
   * Abre el modal para crear un feriado nuevo con valores por defecto seguros.
   */
  openCreateDialog(): void {
    this.createForm = this.emptyForm();
    this.errorMessage = '';
    this.showCreateDialog = true;
  }

  /**
   * Abre el modal de edición copiando los datos actuales del feriado.
   * @param {Holiday} holiday - Registro seleccionado para edición.
   */
  openEditDialog(holiday: Holiday): void {
    this.editingHoliday = holiday;
    this.editForm = {
      date: this.parseApiDate(holiday.date),
      name: holiday.name,
      type: holiday.type,
      affectsDueDates: holiday.affectsDueDates,
      active: holiday.active,
      repeatsAnnually: holiday.repeatsAnnually,
      recalculateFutureInstallments: false,
    };
    this.errorMessage = '';
    this.showEditDialog = true;
  }

  /**
   * Persiste un nuevo feriado y notifica claramente si hubo recálculo de cuotas.
   */
  submitCreate(): void {
    if (!this.isValidForm(this.createForm)) return;

    const payload: HolidayCreatePayload = {
      date: this.formatDateForPayload(this.createForm.date),
      name: this.createForm.name.trim(),
      type: this.createForm.type,
      affectsDueDates: this.createForm.affectsDueDates,
      active: this.createForm.active,
      repeatsAnnually:
        this.createForm.type === 'EXTRAORDINARY'
          ? false
          : this.createForm.repeatsAnnually,
      recalculateFutureInstallments: this.shouldShowRecalculation(
        this.createForm,
      )
        ? this.createForm.recalculateFutureInstallments
        : false,
    };

    this.saving = true;
    this.errorMessage = '';
    this.holidaysService.create(payload).subscribe({
      next: (result) => {
        this.saving = false;
        this.showCreateDialog = false;
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
      },
      error: (error: AppError) => {
        this.saving = false;
        this.errorMessage = error.message;
      },
    });
  }

  /**
   * Actualiza un feriado existente usando los cambios del formulario de edición.
   */
  submitEdit(): void {
    if (!this.editingHoliday || !this.isValidForm(this.editForm)) return;

    const payload: HolidayUpdatePayload = {
      name: this.editForm.name.trim(),
      type: this.editForm.type,
      affectsDueDates: this.editForm.affectsDueDates,
      active: this.editForm.active,
      repeatsAnnually:
        this.editForm.type === 'EXTRAORDINARY'
          ? false
          : this.editForm.repeatsAnnually,
      recalculateFutureInstallments: this.shouldShowRecalculation(this.editForm)
        ? this.editForm.recalculateFutureInstallments
        : false,
    };

    this.saving = true;
    this.errorMessage = '';
    this.holidaysService.update(this.editingHoliday.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.showEditDialog = false;
        this.holidays = this.holidays.map((row) =>
          row.id === updated.id ? updated : row,
        );

        this.messageService.add({
          severity: 'success',
          summary: 'Feriado actualizado',
          detail: 'Los cambios se guardaron correctamente.',
        });
      },
      error: (error: AppError) => {
        this.saving = false;
        this.errorMessage = error.message;
      },
    });
  }

  /**
   * Cierra ambos modales y limpia errores de formulario visibles.
   */
  closeDialogs(): void {
    this.showCreateDialog = false;
    this.showEditDialog = false;
    this.showDuplicatePreviewDialog = false;
    this.errorMessage = '';
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
   * Confirma y ejecuta la duplicación anual luego de revisar la vista previa.
   */
  confirmDuplicateToNextYear(): void {
    if (!this.duplicatePreview) return;

    this.duplicating = true;
    this.holidaysService
      .duplicateToNextYear({ sourceYear: this.duplicatePreview.sourceYear })
      .subscribe({
        next: (result) => {
          this.duplicating = false;
          this.showDuplicatePreviewDialog = false;
          this.onDuplicateSuccess(result);
          this.loadHolidays();
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

  /**
   * Devuelve un formulario vacío con defaults pensados para minimizar errores.
   * @returns {HolidayForm} Estado inicial de formulario de feriado.
   */
  private emptyForm(): HolidayForm {
    return {
      date: null,
      name: '',
      type: 'EXTRAORDINARY',
      affectsDueDates: true,
      active: true,
      repeatsAnnually: false,
      recalculateFutureInstallments: false,
    };
  }

  /**
   * Traduce motivos técnicos de omisión a mensajes legibles para administración.
   * @param {string | undefined} reason - Código de omisión retornado por backend.
   * @returns {string} Mensaje amigable para mostrar en la tabla de preview.
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
   * Valida campos mínimos requeridos antes de enviar al backend.
   * @param {HolidayForm} form - Formulario a verificar.
   * @returns {boolean} Verdadero cuando hay valores suficientes para persistir.
   */
  private isValidForm(form: HolidayForm): boolean {
    return Boolean(form.date && form.name.trim() && form.type);
  }

  /**
   * Convierte una fecha YYYY-MM-DD del backend a un objeto Date para PrimeNG.
   * @param {string} value - Fecha serializada recibida desde API.
   * @returns {Date | null} Fecha lista para bind visual o null si falta dato.
   */
  private parseApiDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  /**
   * Convierte una fecha seleccionada en PrimeNG al formato YYYY-MM-DD esperado por API.
   * @param {Date | null} value - Fecha elegida en el calendario.
   * @returns {string} Fecha serializada para persistencia.
   */
  private formatDateForPayload(value: Date | null): string {
    if (!value) return '';
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Muestra un resumen legible del resultado de duplicación anual.
   * @param {HolidayDuplicateResult} result - Resultado devuelto por backend.
   */
  private onDuplicateSuccess(result: HolidayDuplicateResult): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Duplicación completada',
      detail: `Año ${result.sourceYear} → ${result.targetYear}: ${result.createdCount} creado(s), ${result.skippedCount} omitido(s), ${result.conflictsCount} conflicto(s).`,
    });
  }
}
