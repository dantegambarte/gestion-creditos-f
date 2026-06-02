import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import {
  ProductRate,
  ProductRateCreatePayload,
  ProductRateListFilters,
  ProductRateRaw,
  ProductRateUpdatePayload,
} from '../models/interfaces/product';

function toProductRate(r: ProductRateRaw): ProductRate {
  return {
    id: r.id,
    productId: r.product_id,
    productName: r.product_name,
    paymentFrequency: r.payment_frequency as ProductRate['paymentFrequency'],
    installmentsCount: r.installments_count,
    rate: r.rate,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductRatesService {
  private readonly api = inject(ApiHttpService);
  private readonly cache = new Map<string, Observable<ProductRate[]>>();

  /** Invalida todo el caché en memoria para forzar una nueva consulta al backend. */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene todas las tasas de producto con los filtros especificados.
   * El resultado se cachea por productId y se comparte entre suscriptores.
   */
  getAll(filters?: ProductRateListFilters): Observable<ProductRate[]> {
    const key = filters?.productId ?? 'all';
    if (!this.cache.has(key)) {
      const params: Record<string, string> = {};
      if (filters?.productId) params['product_id'] = filters.productId;
      this.cache.set(
        key,
        this.api.get<ProductRateRaw[]>('product-rates', params).pipe(
          map((items) => items.map(toProductRate)),
          shareReplay(1),
        ),
      );
    }
    return this.cache.get(key)!;
  }

  getById(id: string): Observable<ProductRate> {
    return this.api
      .get<ProductRateRaw>(`product-rates/${id}`)
      .pipe(map(toProductRate));
  }

  /** Crea una nueva tasa de producto e invalida el caché. */
  create(payload: ProductRateCreatePayload): Observable<ProductRate> {
    const body = {
      product_id: payload.productId,
      payment_frequency: payload.paymentFrequency,
      installments_count: payload.installmentsCount,
      rate: payload.rate,
    };
    return this.api.post<ProductRateRaw>('product-rates', body).pipe(
      map(toProductRate),
      tap(() => this.invalidateCache()),
    );
  }

  /** Actualiza una tasa de producto existente e invalida el caché. */
  update(
    id: string,
    payload: ProductRateUpdatePayload,
  ): Observable<ProductRate> {
    const body: Record<string, unknown> = {};
    if (payload.rate !== undefined) body['rate'] = payload.rate;
    if (payload.active !== undefined) body['active'] = payload.active;
    return this.api.put<ProductRateRaw>(`product-rates/${id}`, body).pipe(
      map(toProductRate),
      tap(() => this.invalidateCache()),
    );
  }

  /** Desactiva una tasa de producto e invalida el caché. */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`product-rates/${id}/deactivate`, {})
      .pipe(tap(() => this.invalidateCache()));
  }

  /** Activa una tasa de producto e invalida el caché. */
  activate(id: string): Observable<ProductRate> {
    return this.api
      .patch<ProductRateRaw>(`product-rates/${id}/activate`, {})
      .pipe(
        map(toProductRate),
        tap(() => this.invalidateCache()),
      );
  }
}
