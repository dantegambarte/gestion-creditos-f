import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import {
  InterestRate,
  InterestRateCreatePayload,
  InterestRateListFilters,
  InterestRateRaw,
  InterestRateUpdatePayload,
} from '../models/interfaces/interest-rate.model';

/**
 * Convierte un objeto InterestRateRaw a InterestRate.
 * @param r
 * @returns
 */
function toInterestRate(r: InterestRateRaw): InterestRate {
  return {
    id: r.id,
    paymentFrequency: r.payment_frequency as InterestRate['paymentFrequency'],
    installmentsCount: r.installments_count,
    minAmount: r.min_amount,
    maxAmount: r.max_amount,
    rate: r.rate,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class InterestRatesService {
  private readonly api = inject(ApiHttpService);
  private readonly cache = new Map<string, Observable<InterestRate[]>>();

  /** Invalida todo el caché en memoria para forzar una nueva consulta al backend. */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene todas las tasas de interés con los filtros especificados.
   * El resultado se cachea por combinación de filtros y se comparte entre suscriptores.
   * @param filters
   * @returns
   */
  getAll(filters?: InterestRateListFilters): Observable<InterestRate[]> {
    const key = JSON.stringify({
      paymentFrequency: filters?.paymentFrequency ?? null,
      active: filters?.active ?? null,
    });
    if (!this.cache.has(key)) {
      const params: Record<string, string> = {};
      if (filters?.paymentFrequency)
        params['payment_frequency'] = filters.paymentFrequency;
      if (filters?.active !== undefined)
        params['active'] = String(filters.active);
      this.cache.set(
        key,
        this.api.get<InterestRateRaw[]>('interest-rates', params).pipe(
          map((items) => items.map(toInterestRate)),
          shareReplay(1),
        ),
      );
    }
    return this.cache.get(key)!;
  }

  /**
   * Obtiene una tasa de interés por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<InterestRate> {
    return this.api
      .get<InterestRateRaw>(`interest-rates/${id}`)
      .pipe(map(toInterestRate));
  }

  /**
   * Crea una nueva tasa de interés e invalida el caché.
   * @param payload
   * @returns
   */
  create(payload: InterestRateCreatePayload): Observable<InterestRate> {
    const body: Record<string, unknown> = {
      payment_frequency: payload.paymentFrequency,
      installments_count: payload.installmentsCount,
      min_amount: payload.minAmount,
      rate: payload.rate,
    };
    if (payload.maxAmount !== undefined) {
      body['max_amount'] = payload.maxAmount;
    }
    return this.api.post<InterestRateRaw>('interest-rates', body).pipe(
      map(toInterestRate),
      tap(() => this.invalidateCache()),
    );
  }

  /**
   * Actualiza una tasa de interés existente e invalida el caché.
   * @param id
   * @param payload
   * @returns
   */
  update(
    id: string,
    payload: InterestRateUpdatePayload,
  ): Observable<InterestRate> {
    const body: Record<string, unknown> = {};
    if (payload.rate !== undefined) body['rate'] = payload.rate;
    if (payload.active !== undefined) body['active'] = payload.active;
    return this.api.put<InterestRateRaw>(`interest-rates/${id}`, body).pipe(
      map(toInterestRate),
      tap(() => this.invalidateCache()),
    );
  }

  /**
   * Desactiva una tasa de interés existente e invalida el caché.
   * @param id
   * @returns
   */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`interest-rates/${id}/deactivate`, {})
      .pipe(tap(() => this.invalidateCache()));
  }

  /**
   * Activa una tasa de interés existente e invalida el caché.
   * @param id
   * @returns
   */
  activate(id: string): Observable<InterestRate> {
    return this.api
      .patch<InterestRateRaw>(`interest-rates/${id}/activate`, {})
      .pipe(
        map(toInterestRate),
        tap(() => this.invalidateCache()),
      );
  }
}
