import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  ExpenseCategory,
  ExpenseCategoryRaw,
} from '../models/interface/expenses';

function toCategory(r: ExpenseCategoryRaw): ExpenseCategory {
  return { id: r.id, name: r.name, active: r.active, createdAt: r.created_at };
}

@Injectable({ providedIn: 'root' })
export class ExpenseCategoriesService {
  private readonly api = inject(ApiHttpService);
  private readonly cache = new Map<string, Observable<ExpenseCategory[]>>();

  /** Invalida todo el caché en memoria para forzar una nueva consulta al backend. */
  invalidateCache(): void {
    this.cache.clear();
  }

  /**
   * Obtiene categorías de gastos desde la API.
   * El resultado se cachea por variante de filtro y se comparte entre suscriptores.
   * @param includeInactive - Indica si se deben incluir categorías inactivas en la respuesta.
   * @returns
   */
  getAll(includeInactive = false): Observable<ExpenseCategory[]> {
    const key = String(includeInactive);
    if (!this.cache.has(key)) {
      const params = includeInactive ? { include_inactive: 'true' } : undefined;
      this.cache.set(
        key,
        this.api.get<ExpenseCategoryRaw[]>('expense-categories', params).pipe(
          map((items) => items.map(toCategory)),
          shareReplay(1),
        ),
      );
    }
    return this.cache.get(key)!;
  }

  /**
   * Crea una nueva categoría de gasto e invalida el caché.
   * @param name
   * @returns
   */
  create(name: string): Observable<ExpenseCategory> {
    return this.api
      .post<ExpenseCategoryRaw>('expense-categories', { name })
      .pipe(
        map(toCategory),
        tap(() => this.invalidateCache()),
      );
  }

  /**
   * Activa una categoría de gasto e invalida el caché.
   * @param id
   * @returns
   */
  activate(id: string): Observable<void> {
    return this.api.patch<void>(`expense-categories/${id}/activate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }

  /**
   * Desactiva una categoría de gasto e invalida el caché.
   * @param id
   * @returns
   */
  deactivate(id: string): Observable<void> {
    return this.api.patch<void>(`expense-categories/${id}/deactivate`).pipe(
      map(() => undefined),
      tap(() => this.invalidateCache()),
    );
  }
}
