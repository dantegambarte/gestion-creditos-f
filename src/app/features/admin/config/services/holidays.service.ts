import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import {
  Holiday,
  HolidayCreatePayload,
  HolidayCreateResult,
  HolidayDuplicatePayload,
  HolidayDuplicatePreviewResult,
  HolidayDuplicateResult,
  HolidayRaw,
  HolidaysListFilters,
  HolidayType,
  HolidayUpdatePayload,
} from '../models/interfaces/holiday.model';

interface HolidayCreateRawResult {
  holiday: HolidayRaw;
  recalculated_installments: number;
}

interface HolidayDuplicateRawResult {
  sourceYear: number;
  targetYear: number;
  createdCount: number;
  skippedCount: number;
  conflictsCount: number;
  created: Array<{
    sourceDate: string;
    targetDate: string;
    type: HolidayType;
    name: string;
  }>;
  skipped: Array<{
    sourceDate: string;
    targetDate: string | null;
    type: HolidayType;
    reason: string;
  }>;
}

interface HolidayDuplicatePreviewRawResult {
  sourceYear: number;
  targetYear: number;
  eligibleCount: number;
  toCreateCount: number;
  skippedCount: number;
  conflictsCount: number;
  invalidDatesCount: number;
  nonRecurringCount: number;
  toCreate: Array<{
    sourceDate: string;
    targetDate: string;
    type: HolidayType;
    name: string;
  }>;
  skipped: Array<{
    sourceDate: string;
    targetDate: string | null;
    type: HolidayType;
    name?: string;
    reason: string;
  }>;
}

/**
 * Convierte un objeto HolidayRaw de API al modelo de UI.
 * @param {HolidayRaw} row - Feriado en formato backend.
 * @returns {Holiday} Feriado en formato frontend.
 */
function toHoliday(row: HolidayRaw): Holiday {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    type: row.type,
    affectsDueDates: row.affects_due_dates,
    active: row.active,
    repeatsAnnually: row.repeats_annually,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class HolidaysService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene el listado de feriados con filtros opcionales.
   * @param {HolidaysListFilters} filters - Filtros por tipo, estado y afectación de vencimientos.
   * @returns {Observable<Holiday[]>} Observable con los feriados normalizados.
   */
  getAll(filters?: HolidaysListFilters): Observable<Holiday[]> {
    const params: Record<string, string> = {};
    if (filters?.type) params['type'] = filters.type;
    if (filters?.active !== undefined)
      params['active'] = String(filters.active);
    if (filters?.affectsDueDates !== undefined) {
      params['affects_due_dates'] = String(filters.affectsDueDates);
    }

    return this.api
      .get<HolidayRaw[]>('holidays', params)
      .pipe(map((items) => items.map(toHoliday)));
  }

  /**
   * Crea un nuevo feriado y devuelve su resultado junto al resumen de recálculo.
   * @param {HolidayCreatePayload} payload - Datos de alta del feriado.
   * @returns {Observable<HolidayCreateResult>} Resultado de creación y recálculo.
   */
  create(payload: HolidayCreatePayload): Observable<HolidayCreateResult> {
    const body: Record<string, unknown> = {
      date: payload.date,
      name: payload.name,
      type: payload.type,
      affects_due_dates: payload.affectsDueDates,
      active: payload.active,
      repeats_annually: payload.repeatsAnnually,
      recalculateFutureInstallments: payload.recalculateFutureInstallments,
    };

    return this.api.post<HolidayCreateRawResult>('holidays', body).pipe(
      map((result) => ({
        holiday: toHoliday(result.holiday),
        recalculatedInstallments: result.recalculated_installments,
      })),
    );
  }

  /**
   * Actualiza un feriado existente.
   * @param {string} id - Identificador del feriado.
   * @param {HolidayUpdatePayload} payload - Campos editables a persistir.
   * @returns {Observable<Holiday>} Feriado actualizado y normalizado.
   */
  update(id: string, payload: HolidayUpdatePayload): Observable<Holiday> {
    const body: Record<string, unknown> = {
      name: payload.name,
      type: payload.type,
      affects_due_dates: payload.affectsDueDates,
      active: payload.active,
      repeats_annually: payload.repeatsAnnually,
    };

    if (payload.recalculateFutureInstallments !== undefined) {
      body['recalculateFutureInstallments'] =
        payload.recalculateFutureInstallments;
    }

    return this.api
      .put<HolidayRaw>(`holidays/${id}`, body)
      .pipe(map((item) => toHoliday(item)));
  }

  /**
   * Duplica feriados elegibles desde un año origen al año siguiente.
   * @param {HolidayDuplicatePayload} payload - Año origen a procesar.
   * @returns {Observable<HolidayDuplicateResult>} Resumen de la operación.
   */
  duplicateToNextYear(
    payload: HolidayDuplicatePayload,
  ): Observable<HolidayDuplicateResult> {
    return this.api
      .post<HolidayDuplicateRawResult>('holidays/duplicate-year', payload)
      .pipe(
        map((result) => ({
          sourceYear: result.sourceYear,
          targetYear: result.targetYear,
          createdCount: result.createdCount,
          skippedCount: result.skippedCount,
          conflictsCount: result.conflictsCount,
          created: result.created,
          skipped: result.skipped,
        })),
      );
  }

  /**
   * Genera una vista previa de duplicación sin escribir datos en backend.
   * @param {HolidayDuplicatePayload} payload - Año origen a simular.
   * @returns {Observable<HolidayDuplicatePreviewResult>} Resumen completo para UI de previsualización.
   */
  previewDuplicateToNextYear(
    payload: HolidayDuplicatePayload,
  ): Observable<HolidayDuplicatePreviewResult> {
    return this.api
      .post<HolidayDuplicatePreviewRawResult>(
        'holidays/duplicate-year/preview',
        payload,
      )
      .pipe(
        map((result) => ({
          sourceYear: result.sourceYear,
          targetYear: result.targetYear,
          eligibleCount: result.eligibleCount,
          toCreateCount: result.toCreateCount,
          skippedCount: result.skippedCount,
          conflictsCount: result.conflictsCount,
          invalidDatesCount: result.invalidDatesCount,
          nonRecurringCount: result.nonRecurringCount,
          toCreate: result.toCreate,
          skipped: result.skipped,
        })),
      );
  }
}
