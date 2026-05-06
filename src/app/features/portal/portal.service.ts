import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../core/http/api-http.service';
import {
  AccountSummary,
  PortalCredit,
  PortalCreditDetail,
  PortalInstallment,
  UpcomingInstallment,
} from './models/portal.models';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene un resumen de la cuenta del cliente, incluyendo el total adeudado, conteos de cuotas pagadas/pendientes/vencidas, indicador de estado y próximas cuotas a vencer.
   * @returns
   */
  getAccountSummary(): Observable<AccountSummary> {
    return this.api
      .get<Record<string, unknown>>('portal/me')
      .pipe(map(mapAccountSummary));
  }

  /**
   * Obtiene una lista de créditos del cliente.
   * @returns
   */
  getCredits(): Observable<PortalCredit[]> {
    return this.api
      .get<Record<string, unknown>[]>('portal/credits')
      .pipe(map((items) => items.map(mapPortalCredit)));
  }

  /**
   * Obtiene los detalles de un crédito específico del cliente.
   * @param id
   * @returns
   */
  getCreditById(id: string): Observable<PortalCreditDetail> {
    return this.api
      .get<Record<string, unknown>>(`portal/credits/${id}`)
      .pipe(map(mapPortalCreditDetail));
  }
}

/**
 * Mapea los datos de resumen de cuenta del API a la estructura interna.
 * @param raw
 * @returns
 */
function mapAccountSummary(raw: Record<string, unknown>): AccountSummary {
  const upcoming = (
    (raw['upcoming_installments'] as Record<string, unknown>[]) ?? []
  ).map(mapUpcomingInstallment);

  return {
    totalOwed: raw['total_owed'] as number,
    paidCount: raw['paid_count'] as number,
    pendingCount: raw['pending_count'] as number,
    overdueCount: raw['overdue_count'] as number,
    statusIndicator: raw['status_indicator'] as 'GREEN' | 'YELLOW' | 'RED',
    totalPaidAmount: raw['total_paid_amount'] as number,
    pendingPenaltyAmount: raw['pending_penalty_amount'] as number,
    upcomingInstallments: upcoming,
  };
}

/**
 * Mapea los datos de las próximas cuotas del API a la estructura interna.
 * @param raw
 * @returns
 */
function mapUpcomingInstallment(
  raw: Record<string, unknown>,
): UpcomingInstallment {
  return {
    id: raw['id'] as string,
    installmentNumber: raw['installment_number'] as number,
    dueDate: raw['due_date'] as string,
    amountDue: raw['amount_due'] as number,
    amountPaid: raw['amount_paid'] as number,
    penaltyAmount: raw['penalty_amount'] as number,
    status: raw['status'] as 'PENDING' | 'OVERDUE' | 'PARTIAL',
    creditId: raw['credit_id'] as string,
    creditType: raw['credit_type'] as 'SALE' | 'LOAN',
  };
}

/**
 * Mapea los datos de crédito del API a la estructura interna.
 * @param raw
 * @returns
 */
function mapPortalCredit(raw: Record<string, unknown>): PortalCredit {
  return {
    id: raw['id'] as string,
    type: raw['type'] as 'SALE' | 'LOAN',
    totalAmount: raw['total_amount'] as number,
    totalToReturn: raw['total_to_return'] as number,
    installmentsCount: raw['installments_count'] as number,
    paymentFrequency: raw['payment_frequency'] as
      | 'WEEKLY'
      | 'BIWEEKLY'
      | 'MONTHLY',
    status: raw['status'] as 'ACTIVE' | 'SETTLED',
    createdAt: raw['created_at'] as string,
    approvedAt: (raw['approved_at'] as string | null) ?? null,
    totalInstallments: raw['total_installments'] as number,
    paidInstallments: raw['paid_installments'] as number,
    nextDueDate: (raw['next_due_date'] as string | null) ?? null,
    nextDueAmount: (raw['next_due_amount'] as number | null) ?? null,
    pendingPenalty: raw['pending_penalty'] as number,
    hasOverdue: raw['has_overdue'] as boolean,
  };
}

/**
 * Mapea los datos de las cuotas del API a la estructura interna.
 * @param raw
 * @returns
 */
function mapPortalInstallment(raw: Record<string, unknown>): PortalInstallment {
  return {
    id: raw['id'] as string,
    installmentNumber: raw['installment_number'] as number,
    dueDate: raw['due_date'] as string,
    amountDue: raw['amount_due'] as number,
    amountPaid: raw['amount_paid'] as number,
    penaltyAmount: raw['penalty_amount'] as number,
    status: raw['status'] as 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'PAID',
  };
}

/**
 * Mapea los datos de detalle de crédito del API a la estructura interna.
 * @param raw
 * @returns
 */
function mapPortalCreditDetail(
  raw: Record<string, unknown>,
): PortalCreditDetail {
  const base = mapPortalCredit(raw);
  const installments = (
    (raw['installments'] as Record<string, unknown>[]) ?? []
  ).map(mapPortalInstallment);
  return { ...base, installments };
}
