import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  Product,
  ProductCreatePayload,
  ProductDetail,
  ProductDetailRaw,
  ProductListFilters,
  ProductRaw,
  ProductUpdatePayload,
  ProductVariantSummary,
  ProductVariantSummaryRaw,
} from '../models/product.model';

function toVariant(raw: ProductVariantSummaryRaw): ProductVariantSummary {
  return {
    id: raw.id,
    color: raw.color,
    size: raw.size,
    capacity: raw.capacity,
    currentPrice: raw.current_price,
    status: raw.status,
  };
}

function toProduct(raw: ProductRaw): Product {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    model: raw.model,
    status: raw.status,
    createdAt: raw.created_at,
    categoryId: raw.category_id,
    categoryName: raw.category_name,
    brandId: raw.brand_id,
    brandName: raw.brand_name,
    availableCount: raw.available_count,
    reservedCount: raw.reserved_count,
    soldCount: raw.sold_count,
    variants: (raw.variants ?? []).map(toVariant),
  };
}

function toProductDetail(raw: ProductDetailRaw): ProductDetail {
  return {
    ...toProduct(raw),
    updatedAt: raw.updated_at,
  };
}

function fromCreatePayload(p: ProductCreatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = { title: p.title };
  if (p.description !== undefined) body['description'] = p.description;
  if (p.model !== undefined) body['model'] = p.model;
  if (p.brandId !== undefined) body['brand_id'] = p.brandId;
  if (p.categoryId !== undefined) body['category_id'] = p.categoryId;
  return body;
}

function fromUpdatePayload(p: ProductUpdatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (p.title !== undefined) body['title'] = p.title;
  if (p.description !== undefined) body['description'] = p.description;
  if (p.model !== undefined) body['model'] = p.model;
  if (p.brandId !== undefined) body['brand_id'] = p.brandId;
  if (p.categoryId !== undefined) body['category_id'] = p.categoryId;
  return body;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene la lista de productos aplicando los filtros opcionales de estado, búsqueda y categoría.
   * @param filters - Filtros opcionales: status, search, categoryId.
   */
  list(filters?: ProductListFilters): Observable<Product[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.search) params['search'] = filters.search;
    if (filters?.categoryId) params['category_id'] = filters.categoryId;
    return this.api
      .get<ProductRaw[]>('products', params)
      .pipe(map((items) => items.map(toProduct)));
  }

  /**
   * Obtiene el detalle completo de un producto por su ID, incluyendo variantes y contadores de stock.
   * @param id - UUID del producto.
   */
  getById(id: string): Observable<ProductDetail> {
    return this.api
      .get<ProductDetailRaw>(`products/${id}`)
      .pipe(map(toProductDetail));
  }

  /**
   * Crea un nuevo producto y retorna su detalle completo.
   * Solo incluye en el body los campos definidos (descripción, modelo, marca y categoría son opcionales).
   * @param payload - Datos del producto a crear.
   */
  create(payload: ProductCreatePayload): Observable<ProductDetail> {
    return this.api
      .post<ProductDetailRaw>('products', fromCreatePayload(payload))
      .pipe(map(toProductDetail));
  }

  /**
   * Actualiza un producto existente con los campos provistos. Solo envía los campos definidos en el payload.
   * @param id - UUID del producto.
   * @param payload - Campos a actualizar (todos opcionales).
   */
  update(id: string, payload: ProductUpdatePayload): Observable<ProductDetail> {
    return this.api
      .put<ProductDetailRaw>(`products/${id}`, fromUpdatePayload(payload))
      .pipe(map(toProductDetail));
  }

  /**
   * Desactiva un producto (baja lógica). Solo disponible si el producto no tiene créditos activos.
   * @param id - UUID del producto.
   */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`products/${id}/deactivate`)
      .pipe(map(() => undefined));
  }

  /**
   * Reactiva un producto previamente desactivado.
   * @param id - UUID del producto.
   */
  activate(id: string): Observable<void> {
    return this.api
      .patch<void>(`products/${id}/activate`)
      .pipe(map(() => undefined));
  }
}
