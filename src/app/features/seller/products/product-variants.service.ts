import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  ProductVariant,
  ProductVariantCreatePayload,
  ProductVariantDetail,
  ProductVariantBulkCreatePayload,
  ProductVariantBulkCreateResult,
  ProductVariantBulkCreateResultRaw,
  ProductVariantDetailRaw,
  ProductVariantFilters,
  ProductVariantRaw,
  ProductVariantUpdatePayload,
} from '../models/product-variant.model';

function toVariant(raw: ProductVariantRaw): ProductVariant {
  return {
    id: raw.id,
    color: raw.color,
    size: raw.size,
    capacity: raw.capacity,
    currentPrice: raw.current_price,
    status: raw.status,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    productId: raw.product_id,
    productName: raw.product_name,
    title: raw.title,
    model: raw.model,
    productStatus: raw.product_status,
    brandId: raw.brand_id,
    brandName: raw.brand_name,
    availableCount: raw.available_count,
    reservedCount: raw.reserved_count,
    soldCount: raw.sold_count,
  };
}

// toVariantDetail es un alias: el tipo base ya incluye los contadores
function toVariantDetail(raw: ProductVariantDetailRaw): ProductVariantDetail {
  return toVariant(raw);
}

@Injectable({ providedIn: 'root' })
export class ProductVariantsService {
  private readonly api = inject(ApiHttpService);

    // TODO: agregar documentacion de las funciones

  getAll(filters?: ProductVariantFilters): Observable<ProductVariant[]> {
    const params: Record<string, string> = {};
    if (filters?.productId) params['product_id'] = filters.productId;
    if (filters?.status) params['status'] = filters.status;
    return this.api
      .get<ProductVariantRaw[]>('product-variants', params)
      .pipe(map((items) => items.map(toVariant)));
  }

  getById(id: string): Observable<ProductVariantDetail> {
    return this.api
      .get<ProductVariantDetailRaw>(`product-variants/${id}`)
      .pipe(map(toVariantDetail));
  }

  create(payload: ProductVariantCreatePayload): Observable<ProductVariant> {
    const body: Record<string, unknown> = {
      product_id: payload.productId,
      current_price: payload.currentPrice,
    };
    if (payload.color) body['color'] = payload.color;
    if (payload.size) body['size'] = payload.size;
    if (payload.capacity) body['capacity'] = payload.capacity;
    if (payload.initialUnits !== undefined) body['initial_units'] = payload.initialUnits;
    return this.api
      .post<ProductVariantRaw>('product-variants', body)
      .pipe(map(toVariant));
  }

  /**
   * Crea múltiples variantes y devuelve las filas creadas en bloque.
   * @param {ProductVariantBulkCreatePayload} payload - Producto y filas a crear.
   * @returns {Observable<ProductVariantBulkCreateResult>} Resultado del lote.
   */
  createBulk(
    payload: ProductVariantBulkCreatePayload,
  ): Observable<ProductVariantBulkCreateResult> {
    const body = {
      product_id: payload.productId,
      rows: payload.rows.map((row) => ({
        color: row.color || undefined,
        size: row.size || undefined,
        capacity: row.capacity || undefined,
        current_price: row.currentPrice,
        initial_units: row.initialUnits,
      })),
    };

    return this.api
      .post<ProductVariantBulkCreateResultRaw>('product-variants/bulk', body)
      .pipe(
        map((result) => ({
          created: (result.created || []).map(toVariant),
          rejected: result.rejected || [],
        })),
      );
  }

  update(
    id: string,
    payload: ProductVariantUpdatePayload,
  ): Observable<ProductVariant> {
    const body: Record<string, unknown> = {};
    if (payload.color !== undefined) body['color'] = payload.color;
    if (payload.size !== undefined) body['size'] = payload.size;
    if (payload.capacity !== undefined) body['capacity'] = payload.capacity;
    if (payload.currentPrice !== undefined)
      body['current_price'] = payload.currentPrice;
    return this.api
      .put<ProductVariantRaw>(`product-variants/${id}`, body)
      .pipe(map(toVariant));
  }

  deactivate(id: string): Observable<void> {
    return this.api.patch<void>(`product-variants/${id}/deactivate`, {});
  }

  activate(id: string): Observable<void> {
    return this.api.patch<void>(`product-variants/${id}/activate`, {});
  }
}
