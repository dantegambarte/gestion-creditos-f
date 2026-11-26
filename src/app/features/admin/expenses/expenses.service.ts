import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  Expense,
  ExpenseCreatePayload,
  ExpenseUpdatePayload,
  ExpenseListFilters,
  ExpensePagedRaw,
  ExpensePagedResponse,
  ExpenseRaw,
} from './expense.model';

/** Tope de `limit` que acepta GET /expenses (paginationRules del backend). */
const EXPENSES_MAX_PAGE_SIZE = 100;

/**
 * Convierte un objeto de tipo ExpenseRaw a un objeto de tipo Expense.
 * @param r
 * @returns
 */
function toExpense(r: ExpenseRaw): Expense {
  return {
    id: r.id,
    amount: r.amount,
    description: r.description,
    paymentMethod: r.payment_method as Expense['paymentMethod'],
    transferReference: r.transfer_reference,
    categoryId: r.category_id,
    categoryName: r.category_name,
    expenseDate: r.expense_date,
    source: r.source as Expense['source'],
    createdAt: r.created_at,
    createdByName: r.created_by_name,
  };
}

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene todos los gastos con filtros opcionales.
   * @param filters
   * @returns
   */
  getAll(filters?: ExpenseListFilters): Observable<ExpensePagedResponse> {
    const params: Record<string, string> = {};
    if (filters?.dateFrom) params['date_from'] = filters.dateFrom;
    if (filters?.dateTo) params['date_to'] = filters.dateTo;
    if (filters?.categoryId) params['category_id'] = filters.categoryId;
    params['page'] = String(filters?.page ?? 1);
    params['limit'] = String(filters?.limit ?? 20);
    return this.api
      .get<ExpensePagedRaw>('expenses', params)
      .pipe(map((r) => ({ rows: r.rows.map(toExpense), total: r.total })));
  }

  /**
   * Trae todos los gastos que cumplen los filtros (todas las páginas), para que
   * los KPIs del período usen el dataset completo y no sólo la página visible.
   * El backend no devuelve sumas, sólo el conteo, y limita `limit` a 100.
   * @param filters filtros de fecha/categoría (page y limit se ignoran)
   * @returns todas las filas del período filtrado
   */
  getAllRows(filters?: ExpenseListFilters): Observable<Expense[]> {
    const base = { ...filters, limit: EXPENSES_MAX_PAGE_SIZE };
    return this.getAll({ ...base, page: 1 }).pipe(
      switchMap((first) => {
        const pages = Math.ceil(first.total / EXPENSES_MAX_PAGE_SIZE);
        if (pages <= 1) return of(first.rows);
        const rest = Array.from({ length: pages - 1 }, (_, i) =>
          this.getAll({ ...base, page: i + 2 }).pipe(map((r) => r.rows)),
        );
        return forkJoin(rest).pipe(map((chunks) => first.rows.concat(...chunks)));
      }),
    );
  }

  /**
   * Obtiene un gasto por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<Expense> {
    return this.api.get<ExpenseRaw>(`expenses/${id}`).pipe(map(toExpense));
  }

  /**
   * Crea un nuevo gasto.
   * @param payload
   * @returns
   */
  create(payload: ExpenseCreatePayload): Observable<Expense> {
    const body: Record<string, unknown> = {
      amount: payload.amount,
      description: payload.description,
      payment_method: payload.paymentMethod,
    };
    if (payload.transferReference) {
      body['transfer_reference'] = payload.transferReference;
    }
    if (payload.categoryId) {
      body['category_id'] = payload.categoryId;
    }
    if (payload.expenseDate) {
      body['expense_date'] = payload.expenseDate;
    }
    if (payload.source) {
      body['source'] = payload.source;
    }
    return this.api.post<ExpenseRaw>('expenses', body).pipe(map(toExpense));
  }

  /**
   * Actualiza un gasto existente.
   * @param id
   * @param payload
   * @returns
   */
  update(id: string, payload: ExpenseUpdatePayload): Observable<Expense> {
    const body: Record<string, unknown> = {
      amount: payload.amount,
      description: payload.description,
      payment_method: payload.paymentMethod,
      expense_date: payload.expenseDate,
      category_id: payload.categoryId || null,
      transfer_reference: payload.transferReference || null,
    };
    return this.api.put<ExpenseRaw>(`expenses/${id}`, body).pipe(map(toExpense));
  }

  /**
   * Elimina un gasto por su ID.
   * @param id
   * @returns
   */
  remove(id: string): Observable<void> {
    return this.api.delete<void>(`expenses/${id}`);
  }
}
