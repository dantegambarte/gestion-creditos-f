import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import { ProductCategory, ProductCategoryRaw } from '../models/interfaces/product';



function toCategory(r: ProductCategoryRaw): ProductCategory {
  return { id: r.id, name: r.name, active: r.active, createdAt: r.created_at };
}

@Injectable({ providedIn: 'root' })
export class ProductCategoriesService {
  private readonly api = inject(ApiHttpService);

  /** Obtiene todas las categorías de producto. */
  getAll(): Observable<ProductCategory[]> {
    return this.api
      .get<ProductCategoryRaw[]>('product-categories')
      .pipe(map((items) => items.map(toCategory)));
  }

  /** Crea una nueva categoría con el nombre indicado. */
  create(name: string): Observable<ProductCategory> {
    return this.api
      .post<ProductCategoryRaw>('product-categories', { name })
      .pipe(map(toCategory));
  }

  /**
   * Actualiza el nombre de una categoría existente.
   * @param id - ID de la categoría a actualizar.
   * @param name - Nuevo nombre.
   */
  update(id: string, name: string): Observable<ProductCategory> {
    return this.api
      .put<ProductCategoryRaw>(`product-categories/${id}`, { name })
      .pipe(map(toCategory));
  }

  /** Activa una categoría de producto. */
  activate(id: string): Observable<void> {
    return this.api
      .patch<void>(`product-categories/${id}/activate`)
      .pipe(map(() => undefined));
  }

  /** Desactiva una categoría de producto. */
  deactivate(id: string): Observable<void> {
    return this.api
      .patch<void>(`product-categories/${id}/deactivate`)
      .pipe(map(() => undefined));
  }
}
