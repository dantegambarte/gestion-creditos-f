import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  CashRegister,
  CashConversion,
  CashConversionPayload,
  CashRegisterClosePayload,
  CashRegisterDashboard,
  CashRegisterDashboardRaw,
  CashRegisterDetail,
  CashRegisterDetailRaw,
  CashRegisterFilters,
  CashRegisterPreClose,
  CashRegisterPreCloseRaw,
  CashRegisterRaw,
} from '../models/cash-register.model';
import {
  CashSession,
  CashSessionClosePayload,
  CashSessionDropPayload,
  CashSessionDropResponse,
  CashSessionOpenPayload,
  CashSessionSnapshot,
} from '../models/cash-session.model';
import { ActiveBusinessDay } from '../models/business-day.model';

interface CashConversionRaw {
  id: string;
  register_date: string;
  criteria: 'DAILY' | 'COMPANY';
  source_method: 'CASH' | 'TRANSFER';
  target_method: 'CASH' | 'TRANSFER';
  amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

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
    totalOutflows: r.total_outflows ?? 0,
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

/**
 * Convierte un objeto de tipo CashRegisterDetailRaw a CashRegisterDetail.
 * @param r
 * @returns
 */
function toCashRegisterDetail(r: CashRegisterDetailRaw): CashRegisterDetail {
  return {
    ...toCashRegister(r),
    breakdown: {
      payments: (r.breakdown?.payments ?? []).map((p) => ({
        id:                p.id,
        amountReceived:    p.amount_received,
        paymentMethod:     p.payment_method as 'CASH' | 'TRANSFER',
        transferReference: p.transfer_reference,
        approvedAt:        p.approved_at,
        customerName:      p.customer_name,
        collectorName:     p.collector_name,
        installmentNumber: p.installment_number,
      })),
      downPayments: (r.breakdown?.down_payments ?? []).map((dp) => ({
        id:                dp.id,
        amount:            dp.amount,
        paymentMethod:     dp.payment_method as 'CASH' | 'TRANSFER',
        transferReference: dp.transfer_reference,
        paymentType:       dp.payment_type,
        createdAt:         dp.created_at,
        customerName:      dp.customer_name,
        approvedByName:    dp.approved_by_name,
      })),
      liquidations: (r.breakdown?.liquidations ?? []).map((l) => ({
        id:                l.id,
        totalPaid:         l.total_paid,
        commissionsTotal:  l.commissions_total,
        salaryAmount:      l.salary_amount,
        paymentMethod:     l.payment_method as 'CASH' | 'TRANSFER',
        transferReference: l.transfer_reference,
        paidAt:            l.paid_at,
        employeeName:      l.employee_name,
      })),
      expenses: (r.breakdown?.expenses ?? []).map((e) => ({
        id:                e.id,
        amount:            e.amount,
        description:       e.description,
        paymentMethod:     e.payment_method as 'CASH' | 'TRANSFER',
        transferReference: e.transfer_reference,
        createdAt:         e.created_at,
        createdByName:     e.created_by_name,
      })),
    },
  };
}

/**
 * Convierte un objeto de tipo CashRegisterPreCloseRaw a CashRegisterPreClose.
 * @param r
 * @returns
 */
function toPreClose(r: CashRegisterPreCloseRaw): CashRegisterPreClose {
  return {
    date: r.date,
    ingresos: {
      cobrosEfectivo:        r.ingresos.cobros_efectivo,
      cobrosTransferencia:   r.ingresos.cobros_transferencia,
      enganchesEfectivo:     r.ingresos.enganches_efectivo,
      enganchesTransferencia: r.ingresos.enganches_transferencia,
      totalBruto:            r.ingresos.total_bruto,
    },
    egresos: {
      gastosEfectivo:        r.egresos.gastos_efectivo,
      gastosTransferencia:   r.egresos.gastos_transferencia,
      comisionesEfectivo:    r.egresos.comisiones_efectivo,
      comisionesTransferencia: r.egresos.comisiones_transferencia,
      total:                 r.egresos.total,
    },
    efectivo:       { esperado: r.efectivo.esperado },
    transferencias: { esperado: r.transferencias.esperado },
    pendientes:     { count: r.pendientes.count, amount: r.pendientes.amount },
  };
}

/**
 * Convierte un objeto de tipo CashConversionRaw a CashConversion.
 * @param r
 * @returns
 */
function toCashConversion(r: CashConversionRaw): CashConversion {
  return {
    id: r.id,
    registerDate: r.register_date,
    criteria: r.criteria,
    sourceMethod: r.source_method,
    targetMethod: r.target_method,
    amount: r.amount,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
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
   * Obtiene una caja específica por su ID con el desglose completo de movimientos.
   * @param id
   * @returns
   */
  getById(id: string): Observable<CashRegisterDetail> {
    return this.api
      .get<CashRegisterDetailRaw>(`cash-register/${id}`)
      .pipe(map(toCashRegisterDetail));
  }

  /**
   * Obtiene el desglose pre-cierre del día (solo lectura).
   * @param date - Fecha opcional en formato YYYY-MM-DD.
   * @returns
   */
  getPreClose(date?: string): Observable<CashRegisterPreClose> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.api
      .get<CashRegisterPreCloseRaw>('cash-register/pre-close', params)
      .pipe(map(toPreClose));
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

  /**
   * Registra una conversión interna entre efectivo y transferencia.
   * @param payload
   * @returns
   */
  createConversion(payload: CashConversionPayload): Observable<CashConversion> {
    const body: Record<string, unknown> = {
      criteria: payload.criteria,
      source_method: payload.sourceMethod,
      amount: payload.amount,
    };
    if (payload.notes) body['notes'] = payload.notes;
    if (payload.registerDate) body['register_date'] = payload.registerDate;
    return this.api
      .post<CashConversionRaw>('cash-register/conversions', body)
      .pipe(map(toCashConversion));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // MODELO V4 — Jornada + Caja Operativa
  //
  // Coexisten con los métodos legacy de arriba durante la transición. Cuando
  // se complete la migración (feat/cash-system-cleanup), los métodos legacy
  // desaparecen y este service queda exclusivamente con la API V4.
  // ═════════════════════════════════════════════════════════════════════════

  /** V4: jornada activa (OPEN o READY_TO_CLOSE) de la sucursal default. */
  getActiveBusinessDay(): Observable<ActiveBusinessDay | null> {
    return this.api.get<ActiveBusinessDay | null>('business-days/active');
  }

  /** V4: caja operativa activa de la jornada actual (única por jornada). */
  getActiveSession(): Observable<CashSession | null> {
    return this.api.get<CashSession | null>('cash-sessions/active');
  }

  /**
   * V4: abre una caja operativa para la jornada actual. Solo puede haber UNA
   * OPEN por jornada simultáneamente; si ya existe → 409
   * ACTIVE_SESSION_IN_BUSINESS_DAY. Si la jornada está en READY_TO_CLOSE,
   * vuelve a OPEN automáticamente.
   */
  openSession(payload: CashSessionOpenPayload): Observable<CashSession> {
    const body: Record<string, unknown> = { opening_amount: payload.opening_amount };
    if (payload.shift_label)  body['shift_label']  = payload.shift_label;
    if (payload.observations) body['observations'] = payload.observations;
    return this.api.post<CashSession>('cash-sessions', body);
  }

  /**
   * V4: cierra una caja operativa. declared es dinámico — el frontend arma el
   * array con los métodos de pago activos (DECLARED_PAYMENT_METHODS).
   */
  closeSession(id: string, payload: CashSessionClosePayload): Observable<CashSession> {
    return this.api.post<CashSession>(`cash-sessions/${id}/close`, payload);
  }

  /** V4: snapshot vivo (X report) de una caja. Read-only. */
  getSessionSnapshot(id: string): Observable<CashSessionSnapshot> {
    return this.api.get<CashSessionSnapshot>(`cash-sessions/${id}/snapshot`);
  }

  /**
   * V4: drop de efectivo/transferencia hacia Caja General. Genera DROP_IN
   * automático en la cuenta destino dentro de la misma tx.
   */
  createDrop(id: string, payload: CashSessionDropPayload): Observable<CashSessionDropResponse> {
    const body: Record<string, unknown> = {
      amount:         payload.amount,
      payment_method: payload.payment_method,
    };
    if (payload.destination_account_id) body['destination_account_id'] = payload.destination_account_id;
    if (payload.reason)                  body['reason']                  = payload.reason;
    if (payload.receipt_reference)       body['receipt_reference']       = payload.receipt_reference;
    return this.api.post<CashSessionDropResponse>(`cash-sessions/${id}/drops`, body);
  }

  /**
   * V4: refresh paralelo de jornada + caja activa. Necesario después de cada
   * acción (abrir/cerrar caja, drop) para evitar estados desincronizados en
   * la UI (caja cerrada que sigue mostrándose OPEN hasta recargar).
   */
  refreshJornadaState(): Observable<{
    businessDay: ActiveBusinessDay | null;
    activeSession: CashSession | null;
  }> {
    return forkJoin({
      businessDay:   this.getActiveBusinessDay(),
      activeSession: this.getActiveSession(),
    });
  }
}
