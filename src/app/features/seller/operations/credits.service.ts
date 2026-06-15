import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  ApprovePayload,
  Credit,
  CreditCreatePayload,
  CreditDetail,
  CreditDetailRaw,
  CreditInstallment,
  CreditInstallmentRaw,
  CreditListFilters,
  CreditProduct,
  CreditProductRaw,
  CreditRaw,
  CreditStatus,
  CreditUnit,
  CreditUnitRaw,
  EarlySettlementPayload,
  EarlySettlementResult,
  PlanChangeSimulation,
  PlanChangeResult,
  RejectPayload,
  RefinancePayload,
  RefinanceResult,
  RefinanceResultRaw,
  RefinancingChain,
  SimulatePayload,
  SimulateResult,
  SimulateResultItem,
  SimulateScheduleRow,
  SimulateSummary,
} from '../models/credit.model';

/**
 * Convierte un CreditRaw (formato recibido de la API) a un Credit (formato usado en la app).
 * @param raw
 * @returns
 */
function toCredit(raw: CreditRaw): Credit {
  return {
    id: raw.id,
    type: raw.type,
    totalAmount: raw.total_amount,
    installmentsCount: raw.installments_count,
    paymentFrequency: raw.payment_frequency,
    interestRate: raw.interest_rate,
    status: raw.status,
    createdAt: raw.created_at,
    approvedAt: raw.approved_at,
    customerId: raw.customer_id,
    customerName: raw.customer_name,
    customerDni: raw.customer_dni,
    createdById: raw.created_by_id,
    createdByName: raw.created_by_name,
  };
}

/**
 * Convierte un CreditInstallmentRaw (formato recibido de la API) a un CreditInstallment (formato usado en la app).
 * @param raw
 * @returns
 */
function toInstallment(raw: CreditInstallmentRaw): CreditInstallment {
  return {
    id: raw.id,
    installmentNumber: raw.installment_number,
    dueDate: raw.due_date,
    amountDue: raw.amount_due,
    amountPaid: raw.amount_paid,
    penaltyAmount: raw.penalty_amount,
    status: raw.status,
  };
}

/**
 * Convierte un CreditProductRaw (formato recibido de la API) a un CreditProduct (formato usado en la app).
 * @param raw
 * @returns
 */
function toProduct(raw: CreditProductRaw): CreditProduct {
  return {
    id: raw.id,
    quantity: raw.quantity,
    historicalPrice: raw.historical_price,
    productId: raw.product_id,
    productName: raw.product_name,
    historicalRate: raw.historical_rate,
  };
}

/**
 * Convierte un CreditUnitRaw (formato recibido de la API) a un CreditUnit (formato usado en la app).
 * @param raw
 * @returns
 */
function toCreditUnit(raw: CreditUnitRaw): CreditUnit {
  return {
    id: raw.id,
    historicalPrice: raw.historical_price,
    historicalRate: raw.historical_rate,
    unitId: raw.unit_id,
    unitCode: raw.unit_code,
    unitStatus: raw.unit_status,
    variantId: raw.variant_id,
    color: raw.color,
    size: raw.size,
    capacity: raw.capacity,
    productId: raw.product_id,
    productName: raw.product_name,
  };
}

/**
 * Convierte un CreditDetailRaw (formato recibido de la API) a un CreditDetail (formato usado en la app).
 * @param raw
 * @returns
 */
function toRefinancingChain(
  raw: NonNullable<CreditDetailRaw['refinancing_chain']>,
): RefinancingChain {
  return {
    predecessorId: raw.predecessor_id,
    successorId: raw.successor_id,
    chainDepth: raw.chain_depth,
    chain: raw.chain.map((n) => ({
      id: n.id,
      status: n.status as CreditDetail['status'],
      createdAt: n.created_at,
      depth: n.depth,
    })),
    isRefinancing: raw.is_refinancing,
    isPredecessor: raw.is_predecessor,
  };
}

function toCreditDetail(raw: CreditDetailRaw): CreditDetail {
  const downPayment = raw.down_payment ?? 0;
  return {
    ...toCredit(raw),
    rejectionReason: raw.rejection_reason,
    notes: raw.notes,
    approvedBy: raw.approved_by,
    customerPhone: raw.customer_phone,
    products: raw.products?.map(toProduct),
    units: raw.units?.map(toCreditUnit),
    installments: raw.installments.map(toInstallment),
    downPayment,
    financedAmount: raw.financed_amount ?? Math.max(raw.total_amount - downPayment, 0),
    downPaymentMethod: raw.down_payment_method,
    downPaymentTransferReference: raw.down_payment_transfer_reference,
    prepaidInstallments: raw.prepaid_installments ?? 0,
    prepaidInstallmentsMethod: raw.prepaid_installments_method,
    prepaidInstallmentsTransferReference:
      raw.prepaid_installments_transfer_reference,
    settledAt: raw.settled_at,
    settlementAmount: raw.settlement_amount,
    settlementType: raw.settlement_type,
    refinancedFromCreditId: raw.refinanced_from_credit_id ?? null,
    refinancingChain: raw.refinancing_chain
      ? toRefinancingChain(raw.refinancing_chain)
      : null,
  };
}

/**
 * Convierte un SimulatePayload (formato usado en la app) a un objeto para el cuerpo de la solicitud.
 * @param p
 * @returns
 */
function toSimulateBody(p: SimulatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: p.type,
    installments_count: p.installmentsCount,
    payment_frequency: p.paymentFrequency,
  };
  if (p.products !== undefined && p.products.length > 0) {
    body['products'] = p.products.map((pr) => ({
      variant_id: pr.variantId,
      quantity: pr.quantity,
      installments_count: pr.installmentsCount,
    }));
  }
  if (p.totalAmount !== undefined) body['total_amount'] = p.totalAmount;
  if (p.downPayment !== undefined && p.downPayment > 0) {
    body['down_payment'] = p.downPayment;
  }
  if (p.firstPaymentDate) {
    body['first_payment_date'] = p.firstPaymentDate;
  }
  return body;
}

/**
 * Convierte una fila cruda del cronograma al formato consumido por la app.
 * @param raw
 * @returns
 */
function toSimulateScheduleRow(
  raw: Record<string, unknown>,
): SimulateScheduleRow {
  return {
    installmentNumber: raw['installment_number'] as number,
    dueDate: raw['due_date'] as string,
    amount: raw['amount'] as number,
    capital: raw['capital'] as number | undefined,
    interest: raw['interest'] as number | undefined,
    remainingEstimated: raw['remaining_estimated'] as number | undefined,
  };
}

/**
 * Convierte el resumen crudo de simulación al formato interno.
 * @param raw
 * @returns
 */
function toSimulateSummary(raw: Record<string, unknown>): SimulateSummary {
  return {
    financedAmount: raw['financed_amount'] as number,
    downPayment: raw['down_payment'] as number,
    interestAmount: raw['interest_amount'] as number,
  };
}

/**
 * Convierte el resultado crudo de simulación al formato tipado del frontend.
 * @param raw
 * @returns
 */
function toSimulateResult(raw: Record<string, unknown>): SimulateResult {
  const result: SimulateResult = {
    type: raw['type'] as string,
    paymentFrequency: raw['payment_frequency'] as string,
    installmentsCount: raw['installments_count'] as number,
    totalAmount: raw['total_amount'] as number,
    installmentAmount: raw['installment_amount'] as number,
    totalToReturn: raw['total_to_return'] as number,
    note: (raw['note'] as string) ?? '',
  };
  if (Array.isArray(raw['items'])) {
    result.items = (raw['items'] as Record<string, unknown>[]).map(
        (item): SimulateResultItem => ({
          productId: item['product_id'] as string,
          productName: item['product_name'] as string,
          variantId: item['variant_id'] as string | undefined,
          quantity: item['quantity'] as number,
          unitPrice: item['unit_price'] as number,
          lineTotal: item['line_total'] as number,
          rate: item['rate'] as number,
          installmentContribution: item['installment_contribution'] as number,
          installmentsCount: item['installments_count'] as number | undefined,
        }),
    );
  }
  if (raw['down_payment'] !== undefined) {
    result.downPayment = raw['down_payment'] as number;
  }
  if (raw['financed_amount'] !== undefined) {
    result.financedAmount = raw['financed_amount'] as number;
  } else if (result.downPayment !== undefined) {
    result.financedAmount = Math.max(result.totalAmount - result.downPayment, 0);
  }
  if (raw['interest_amount'] !== undefined) {
    result.interestAmount = raw['interest_amount'] as number;
  }
  if (Array.isArray(raw['schedule'])) {
    result.schedule = (raw['schedule'] as Record<string, unknown>[]).map(
      toSimulateScheduleRow,
    );
  }
  if (raw['summary'] && typeof raw['summary'] === 'object') {
    result.summary = toSimulateSummary(raw['summary'] as Record<string, unknown>);
  }
  return result;
}

/**
 * Convierte un CreditCreatePayload (formato usado en la app) a un objeto para el cuerpo de la solicitud.
 * @param p
 * @returns
 */
function toCreateBody(p: CreditCreatePayload): Record<string, unknown> {
  const body: Record<string, unknown> = {
    customer_id: p.customerId,
    type: p.type,
    installments_count: p.installmentsCount,
    payment_frequency: p.paymentFrequency,
  };
  if (p.firstPaymentDate) body['first_payment_date'] = p.firstPaymentDate;
  if (p.notes) body['notes'] = p.notes;
  if (p.type === 'SALE') {
    body['unit_ids'] = p.units.map((u) => u.unitId);
    const hasDownPayment = p.downPayment !== undefined && p.downPayment > 0;
    const hasAdvancedInstallments =
      p.advancedInstallmentsCount !== undefined && p.advancedInstallmentsCount > 0;

    if (hasDownPayment || hasAdvancedInstallments) {
      body['down_payment'] = p.downPayment ?? 0;
    }

    if (hasDownPayment) {
      if (p.downPaymentMethod) {
        body['down_payment_method'] = p.downPaymentMethod;
      }
      if (p.downPaymentTransferReference) {
        body['down_payment_transfer_reference'] =
          p.downPaymentTransferReference;
      }
    }

    if (p.advancedInstallmentsCount !== undefined && p.advancedInstallmentsCount > 0) {
      body['prepaid_installments'] = p.advancedInstallmentsCount;
      if (p.advancedInstallmentsMethod) {
        body['prepaid_installments_method'] = p.advancedInstallmentsMethod;
      }
      if (p.advancedInstallmentsTransferReference) {
        body['prepaid_installments_transfer_reference'] =
          p.advancedInstallmentsTransferReference;
      }
    }
  } else {
    body['total_amount'] = p.totalAmount;
  }
  return body;
}

@Injectable({ providedIn: 'root' })
export class CreditsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Simula un crédito según los parámetros proporcionados.
   * @param payload
   * @returns
   */
  simulate(payload: SimulatePayload): Observable<SimulateResult> {
    return this.api
      .post<
        Record<string, unknown>
      >('credits/simulate', toSimulateBody(payload))
      .pipe(map(toSimulateResult));
  }

  /**
   * Lista los créditos según los filtros especificados.
   * @param filters
   * @returns
   */
  list(filters?: CreditListFilters): Observable<Credit[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.type) params['type'] = filters.type;
    if (filters?.customerId) params['customer_id'] = filters.customerId;
    return this.api
      .get<CreditRaw[]>('credits', params)
      .pipe(map((items) => items.map(toCredit)));
  }

  /**
   * Obtiene un crédito por su ID.
   * @param id
   * @returns
   */
  getById(id: string): Observable<CreditDetail> {
    return this.api
      .get<CreditDetailRaw>(`credits/${id}`)
      .pipe(map(toCreditDetail));
  }

  /**
   * Crea un nuevo crédito.
   * @param payload
   * @returns
   */
  create(
    payload: CreditCreatePayload,
  ): Observable<{ id: string; status: CreditStatus }> {
    return this.api.post<{ id: string; status: CreditStatus }>(
      'credits',
      toCreateBody(payload),
    );
  }

  /**
   * Aprueba un crédito.
   * @param id
   * @param payload
   * @returns
   */
  approve(id: string, payload: ApprovePayload): Observable<CreditDetail> {
    const body: Record<string, unknown> = {};
    if (payload.installmentsCount !== undefined) {
      body['installments_count'] = payload.installmentsCount;
    }
    return this.api
      .patch<CreditDetailRaw>(`credits/${id}/approve`, body)
      .pipe(map(toCreditDetail));
  }

  /**
   * Rechaza un crédito.
   * @param id
   * @param payload
   * @returns
   */
  reject(id: string, payload: RejectPayload): Observable<void> {
    return this.api.patch<void>(`credits/${id}/reject`, {
      rejection_reason: payload.rejectionReason,
    });
  }

  /**
   * Inicia una refinanciación del crédito activo indicado.
   * Crea un nuevo crédito LOAN en PENDING_APPROVAL con el saldo trasladado.
   * @param id - ID del crédito a refinanciar.
   * @param payload - Parámetros de la refinanciación.
   * @returns Resultado con el nuevo crédito y el snapshot financiero.
   */
  refinance(id: string, payload: RefinancePayload): Observable<RefinanceResult> {
    const body: Record<string, unknown> = {
      installments_count: payload.installmentsCount,
      payment_frequency: payload.paymentFrequency,
      reason: payload.reason,
    };
    if (payload.extraCharges !== undefined && payload.extraCharges > 0)
      body['extra_charges'] = payload.extraCharges;
    if (payload.notes) body['notes'] = payload.notes;
    return this.api
      .post<RefinanceResultRaw>(`credits/${id}/refinance`, body)
      .pipe(
        map((raw): RefinanceResult => ({
          originalCreditId: raw.original_credit_id,
          newCredit: {
            id: raw.new_credit.id,
            type: raw.new_credit.type,
            totalAmount: raw.new_credit.total_amount,
            installmentsCount: raw.new_credit.installments_count,
            paymentFrequency: raw.new_credit.payment_frequency,
            status: raw.new_credit.status,
            refinancedFromCreditId: raw.new_credit.refinanced_from_credit_id,
            createdAt: raw.new_credit.created_at,
          },
          pendingBalance: raw.pending_balance,
          extraCharges: raw.extra_charges,
          totalTransferred: raw.total_transferred,
          message: raw.message,
        })),
      );
  }

  /**
   * Simula un cambio de plan (solo lectura). El plan destino lo determina el
   * backend (cuotas_pagadas + 1); no recibe parámetros además del id.
   * @param id - ID del crédito ACTIVE.
   * @returns Simulación con saldo recalculado y cuotas afectadas.
   */
  simulatePlanChange(id: string): Observable<PlanChangeSimulation> {
    return this.api.get<PlanChangeSimulation>(
      `credits/${id}/plan-change/simulate`,
    );
  }

  /**
   * Ejecuta el cambio de plan (admin-only, sin doble aprobación). Definitivo.
   * @param id - ID del crédito ACTIVE.
   * @param payload - Motivo opcional.
   * @returns Resultado del cambio + id de auditoría.
   */
  changePlan(
    id: string,
    payload: { reason?: string } = {},
  ): Observable<PlanChangeResult> {
    const body: Record<string, unknown> = {};
    if (payload.reason) body['reason'] = payload.reason;
    return this.api
      .post<Record<string, unknown>>(`credits/${id}/plan-change`, body)
      .pipe(
        map(
          (raw): PlanChangeResult => ({
            currentPlan: raw['currentPlan'] as PlanChangeResult['currentPlan'],
            newPlan: raw['newPlan'] as PlanChangeResult['newPlan'],
            totalPaid: raw['totalPaid'] as number,
            newCreditTotal: raw['newCreditTotal'] as number,
            newBalance: raw['newBalance'] as number,
            survivingInstallmentId:
              (raw['survivingInstallmentId'] as string | null) ?? null,
            cancelledInstallments:
              (raw['cancelledInstallments'] as number[]) ?? [],
            creditWillBeSettled: raw['creditWillBeSettled'] as boolean,
            planChangeId: raw['plan_change_id'] as string,
            executedAt: raw['executed_at'] as string,
            message: raw['message'] as string,
          }),
        ),
      );
  }

  /**
   * Realiza un pago anticipado del crédito.
   * @param id
   * @param payload
   * @returns
   */
  earlySettlement(
    id: string,
    payload: EarlySettlementPayload,
  ): Observable<EarlySettlementResult> {
    const body: Record<string, unknown> = {
      payment_method: payload.paymentMethod,
    };
    if (payload.transferReference) {
      body['transfer_reference'] = payload.transferReference;
    }
    return this.api
      .patch<{
        credit_id: string;
        settlement_amount: number;
        payment_method: string;
      }>(`credits/${id}/early-settlement`, body)
      .pipe(
        map((raw) => ({
          creditId: raw.credit_id,
          settlementAmount: raw.settlement_amount,
          paymentMethod: raw.payment_method,
        })),
      );
  }
}
