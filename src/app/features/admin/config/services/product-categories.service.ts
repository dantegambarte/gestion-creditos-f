import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import {
  ProductCategory,
  ProductCategoryRaw,
} from '../models/interfaces/product';

function parseActive(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseCount(value: ProductCategoryRaw['product_count']): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function toCategory(r: ProductCategoryRaw): ProductCategory {
  return {
    id: r.id,
    name: r.name,
    active: parseActive(r.active),
    createdAt: r.created_at,
    productCount: parseCount(r.product_count),
  };
}

@Injectable({ providedIn: 'root' })
export class ProductCategoriesService {
  private readonly api = inject(ApiHttpService);
  private readonly cache = new Map<string, Observable<ProductCategory[]>>();

  /** Invalida todo el caché en memoria para forzar una nueva consulta al backend. */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene todas las categorías de producto.
   * El resultado se cachea por variante de filtro y se comparte entre suscriptores.
   */
  getAll(includeInactive = false): Observable<ProductCategory[]> {
    const key = String(includeInactive);
    if (!this.cache.has(key)) {
      const params = includeInactive ? { include_inactive: 'true' } : undefined;
      this.cache.set(
        key,
        this.api.get<ProductCategoryRaw[]>('product-categories', params).pipe(
          map((items) => items.map(toCategory)),
          shareReplay(1),
        ),
      );
    }
    return this.cache.get(key)!;
  }

  /** Crea una nueva categoría e invalida el caché. */
  create(name: string): Observable<ProductCategory> {
    return this.api
      .post<ProductCategoryRaw>('product-categories', { name })
      .pipe(
        map(toCategory),
        tap(() => this.invalidateCache()),
      );
  }

  /**
   * Actualiza el nombre de una categoría existente e invalida el caché.
   * @param id - ID de la categoría a actualizar.
   * @param name - Nuevo nombre.
   */
  update(id: string, name: string): Observable<ProductCategory> {
    return this.api
      .put<ProductCategoryRaw>(`product-categories/${id}`, { name })
      .pipe(
        map(toCategory),
        tap(() => this.invalidateCache()),
      );
  }

  /** Activa una categoría de producto e invalida el caché. */
  activate(id: string): Observable<void> {
    return this.api.patch<void>(`product-categories/${id}/activate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }

  /** Desactiva una categoría de producto e invalida el caché. */
  deactivate(id: string): Observable<void> {
    return this.api.patch<void>(`product-categories/${id}/deactivate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }
}
