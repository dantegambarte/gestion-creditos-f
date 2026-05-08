import { Component, inject } from '@angular/core';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { FormsModule } from '@angular/forms';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { OperationFormService } from '../../operation-form.service';

@Component({
  selector: 'app-step-conditions',
  standalone: true,
  imports: [
    CurrencyArsPipe,
    FormsModule,
    InputNumberModule,
    CalendarModule,
    DropdownModule,
  ],
  templateUrl: './step-conditions.component.html',
})
export class StepConditionsComponent {
  form = inject(OperationFormService);

  /**
   * Fecha mínima permitida para el primer pago (hoy en zona horaria local).
   */
  readonly minFirstDueDate: Date = this.form.getTodayStart();

  /**
   * Informa si la fecha seleccionada quedó en estado inválido.
   * @returns {boolean} true si existe fecha y es anterior a hoy.
   */
  get hasInvalidFirstDueDate(): boolean {
    const selectedDate = this.form.firstDueDate();
    if (!selectedDate) return false;
    return !this.form.isFirstDueDateValid();
  }

  /**
   * Aplica la fecha recibida desde el calendario y bloquea valores anteriores a hoy.
   * Cubre tanto selección con mouse como tipeo manual en el input de PrimeNG.
   * @param {Date | string | null | undefined} value - Valor emitido por el `p-calendar`.
   */
  onFirstDueDateChange(value: Date | string | null | undefined): void {
    const parsedDate = this.parseCalendarValue(value);

    if (!parsedDate || this.form.normalizeToLocalDayStart(parsedDate) < this.minFirstDueDate) {
      this.form.firstDueDate.set(undefined);
      return;
    }

    this.form.firstDueDate.set(parsedDate);
  }

  /**
   * Convierte el valor del calendario a `Date` válida en zona local.
   * @param {Date | string | null | undefined} value - Valor crudo emitido por PrimeNG.
   * @returns {Date | undefined} Fecha válida o `undefined` si no se puede interpretar.
   */
  private parseCalendarValue(
    value: Date | string | null | undefined,
  ): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string') {
      const typedDate = this.parseTypedDate(value);
      if (typedDate) {
        return typedDate;
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return undefined;
  }

  /**
   * Intenta parsear fechas tipeadas en formato `dd/mm/yy` o `dd/mm/yyyy`.
   * @param {string} value - Fecha escrita manualmente en el input.
   * @returns {Date | undefined} Fecha local válida o `undefined` si el formato no coincide.
   */
  private parseTypedDate(value: string): Date | undefined {
    const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!match) return undefined;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year =
      match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);

    const parsed = new Date(year, month - 1, day);
    const isValidDate =
      parsed.getFullYear() === year &&
      parsed.getMonth() === month - 1 &&
      parsed.getDate() === day;

    return isValidDate ? parsed : undefined;
  }
}
