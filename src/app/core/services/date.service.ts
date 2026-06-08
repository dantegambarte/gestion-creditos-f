import { Injectable } from '@angular/core';
import {
  format,
  parseISO,
  isValid,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  addDays,
  isAfter,
  isBefore,
} from 'date-fns';
import { es } from 'date-fns/locale';

@Injectable({ providedIn: 'root' })
export class DateService {
  /**
   * Convierte un string o Date a Date, o null si no es válido.
   * @param value
   * @returns
   */
  parse(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    const d = typeof value === 'string' ? parseISO(value) : value;
    return isValid(d) ? d : null;
  }

  /** Formato de visualización para Argentina (dd/MM/yyyy). */
  display(value: string | Date | null | undefined, fmt = 'dd/MM/yyyy'): string {
    const d = this.parse(value);
    return d ? format(d, fmt, { locale: es }) : '—';
  }

  /** Inicio del día en hora local (para apertura de caja). */
  startOfToday(): Date {
    return startOfDay(new Date());
  }

  /** Fin del día en hora local (para cierre de caja). */
  endOfToday(): Date {
    return endOfDay(new Date());
  }

  /** Días de atraso entre una fecha de vencimiento y hoy. */
  daysOverdue(dueDate: string | Date): number {
    const d = this.parse(dueDate);
    if (!d) return 0;
    const diff = differenceInCalendarDays(new Date(), d);
    return diff > 0 ? diff : 0;
  }

  isOverdue(dueDate: string | Date): boolean {
    return this.daysOverdue(dueDate) > 0;
  }

  /**
   * Convierte una fecha a YYYY-MM-DD usando hora local, sin conversión UTC.
   */
  toLocalIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  addDays = addDays;
  isAfter = isAfter;
  isBefore = isBefore;
}
