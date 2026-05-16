import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  CashRegister,
  CashRegisterClosePayload,
  CashRegisterDashboard,
  CashRegisterDashboardRaw,
  CashRegisterFilters,
  CashRegisterRaw,
} from '../models/cash-register.model';

/**
 * Convierte un objeto de tipo CashRegisterDashboardRaw a CashRegisterDashboard.
 * @param r
 * @returns
 */
function toDashboard(r: CashRegisterDashboardRaw): CashRegisterDashboard {
  return {
    date: r.date,
    isClosed: r.is_closed ?? false,
    cashAmount: r.cash_amount,
    transferAmount: r.transfer_amount,
    totalCollected: r.total_collected,
    totalOutflows: r.total_outflows,
    approvedCount: r.approved_count,
    pendingCount: r.pending_count,
    netBalance: r.net_balance ?? 0,
    pendingAmount: r.pending_amount ?? 0,
    downPaymentsTotal: r.down_payments_total ?? 0,
    downPaymentsCount: r.down_payments_count ?? 0,
  };
}

/**
 * Convierte un objeto de tipo CashRegisterRaw a CashRegister.
 * @param r
 * @returns
 */
function toCashRegister(r: CashRegisterRaw): CashRegister {
  return {
    id: r.id,
    registerDate: r.register_date,
    totalCollected: r.total_collected,
    cashAmount: r.cash_amount,
    transferAmount: r.transfer_amount,
    declaredCash: r.declared_cash,
    difference: r.difference,
    differenceStatus: r.difference_status as CashRegister['differenceStatus'],
    observations: r.observations,
    createdAt: r.created_at,
    closedByName: r.closed_by_name,
  };
}

@Injectable({ providedIn: 'root' })
export class CashRegisterService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene el panel de control de cajas.
   * @param date - Fecha opcional en formato YYYY-MM-DD para filtrar el dashboard.
   * @returns
   */
  getDashboard(date?: string): Observable<CashRegisterDashboard> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.api
      .get<CashRegisterDashboardRaw>('cash-register/dashboard', params)
      .pipe(map(toDashboard));
  }

  /**
   * Obtiene todas las cajas.
   * @param filters
   * @returns
   */
  getAll(filters?: CashRegisterFilters): Observable<CashRegister[]> {
    const params: Record<string, string> = {};
    if (filters?.dateFrom) params['date_from'] = filters.dateFrom;
    if (filters?.dateTo) params['date_to'] = filters.dateTo;
    if (filters?.differenceStatus)
      params['difference_status'] = filters.differenceStatus;
    return this.api
      .get<CashRegisterRaw[]>('cash-register', params)
      .pipe(map((items) => items.map(toCashRegister)));
  }

  /**
   * Obtiene una caja específica por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<CashRegister> {
    return this.api
      .get<CashRegisterRaw>(`cash-register/${id}`)
      .pipe(map(toCashRegister));
  }

  /**
   * Cierra una caja.
   * @param payload
   * @returns
   */
  close(payload: CashRegisterClosePayload): Observable<CashRegister> {
    const body: Record<string, unknown> = {
      declared_cash: payload.declaredCash,
    };
    if (payload.observations) body['observations'] = payload.observations;
    if (payload.force) body['force'] = true;
    if (payload.registerDate) body['register_date'] = payload.registerDate;
    return this.api
      .post<CashRegisterRaw>('cash-register/close', body)
      .pipe(map(toCashRegister));
  }
}
