import { InstallmentStatus } from '../../seller/models/installment.model';

export type CollectionFilter =
  | 'TODAY'
  | 'OVERDUE'
  | 'TODAY_AND_OVERDUE'
  | 'ALL_PENDING';

export type CollectionSheetStatus = 'ACTIVE' | 'REGENERATED';
export type InclusionCriteria = 'DUE_DATE' | 'VISIT_DATE';
export type InclusionReason =
  | 'OVERDUE'
  | 'OVERDUE_UNSCHEDULED'
  | 'DUE_TODAY'
  | 'SCHEDULED_VISIT'
  | 'ALL_PENDING';
export type AntecedentType =
  | 'PARTIAL_PAYMENT'
  | 'NO_PAYMENT'
  | 'NOT_FOUND'
  | 'SCHEDULED_VISIT';

/** Estado de gestión por fila de planilla (lo que hizo el cobrador hoy). */
export type ManagementStatus =
  | 'PENDING'
  | 'VISITED'
  | 'PAID'
  | 'NO_PAYMENT'
  | 'NOT_FOUND';

/**
 * Capa viva adjuntada por el backend SOLO cuando la planilla es operable hoy
 * (ACTIVE + sheet_date = hoy). null en planillas cerradas/regeneradas/pasadas.
 * Refleja el estado vivo de la gestión, separado del snapshot inmutable.
 */
export interface CollectionSheetItemLive {
  /** Estado VIVO de la cuota (no el snapshot congelado). null en planilla read-only. */
  installmentStatus: InstallmentStatus | null;
  /** Monto a cobrar vivo (con mora aplicada). */
  amountDue: number | null;
  /** Monto pagado vivo. */
  amountPaid: number | null;
  /** Mora viva acumulada. */
  penaltyAmount: number | null;
  /** Pre-carga PENDING viva sobre la cuota (no el snapshot congelado). */
  hasPendingPayment: boolean;
  /** Id del último intento (no anulado) del día — habilita "Deshacer". */
  todayAttemptId: string | null;
  /** Tipo del último intento del día (solo NO_PAYMENT/NOT_FOUND son anulables).
   * SCHEDULED_VISIT (agenda admin) queda excluido: el backend no lo emite acá. */
  todayAttemptType: Exclude<
    AntecedentType,
    'PARTIAL_PAYMENT' | 'SCHEDULED_VISIT'
  > | null;
}

/** Etiquetas amigables para mostrar en UI admin (no se muestra al cobrador). */
export const INCLUSION_REASON_LABELS: Record<InclusionReason, string> = {
  OVERDUE: 'Vencida',
  OVERDUE_UNSCHEDULED: 'Vencida',
  DUE_TODAY: 'Vence hoy',
  SCHEDULED_VISIT: 'Visita pactada',
  ALL_PENDING: 'Pendiente',
};

export interface CollectionSheet {
  id: string;
  sheetDate: string;
  filterUsed: CollectionFilter;
  status: CollectionSheetStatus;
  createdAt: string;
  sentAt: string | null;
  collectorId: string;
  collectorName: string;
  totalItems: number;
}

export interface CollectionSheetItem {
  orderNumber: number;
  plannedAmount: number;
  inclusionCriteria: InclusionCriteria;
  /** Razón por la que la cuota fue incluida (snapshot al generar). */
  inclusionReason: InclusionReason | null;
  /** Prioridad operativa del orden de render (1 visita · 2 mora · 3 hoy · 4 resto). */
  opPriority: number | null;
  /** Saldo a cobrar al momento de la generación: amount_due - amount_paid. */
  remainingAmount: number | null;
  antecedentId: string | null;
  antecedentType: AntecedentType | null;
  antecedentDate: string | null;
  antecedentNotes: string | null;
  nextVisitDate: string | null;
  hasPendingPayment: boolean;
  installmentId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  installmentStatus: InstallmentStatus;
  creditId: string;
  creditType: 'SALE' | 'LOAN';
  /** Frase armada en backend: "Cuota X de N · crédito de … / préstamo de $…". */
  collectionReference: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerDni: string | null;
  /** Estado de gestión del día (snapshot del campo editable management_status). */
  managementStatus: ManagementStatus;
  /** Capa viva de gestión; null si la planilla no es operable hoy. */
  live: CollectionSheetItemLive | null;
}

export interface CollectionSheetDetail extends CollectionSheet {
  collectorId: string;
  generatedByName: string;
  items: CollectionSheetItem[];
}

export interface CollectionAlertsOverdueItem {
  installmentId: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  nextVisitDate: string;
  dueDate: string;
  installmentStatus: InstallmentStatus;
}

export interface CollectionAlertsUnassignedItem {
  customerId: string;
  fullName: string;
  pendingCount: number;
}

export interface CollectionAlerts {
  overdueNextVisits: CollectionAlertsOverdueItem[];
  unassignedCustomers: CollectionAlertsUnassignedItem[];
}

export interface CollectionGenerateResult {
  sheet: CollectionSheetDetail;
  alerts: CollectionAlerts;
}

/**
 * Respuesta del backend cuando se envía skip_if_exists=true y ya existe una
 * planilla ACTIVE para (collector, date): no se crea ni regenera nada y se
 * devuelve un puntero a la existente para que el front lo refleje.
 */
export interface CollectionGenerateSkippedResult {
  skipped: true;
  existingSheet: {
    id: string;
    sheetDate: string;
    createdAt: string;
    generatedByName: string;
  };
}

export type CollectionGenerateOutcome =
  | CollectionGenerateResult
  | CollectionGenerateSkippedResult;

export interface CollectionGenerateSkippedResultRaw {
  skipped: true;
  existing_sheet: {
    id: string;
    sheet_date: string;
    created_at: string;
    generated_by_name: string;
  };
}

// ── Raw API shapes ─────────────────────────────────────────────────────────────

export interface CollectionSheetRaw {
  id: string;
  sheet_date: string;
  filter_used: CollectionFilter;
  status: CollectionSheetStatus;
  created_at: string;
  sent_at: string | null;
  collector_id: string;
  collector_name: string;
  total_items: number;
}

export interface CollectionSheetItemRaw {
  order_number: number;
  planned_amount: number;
  inclusion_criteria: InclusionCriteria;
  inclusion_reason: InclusionReason | null;
  op_priority: number | null;
  remaining_amount: number | null;
  antecedent_id: string | null;
  antecedent_type: AntecedentType | null;
  antecedent_date: string | null;
  antecedent_notes: string | null;
  next_visit_date: string | null;
  has_pending_payment: boolean;
  installment_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  penalty_amount: number;
  installment_status: InstallmentStatus;
  credit_id: string;
  credit_type: 'SALE' | 'LOAN';
  collection_reference: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_dni: string | null;
  management_status: ManagementStatus;
  live: CollectionSheetItemLiveRaw | null;
}

export interface CollectionSheetItemLiveRaw {
  installment_status: InstallmentStatus | null;
  amount_due: number | null;
  amount_paid: number | null;
  penalty_amount: number | null;
  has_pending_payment: boolean;
  today_attempt_id: string | null;
  today_attempt_type: Exclude<
    AntecedentType,
    'PARTIAL_PAYMENT' | 'SCHEDULED_VISIT'
  > | null;
}

export interface CollectionSheetDetailRaw extends CollectionSheetRaw {
  collector_id: string;
  generated_by_name: string;
  items: CollectionSheetItemRaw[];
}

export interface CollectionAlertsOverdueItemRaw {
  installment_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  next_visit_date: string;
  due_date: string;
  installment_status: InstallmentStatus;
}

export interface CollectionAlertsUnassignedItemRaw {
  customer_id: string;
  full_name: string;
  pending_count: number;
}

export interface CollectionAlertsRaw {
  overdue_next_visits: CollectionAlertsOverdueItemRaw[];
  unassigned_customers: CollectionAlertsUnassignedItemRaw[];
}

export interface CollectionGenerateResultRaw {
  sheet: CollectionSheetDetailRaw;
  alerts: CollectionAlertsRaw;
}

// ── Labels ─────────────────────────────────────────────────────────────────────

export const COLLECTION_FILTER_LABELS: Record<CollectionFilter, string> = {
  TODAY: 'Solo hoy',
  OVERDUE: 'Vencidas sin agenda',
  TODAY_AND_OVERDUE: 'Trabajo Diario',
  ALL_PENDING: 'Todas las pendientes',
};

export const ANTECEDENT_TYPE_LABELS: Record<AntecedentType, string> = {
  PARTIAL_PAYMENT: 'Cobro parcial',
  NO_PAYMENT: 'No pagó',
  NOT_FOUND: 'No encontrado',
  SCHEDULED_VISIT: 'Visita programada',
};

export const SHEET_STATUS_LABELS: Record<CollectionSheetStatus, string> = {
  ACTIVE: 'Activa',
  REGENERATED: 'Regenerada',
};

export interface CollectionGeneratePayload {
  collectorId: string;
  date: string;
  filter: CollectionFilter;
  /** Si true y ya existe planilla ACTIVE, el backend la omite y devuelve {skipped}. */
  skipIfExists?: boolean;
}

export interface CollectionGenerateBatchPayload {
  collectorIds: string[];
  date: string;
  filter: CollectionFilter;
  /** Si true y ya existe planilla ACTIVE, el backend la omite y devuelve {skipped}. */
  skipIfExists?: boolean;
}

/** Resultado por cobrador del endpoint batch, ya tipado para el front. */
export type CollectionBatchOutcome =
  | { collectorId: string; kind: 'generated'; result: CollectionGenerateResult }
  | { collectorId: string; kind: 'skipped'; result: CollectionGenerateSkippedResult }
  | { collectorId: string; kind: 'error'; error: { status: number; message: string } };

export interface CollectionBatchOutcomeRaw {
  collector_id: string;
  sheet?: CollectionSheetDetailRaw;
  alerts?: CollectionAlertsRaw;
  skipped?: true;
  existing_sheet?: {
    id: string;
    sheet_date: string;
    created_at: string;
    generated_by_name: string;
  };
  error?: { status: number; message: string };
}

export interface CollectionGenerateBatchResponseRaw {
  results: CollectionBatchOutcomeRaw[];
}
