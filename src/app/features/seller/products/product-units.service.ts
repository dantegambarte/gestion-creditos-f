import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  ProductUnit,
  ProductUnitBulkPayload,
  ProductUnitBulkResult,
  ProductUnitCreatePayload,
  ProductUnitFilters,
  ProductUnitRaw,
  ProductUnitUpdatePayload,
} from '../models/product-unit.model';

function toUnit(raw: ProductUnitRaw): ProductUnit {
  return {
    id: raw.id,
    unitCode: raw.unit_code,
    status: raw.status,
    notes: raw.notes,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    variantId: raw.variant_id,
    color: raw.color,
    size: raw.size,
    capacity: raw.capacity,
    currentPrice: raw.current_price,
    productId: raw.product_id,
    productName: raw.product_name,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductUnitsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene todas las unidades de producto aplicando los filtros indicados.
   */
  getAll(filters?: ProductUnitFilters): Observable<ProductUnit[]> {
    const params: Record<string, string> = {};
    if (filters?.variantId) params['variant_id'] = filters.variantId;
    if (filters?.productId) params['product_id'] = filters.productId;
    if (filters?.status) params['status'] = filters.status;
    return this.api
      .get<ProductUnitRaw[]>('product-units', params)
      .pipe(map((items) => items.map(toUnit)));
  }

  /** Obtiene una unidad por su ID. */
  getById(id: string): Observable<ProductUnit> {
    return this.api
      .get<ProductUnitRaw>(`product-units/${id}`)
      .pipe(map(toUnit));
  }

  /** Crea una nueva unidad para la variante indicada. */
  create(payload: ProductUnitCreatePayload): Observable<ProductUnit> {
    const body: Record<string, unknown> = {
      variant_id: payload.variantId,
      unit_code: payload.unitCode,
    };
    if (payload.notes) body['notes'] = payload.notes;
    return this.api
      .post<ProductUnitRaw>('product-units', body)
      .pipe(map(toUnit));
  }

  /** Crea múltiples unidades en un solo request. */
  createBulk(
    payload: ProductUnitBulkPayload,
  ): Observable<ProductUnitBulkResult> {
    const body = {
      variant_id: payload.variantId,
      units: payload.units.map((u) => {
        const item: Record<string, unknown> = { unit_code: u.unitCode };
        if (u.notes) item['notes'] = u.notes;
        return item;
      }),
    };
    return this.api
      .post<{
        created: number;
        units: ProductUnitRaw[];
      }>('product-units/bulk', body)
      .pipe(
        map((raw) => ({ created: raw.created, units: raw.units.map(toUnit) })),
      );
  }

  /** Actualiza el código y las notas de una unidad existente. */
  update(
    id: string,
    payload: ProductUnitUpdatePayload,
  ): Observable<ProductUnit> {
    const body: Record<string, unknown> = {};
    if (payload.unitCode !== undefined) body['unit_code'] = payload.unitCode;
    if (payload.notes !== undefined) body['notes'] = payload.notes;
    return this.api
      .patch<ProductUnitRaw>(`product-units/${id}`, body)
      .pipe(map(toUnit));
  }

  /** Desactiva una unidad de producto. */
  deactivate(id: string): Observable<void> {
    return this.api.patch<void>(`product-units/${id}/deactivate`, {});
  }

  /** Activa una unidad de producto. */
  activate(id: string): Observable<void> {
    return this.api.patch<void>(`product-units/${id}/activate`, {});
  }
}
