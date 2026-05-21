import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  ApplyPenaltyPayload,
  EarlyPayPayload,
  EarlyPayResult,
  EarlyPayResultRaw,
  Installment,
  InstallmentDetail,
  InstallmentDetailRaw,
  InstallmentListFilters,
  InstallmentRaw,
} from '../models/installment.model';
import {
  ManagementLogEntry,
  ManagementLogEntryRaw,
} from '../../collector/models/management-log.model';

/**
 * Convierte un objeto raw de tipo InstallmentRaw en un objeto de tipo Installment.
 * @param raw
 * @returns
 */
function toInstallment(raw: InstallmentRaw): Installment {
  return {
    id: raw.id,
    creditId: raw.credit_id,
    installmentNumber: raw.installment_number,
    dueDate: raw.due_date,
    amountDue: raw.amount_due,
    amountPaid: raw.amount_paid,
    penaltyAmount: raw.penalty_amount,
    status: raw.status,
    createdAt: raw.created_at,
    creditType: raw.credit_type,
    customerId: raw.customer_id,
    customerName: raw.customer_name,
    customerDni: raw.customer_dni,
    collectorId: raw.collector_id,
    collectorName: raw.collector_name,
  };
}

/**
 * Convierte un objeto raw de tipo InstallmentDetailRaw en un objeto de tipo InstallmentDetail.
 * @param raw
 * @returns
 */
function toInstallmentDetail(raw: InstallmentDetailRaw): InstallmentDetail {
  return {
    ...toInstallment(raw),
    creditTotal: raw.credit_total,
    updatedAt: raw.updated_at,
  };
}

/**
 * Convierte un objeto raw de tipo EarlyPayResultRaw en un objeto de tipo EarlyPayResult.
 * @param raw
 * @returns
 */
function toEarlyPayResult(raw: EarlyPayResultRaw): EarlyPayResult {
  return {
    ...toInstallmentDetail(raw),
    creditSettled: raw.credit_settled,
  };
}

@Injectable({ providedIn: 'root' })
export class InstallmentsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Lista los recibos de crédito según los filtros especificados.
   * @param filters
   * @returns
   */
  list(filters?: InstallmentListFilters): Observable<Installment[]> {
    const params: Record<string, string> = {};
    if (filters?.creditId) params['credit_id'] = filters.creditId;
    if (filters?.status) params['status'] = filters.status;
    return this.api
      .get<InstallmentRaw[]>('installments', params)
      .pipe(map((items) => items.map(toInstallment)));
  }

  /**
   * Obtiene los detalles de un recibo de crédito por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<InstallmentDetail> {
    return this.api
      .get<InstallmentDetailRaw>(`installments/${id}`)
      .pipe(map(toInstallmentDetail));
  }

  /**
   * Aplica una penalidad a un recibo de crédito.
   * @param id
   * @param payload
   * @returns
   */
  applyPenalty(
    id: string,
    payload: ApplyPenaltyPayload,
  ): Observable<Partial<Installment>> {
    const body: Record<string, unknown> = {
      penalty_amount: payload.penaltyAmount,
    };
    if (payload.reason) body['reason'] = payload.reason;
    return this.api
      .patch<{
        id: string;
        amount_due: number;
        penalty_amount: number;
        status: string;
      }>(`installments/${id}/apply-penalty`, body)
      .pipe(
        map((raw) => ({
          id: raw.id,
          amountDue: raw.amount_due,
          penaltyAmount: raw.penalty_amount,
          status: raw.status as Installment['status'],
        })),
      );
  }

  /**
   * Elimina la penalidad de un recibo de crédito.
   * @param id
   * @returns
   */
  waivePenalty(id: string): Observable<Partial<Installment>> {
    return this.api
      .patch<{
        id: string;
        amount_due: number;
        penalty_amount: number;
        status: string;
      }>(`installments/${id}/waive-penalty`)
      .pipe(
        map((raw) => ({
          id: raw.id,
          amountDue: raw.amount_due,
          penaltyAmount: raw.penalty_amount,
          status: raw.status as Installment['status'],
        })),
      );
  }

  /**
   * Realiza un pago anticipado de un recibo de crédito.
   * @param id
   * @param payload
   * @returns
   */
  earlyPay(id: string, payload: EarlyPayPayload): Observable<EarlyPayResult> {
    const body: Record<string, unknown> = {
      payment_method: payload.paymentMethod,
    };
    if (payload.transferReference) {
      body['transfer_reference'] = payload.transferReference;
    }
    return this.api
      .patch<EarlyPayResultRaw>(`installments/${id}/early-pay`, body)
      .pipe(map(toEarlyPayResult));
  }

  /**
   * Devuelve el log cronológico (más reciente primero) de gestiones sobre una cuota:
   * cobros + intentos NO_PAYMENT / NOT_FOUND. Útil para que admin/cobrador vean
   * el historial completo de actividad operativa.
   */
  getManagementLog(installmentId: string): Observable<ManagementLogEntry[]> {
    return this.api
      .get<ManagementLogEntryRaw[]>(`installments/${installmentId}/management-log`)
      .pipe(
        map((items) =>
          items.map((raw) => ({
            eventType: raw.event_type,
            eventId: raw.event_id,
            createdAt: raw.created_at,
            nextVisitDate: raw.next_visit_date,
            reason: raw.reason,
            notes: raw.notes,
            amount: raw.amount,
            paymentStatus: raw.payment_status,
            paymentMethod: raw.payment_method,
            isReversal: raw.is_reversal,
            adminDirect: raw.admin_direct,
            rejectionReason: raw.rejection_reason,
            collectorName: raw.collector_name,
          })),
        ),
      );
  }
}
