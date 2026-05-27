import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

  /** Obtiene todas las marcas de producto, incluyendo inactivas cuando se usa en administración. */
  getAll(includeInactive = false): Observable<ProductBrand[]> {
    const params = includeInactive ? { include_inactive: 'true' } : undefined;
    return this.api
      .get<ProductBrandRaw[]>('product-brands', params)
      .pipe(map((items) => items.map(toBrand)));
  }

  /** Obtiene una marca por su ID. */
  getById(id: string): Observable<ProductBrand> {
    return this.api
      .get<ProductBrandRaw>(`product-brands/${id}`)
      .pipe(map(toBrand));
  }

  /** Crea una nueva marca con el nombre indicado. */
  create(name: string): Observable<ProductBrand> {
    return this.api
      .post<ProductBrandRaw>('product-brands', { name })
      .pipe(map(toBrand));
  }

  /**
   * Actualiza el nombre de una marca existente.
   * @param id - ID de la marca a actualizar.
   * @param name - Nuevo nombre.
   */
  update(id: string, name: string): Observable<ProductBrand> {
    return this.api
      .put<ProductBrandRaw>(`product-brands/${id}`, { name })
      .pipe(map(toBrand));
  }

  /** Activa una marca de producto. */
  activate(id: string): Observable<void> {
    return this.api
      .patch<void>(`product-brands/${id}/activate`)
      .pipe(map(() => undefined));
  }

  /** Desactiva una marca de producto. */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`product-brands/${id}/deactivate`)
      .pipe(map(() => undefined));
  }
}
