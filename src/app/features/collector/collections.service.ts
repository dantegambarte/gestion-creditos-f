import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../core/http/api-http.service';
import {
  CollectionAlerts,
  CollectionAlertsOverdueItem,
  CollectionAlertsOverdueItemRaw,
  CollectionAlertsRaw,
  CollectionAlertsUnassignedItem,
  CollectionAlertsUnassignedItemRaw,
  CollectionBatchOutcome,
  CollectionBatchOutcomeRaw,
  CollectionGenerateBatchPayload,
  CollectionGenerateBatchResponseRaw,
  CollectionGenerateOutcome,
  CollectionGeneratePayload,
  CollectionGenerateResult,
  CollectionGenerateResultRaw,
  CollectionGenerateSkippedResult,
  CollectionGenerateSkippedResultRaw,
  CollectionSheet,
  CollectionSheetDetail,
  CollectionSheetDetailRaw,
  CollectionSheetItem,
  CollectionSheetItemRaw,
  CollectionSheetRaw,
} from './models/collection.model';

/**
 * Convierte una representación en bruto de una planilla de cobranza a su forma estructurada.
 */
function toSheet(raw: CollectionSheetRaw): CollectionSheet {
  return {
    id: raw.id,
    sheetDate: raw.sheet_date,
    filterUsed: raw.filter_used,
    status: raw.status,
    createdAt: raw.created_at,
    sentAt: raw.sent_at ?? null,
    collectorId: raw.collector_id,
    collectorName: raw.collector_name,
    totalItems: raw.total_items,
  };
}

/**
 * Mapea la respuesta { skipped: true, existing_sheet } del backend cuando
 * skip_if_exists=true detectó una planilla ACTIVE existente.
 */
function toSkippedResult(
  raw: CollectionGenerateSkippedResultRaw,
): CollectionGenerateSkippedResult {
  return {
    skipped: true,
    existingSheet: {
      id: raw.existing_sheet.id,
      sheetDate: raw.existing_sheet.sheet_date,
      createdAt: raw.existing_sheet.created_at,
      generatedByName: raw.existing_sheet.generated_by_name,
    },
  };
}

/**
 * Convierte una representación en bruto de un ítem de planilla de cobranza a su forma estructurada.
 */
function toSheetItem(raw: CollectionSheetItemRaw): CollectionSheetItem {
  return {
    orderNumber: raw.order_number,
    plannedAmount: raw.planned_amount,
    inclusionCriteria: raw.inclusion_criteria,
    inclusionReason: raw.inclusion_reason,
    opPriority: raw.op_priority,
    remainingAmount: raw.remaining_amount,
    antecedentId: raw.antecedent_id,
    antecedentType: raw.antecedent_type,
    antecedentDate: raw.antecedent_date,
    antecedentNotes: raw.antecedent_notes,
    nextVisitDate: raw.next_visit_date,
    hasPendingPayment: !!raw.has_pending_payment,
    installmentId: raw.installment_id,
    installmentNumber: raw.installment_number,
    dueDate: raw.due_date,
    amountDue: raw.amount_due,
    amountPaid: raw.amount_paid,
    penaltyAmount: raw.penalty_amount,
    installmentStatus: raw.installment_status,
    creditId: raw.credit_id,
    creditType: raw.credit_type,
    collectionReference: raw.collection_reference,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerAddress: raw.customer_address,
    customerDni: raw.customer_dni,
    managementStatus: raw.management_status,
    additionalInstallmentsCount: raw.additional_installments_count ?? 0,
    live: raw.live
      ? {
          installmentStatus: raw.live.installment_status,
          amountDue: raw.live.amount_due,
          amountPaid: raw.live.amount_paid,
          penaltyAmount: raw.live.penalty_amount,
          creditPendingBalance: raw.live.credit_pending_balance,
          hasPendingPayment: !!raw.live.has_pending_payment,
          todayAttemptId: raw.live.today_attempt_id,
          todayAttemptType: raw.live.today_attempt_type,
        }
      : null,
  };
}

/**
 * Convierte una representación en bruto de un detalle de planilla de cobranza a su forma estructurada.
 */
function toSheetDetail(raw: CollectionSheetDetailRaw): CollectionSheetDetail {
  return {
    ...toSheet(raw),
    collectorId: raw.collector_id,
    generatedByName: raw.generated_by_name,
    items: raw.items.map(toSheetItem),
  };
}

function toAlertOverdueItem(raw: CollectionAlertsOverdueItemRaw): CollectionAlertsOverdueItem {
  return {
    installmentId: raw.installment_id,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    customerAddress: raw.customer_address,
    nextVisitDate: raw.next_visit_date,
    dueDate: raw.due_date,
    installmentStatus: raw.installment_status,
  };
}

function toAlertUnassignedItem(raw: CollectionAlertsUnassignedItemRaw): CollectionAlertsUnassignedItem {
  return {
    customerId: raw.customer_id,
    fullName: raw.full_name,
    pendingCount: raw.pending_count,
  };
}

function toAlerts(raw: CollectionAlertsRaw): CollectionAlerts {
  return {
    overdueNextVisits: raw.overdue_next_visits.map(toAlertOverdueItem),
    unassignedCustomers: raw.unassigned_customers.map(toAlertUnassignedItem),
  };
}

function toGenerateResult(raw: CollectionGenerateResultRaw): CollectionGenerateResult {
  return {
    sheet: toSheetDetail(raw.sheet),
    alerts: toAlerts(raw.alerts),
  };
}

/**
 * Convierte un resultado individual del batch a su forma estructurada,
 * preservando cuál de los tres casos (generada/omitida/error) ocurrió.
 */
function toBatchOutcome(raw: CollectionBatchOutcomeRaw): CollectionBatchOutcome {
  if (raw.error) {
    return { collectorId: raw.collector_id, kind: 'error', error: raw.error };
  }
  if (raw.skipped) {
    return {
      collectorId: raw.collector_id,
      kind: 'skipped',
      result: toSkippedResult({ skipped: true, existing_sheet: raw.existing_sheet! }),
    };
  }
  return {
    collectorId: raw.collector_id,
    kind: 'generated',
    result: toGenerateResult({ sheet: raw.sheet!, alerts: raw.alerts! }),
  };
}

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Lista las planillas de cobranza según los filtros especificados.
   * `includeRegenerated` solo aplica para ADMIN; el backend lo ignora para otros roles.
   */
  list(filters?: {
    collectorId?: string;
    date?: string;
    includeRegenerated?: boolean;
  }): Observable<CollectionSheet[]> {
    const params: Record<string, string> = {};
    if (filters?.collectorId) params['collector_id'] = filters.collectorId;
    if (filters?.date) params['date'] = filters.date;
    if (filters?.includeRegenerated) params['include_regenerated'] = 'true';
    return this.api
      .get<CollectionSheetRaw[]>('collections', params)
      .pipe(map((items) => items.map(toSheet)));
  }

  /**
   * Obtiene una planilla de cobranza por su ID.
   */
  getById(id: string): Observable<CollectionSheetDetail> {
    return this.api
      .get<CollectionSheetDetailRaw>(`collections/${id}`)
      .pipe(map(toSheetDetail));
  }

  /**
   * Genera una nueva planilla de cobranza. Devuelve la planilla creada junto con las alertas
   * operativas asociadas (visitas vencidas y clientes sin cobrador).
   */
  /**
   * Marca una planilla activa como enviada al cobrador.
   */
  send(id: string): Observable<void> {
    return this.api.patch<void>(`collections/${id}/send`).pipe(map(() => undefined));
  }

  generate(
    payload: CollectionGeneratePayload,
  ): Observable<CollectionGenerateOutcome> {
    const body: Record<string, unknown> = {
      collector_id: payload.collectorId,
      date: payload.date,
      filter: payload.filter,
    };
    if (payload.skipIfExists) body['skip_if_exists'] = true;
    return this.api
      .post<CollectionGenerateResultRaw | CollectionGenerateSkippedResultRaw>(
        'collections',
        body,
      )
      .pipe(
        map((raw) =>
          'skipped' in raw && raw.skipped
            ? toSkippedResult(raw)
            : toGenerateResult(raw as CollectionGenerateResultRaw),
        ),
      );
  }

  /**
   * Genera planillas para varios cobradores en una sola request. El backend
   * calcula la alerta global de clientes sin cobrador UNA sola vez y la
   * comparte entre todos los resultados, en vez de recalcularla por cada
   * cobrador como ocurría con N requests individuales en paralelo.
   */
  generateBatch(
    payload: CollectionGenerateBatchPayload,
  ): Observable<CollectionBatchOutcome[]> {
    const body: Record<string, unknown> = {
      collector_ids: payload.collectorIds,
      date: payload.date,
      filter: payload.filter,
    };
    if (payload.skipIfExists) body['skip_if_exists'] = true;
    return this.api
      .post<CollectionGenerateBatchResponseRaw>('collections/generate-batch', body)
      .pipe(map((raw) => raw.results.map(toBatchOutcome)));
  }
}
