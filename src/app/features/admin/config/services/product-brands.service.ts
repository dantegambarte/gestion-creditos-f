import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import { ProductBrand, ProductBrandRaw } from '../models/interfaces/product';

function parseActive(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function toBrand(r: ProductBrandRaw): ProductBrand {
  return {
    id: r.id,
    name: r.name,
    active: parseActive(r.active),
    createdAt: r.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductBrandsService {
  private readonly api = inject(ApiHttpService);
  private readonly cache = new Map<string, Observable<ProductBrand[]>>();

  /** Invalida todo el caché en memoria para forzar una nueva consulta al backend. */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene todas las marcas de producto.
   * El resultado se cachea por variante de filtro y se comparte entre suscriptores.
   */
  getAll(includeInactive = false): Observable<ProductBrand[]> {
    const key = String(includeInactive);
    if (!this.cache.has(key)) {
      const params = includeInactive ? { include_inactive: 'true' } : undefined;
      this.cache.set(
        key,
        this.api.get<ProductBrandRaw[]>('product-brands', params).pipe(
          map((items) => items.map(toBrand)),
          shareReplay(1),
        ),
      );
    }
    return this.cache.get(key)!;
  }

  /** Obtiene una marca por su ID. */
  getById(id: string): Observable<ProductBrand> {
    return this.api
      .get<ProductBrandRaw>(`product-brands/${id}`)
      .pipe(map(toBrand));
  }

  /** Crea una nueva marca e invalida el caché. */
  create(name: string): Observable<ProductBrand> {
    return this.api.post<ProductBrandRaw>('product-brands', { name }).pipe(
      map(toBrand),
      tap(() => this.invalidateCache()),
    );
  }

  /**
   * Actualiza el nombre de una marca existente e invalida el caché.
   * @param id - ID de la marca a actualizar.
   * @param name - Nuevo nombre.
   */
  update(id: string, name: string): Observable<ProductBrand> {
    return this.api.put<ProductBrandRaw>(`product-brands/${id}`, { name }).pipe(
      map(toBrand),
      tap(() => this.invalidateCache()),
    );
  }

  /** Activa una marca de producto e invalida el caché. */
  activate(id: string): Observable<void> {
    return this.api.patch<void>(`product-brands/${id}/activate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }

  /** Desactiva una marca de producto e invalida el caché. */
  deactivate(id: string): Observable<void> {
    return this.api.patch<void>(`product-brands/${id}/deactivate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }
}
