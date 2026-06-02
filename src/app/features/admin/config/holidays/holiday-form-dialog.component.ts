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
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { AppError } from '../../../../core/models/app-error';
import {
  Holiday,
  HolidayCreatePayload,
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
  selector: 'app-holiday-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    CalendarModule,
    CheckboxModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './holiday-form-dialog.component.html',
})
export class HolidayFormDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Feriado a editar. Null indica modo creación. */
  @Input() holiday: Holiday | null = null;
  /** Emite el feriado creado cuando el alta es exitosa. */
  @Output() created = new EventEmitter<{
    holiday: Holiday;
    recalculatedInstallments: number;
  }>();
  /** Emite el feriado actualizado cuando la edición es exitosa. */
  @Output() updated = new EventEmitter<Holiday>();

  private readonly holidaysService = inject(HolidaysService);
  private readonly messageService = inject(MessageService);

  form: HolidayForm = this.emptyForm();
  saving = false;
  errorMessage = '';

  readonly holidayTypeOptions = [
    { label: 'Extraordinario', value: 'EXTRAORDINARY' as HolidayType },
    { label: 'Nacional', value: 'NATIONAL' as HolidayType },
    { label: 'Local', value: 'LOCAL' as HolidayType },
    { label: 'Bancario', value: 'BANKING' as HolidayType },
  ];

  get isEditMode(): boolean {
    return this.holiday !== null;
  }

  /**
   * Inicializa el formulario con los datos del feriado al abrir el diálogo.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.errorMessage = '';
      this.form = this.holiday
        ? {
            date: this.parseApiDate(this.holiday.date),
            name: this.holiday.name,
            type: this.holiday.type,
            affectsDueDates: this.holiday.affectsDueDates,
            active: this.holiday.active,
            repeatsAnnually: this.holiday.repeatsAnnually,
            recalculateFutureInstallments: false,
          }
        : this.emptyForm();
    }
  }

  /**
   * Indica si el formulario debe mostrar la opción de recálculo de cuotas futuras.
   */
  shouldShowRecalculation(): boolean {
    return this.form.type === 'EXTRAORDINARY';
  }

  /**
   * Sincroniza defaults del flag anual al cambiar el tipo de feriado.
   */
  onTypeChanged(): void {
    if (this.form.type === 'EXTRAORDINARY') {
      this.form.repeatsAnnually = false;
      this.form.recalculateFutureInstallments = false;
      return;
    }
    if (!this.form.repeatsAnnually) {
      this.form.repeatsAnnually = true;
    }
  }

  /**
   * Envía el formulario en modo creación o edición según el estado del input.
   */
  submit(): void {
    if (!this.isValidForm()) return;
    this.isEditMode ? this.submitEdit() : this.submitCreate();
  }

  /**
   * Cierra el diálogo y emite el cambio de visibilidad.
   */
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  /**
   * Persiste un nuevo feriado y emite el resultado al padre.
   */
  private submitCreate(): void {
    const payload: HolidayCreatePayload = {
      date: this.formatDateForPayload(this.form.date),
      name: this.form.name.trim(),
      type: this.form.type,
      affectsDueDates: this.form.affectsDueDates,
      active: this.form.active,
      repeatsAnnually:
        this.form.type === 'EXTRAORDINARY' ? false : this.form.repeatsAnnually,
      recalculateFutureInstallments: this.shouldShowRecalculation()
        ? this.form.recalculateFutureInstallments
        : false,
    };

    this.saving = true;
    this.errorMessage = '';
    this.holidaysService.create(payload).subscribe({
      next: (result) => {
        this.saving = false;
        this.close();
        this.created.emit(result);
      },
      error: (error: AppError) => {
        this.saving = false;
        this.errorMessage = error.message;
      },
    });
  }

  /**
   * Actualiza el feriado existente y emite el registro actualizado al padre.
   */
  private submitEdit(): void {
    if (!this.holiday) return;

    const payload: HolidayUpdatePayload = {
      name: this.form.name.trim(),
      type: this.form.type,
      affectsDueDates: this.form.affectsDueDates,
      active: this.form.active,
      repeatsAnnually:
        this.form.type === 'EXTRAORDINARY' ? false : this.form.repeatsAnnually,
      recalculateFutureInstallments: this.shouldShowRecalculation()
        ? this.form.recalculateFutureInstallments
        : false,
    };

    this.saving = true;
    this.errorMessage = '';
    this.holidaysService.update(this.holiday.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.close();
        this.updated.emit(updated);
      },
      error: (error: AppError) => {
        this.saving = false;
        this.errorMessage = error.message;
      },
    });
  }

  /**
   * Valida campos mínimos requeridos antes de enviar al backend.
   */
  private isValidForm(): boolean {
    return Boolean(this.form.date && this.form.name.trim() && this.form.type);
  }

  /**
   * Convierte una fecha YYYY-MM-DD del backend a un objeto Date para PrimeNG.
   * @param value Fecha serializada recibida desde API.
   */
  private parseApiDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  /**
   * Convierte una fecha seleccionada en PrimeNG al formato YYYY-MM-DD esperado por API.
   * @param value Fecha elegida en el calendario.
   */
  private formatDateForPayload(value: Date | null): string {
    if (!value) return '';
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Devuelve un formulario vacío con defaults seguros.
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
}
