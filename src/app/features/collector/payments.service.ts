import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../core/http/api-http.service';
import {
  AdminDirectPayload,
  CreditPayment,
  CreditPaymentRaw,
  Payment,
  PaymentCreatePayload,
  PaymentCreateResult,
  PaymentCreateResultRaw,
  PaymentDetail,
  PaymentDetailRaw,
  PaymentListFilters,
  PaymentRaw,
  ReversePayload,
} from './models/payment.model';

/**
 * Convierte un objeto raw de tipo PaymentRaw en un objeto de tipo Payment.
 * @param raw
 * @returns
 */
function toPayment(raw: PaymentRaw): Payment {
  return {
    id: raw.id,
    installmentId: raw.installment_id,
    amountReceived: raw.amount_received,
    amountCash:
      raw.amount_cash ??
      (raw.payment_method === 'CASH' ? raw.amount_received : 0),
    amountTransfer:
      raw.amount_transfer ??
      (raw.payment_method === 'TRANSFER' ? raw.amount_received : 0),
    paymentMethod: raw.payment_method,
    transferReference: raw.transfer_reference,
    status: raw.status,
    rejectionReason: raw.rejection_reason,
    notes: raw.notes,
    createdAt: raw.created_at,
    approvedAt: raw.approved_at,
    approvedBy: raw.approved_by,
    installmentNumber: raw.installment_number,
    amountDue: raw.amount_due,
    dueDate: raw.due_date,
    creditId: raw.credit_id,
    creditType: raw.credit_type,
    customerName: raw.customer_name,
    customerDni: raw.customer_dni,
    collectorName: raw.collector_name,
    isReversal: raw.is_reversal ?? false,
    adminDirect: raw.admin_direct ?? false,
    parentPaymentId: raw.parent_payment_id ?? null,
    reversalPaymentId: raw.reversal_payment_id ?? null,
    concepto: raw.concepto,
  };
}

/**
 * Convierte un objeto raw de tipo PaymentDetailRaw en un objeto de tipo PaymentDetail.
 * @param raw
 * @returns
 */
function toPaymentDetail(raw: PaymentDetailRaw): PaymentDetail {
  return {
    ...toPayment(raw),
    amountPaid: raw.amount_paid,
    penaltyAmount: raw.penalty_amount,
    customerId: raw.customer_id,
    collectorId: raw.collector_id,
    isReversal: raw.is_reversal ?? false,
    adminDirect: raw.admin_direct ?? false,
    reversalReason: raw.reversal_reason ?? null,
    reversalPaymentId: raw.reversal_payment_id ?? null,
  };
}

/**
 * Convierte un objeto raw de tipo PaymentCreateResultRaw en un objeto de tipo PaymentCreateResult.
 * @param raw
 * @returns
 */
function toCreditPayment(raw: CreditPaymentRaw): CreditPayment {
  return {
    id: raw.id,
    installmentId: raw.installment_id,
    collectorId: raw.collector_id,
    amountReceived: raw.amount_received,
    amountCash:
      raw.amount_cash ??
      (raw.payment_method === 'CASH' ? raw.amount_received : 0),
    amountTransfer:
      raw.amount_transfer ??
      (raw.payment_method === 'TRANSFER' ? raw.amount_received : 0),
    paymentMethod: raw.payment_method,
    transferReference: raw.transfer_reference,
    status: raw.status,
    isReversal: raw.is_reversal,
    reversalReason: raw.reversal_reason,
    adminDirect: raw.admin_direct,
    notes: raw.notes,
    createdAt: raw.created_at,
    approvedAt: raw.approved_at,
    approvedBy: raw.approved_by,
    parentPaymentId: raw.parent_payment_id,
    reversedByPaymentId: raw.reversed_by_payment_id,
    installmentNumber: raw.installment_number,
    amountDue: raw.amount_due,
    dueDate: raw.due_date,
    collectorName: raw.collector_name,
    approverName: raw.approver_name,
  };
}

function toCreateResult(raw: PaymentCreateResultRaw): PaymentCreateResult {
  return {
    id: raw.id,
    installmentId: raw.installment_id,
    amountReceived: raw.amount_received,
    amountCash:
      raw.amount_cash ??
      (raw.payment_method === 'CASH' ? raw.amount_received : 0),
    amountTransfer:
      raw.amount_transfer ??
      (raw.payment_method === 'TRANSFER' ? raw.amount_received : 0),
    paymentMethod: raw.payment_method,
    status: raw.status,
    createdAt: raw.created_at,
    nextVisitDate: raw.next_visit_date ?? null,
    ...(raw.warning ? { warning: raw.warning } : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Lista los pagos según los filtros especificados.
   * @param filters
   * @returns
   */
  list(filters?: PaymentListFilters): Observable<Payment[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.collectorId) params['collector_id'] = filters.collectorId;
    if (filters?.installmentId)
      params['installment_id'] = filters.installmentId;
    if (filters?.dateFrom) params['date_from'] = filters.dateFrom;
    if (filters?.dateTo) params['date_to'] = filters.dateTo;
    return this.api
      .get<PaymentRaw[]>('payments', params)
      .pipe(map((items) => items.map(toPayment)));
  }

  /**
   * Obtiene los detalles de un pago por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<PaymentDetail> {
    return this.api
      .get<PaymentDetailRaw>(`payments/${id}`)
      .pipe(map(toPaymentDetail));
  }

  /**
   * Crea un nuevo pago. Si el cobro queda parcial, `nextVisitDate` es obligatorio
   * (validado en cliente y backend).
   * @param payload
   * @returns
   */
  create(payload: PaymentCreatePayload): Observable<PaymentCreateResult> {
    const body: Record<string, unknown> = {
      installment_id: payload.installmentId,
    };
    if (
      payload.amountCash !== undefined ||
      payload.amountTransfer !== undefined
    ) {
      body['amount_cash'] = payload.amountCash ?? 0;
      body['amount_transfer'] = payload.amountTransfer ?? 0;
    } else {
      body['amount_received'] = payload.amountReceived;
      body['payment_method'] = payload.paymentMethod;
    }
    if (payload.transferReference)
      body['transfer_reference'] = payload.transferReference;
    if (payload.notes) body['notes'] = payload.notes;
    if (payload.nextVisitDate) body['next_visit_date'] = payload.nextVisitDate;
    return this.api
      .post<PaymentCreateResultRaw>('payments', body)
      .pipe(map(toCreateResult));
  }

  /**
   * Aprueba un pago por su ID.
   * @param id
   * @returns
   */
  approve(id: string): Observable<PaymentDetail> {
    return this.api
      .patch<PaymentDetailRaw>(`payments/${id}/approve`)
      .pipe(map(toPaymentDetail));
  }

  /**
   * Rechaza un pago por su ID.
   * @param id
   * @param rejectionReason
   * @returns
   */
  reject(id: string, rejectionReason: string): Observable<void> {
    return this.api.patch<void>(`payments/${id}/reject`, {
      rejection_reason: rejectionReason,
    });
  }

  /**
   * Registra y aprueba un cobro directo (sin pre-carga). Solo admin.
   * @param payload
   * @returns
   */
  adminDirect(payload: AdminDirectPayload): Observable<PaymentDetail> {
    const body: Record<string, unknown> = {
      installment_id: payload.installmentId,
    };
    if (
      payload.amountCash !== undefined ||
      payload.amountTransfer !== undefined
    ) {
      body['amount_cash'] = payload.amountCash ?? 0;
      body['amount_transfer'] = payload.amountTransfer ?? 0;
    } else {
      body['amount_received'] = payload.amountReceived;
      body['payment_method'] = payload.paymentMethod;
    }
    if (payload.transferReference)
      body['transfer_reference'] = payload.transferReference;
    if (payload.notes) body['notes'] = payload.notes;
    if (payload.nextVisitDate) body['next_visit_date'] = payload.nextVisitDate;
    return this.api
      .post<PaymentDetailRaw>('payments/admin-direct', body)
      .pipe(map(toPaymentDetail));
  }

  /**
   * Revierte un cobro aprobado y todos sus sub-pagos derivados.
   * @param id
   * @param payload
   * @returns
   */
  reverse(id: string, payload: ReversePayload): Observable<PaymentDetail> {
    return this.api
      .post<PaymentDetailRaw>(`payments/${id}/reverse`, {
        reason: payload.reason,
      })
      .pipe(map(toPaymentDetail));
  }

  /**
   * Lista todos los cobros aprobados de un crédito.
   * @param creditId
   * @returns
   */
  listByCredit(creditId: string): Observable<CreditPayment[]> {
    return this.api
      .get<CreditPaymentRaw[]>(`credits/${creditId}/payments`)
      .pipe(map((items) => items.map(toCreditPayment)));
  }
}
