import { InstallmentStatus } from '../../seller/models/installment.model';

export type CollectionFilter =
  | 'TODAY'
  | 'OVERDUE'
  | 'TODAY_AND_OVERDUE'
  | 'ALL_PENDING';

export type CollectionSheetStatus = 'ACTIVE' | 'REGENERATED';
export type InclusionCriteria = 'DUE_DATE' | 'VISIT_DATE';
export type AntecedentType = 'PARTIAL_PAYMENT' | 'NO_PAYMENT' | 'NOT_FOUND';

export interface CollectionSheet {
  id: string;
  sheetDate: string;
  filterUsed: CollectionFilter;
  status: CollectionSheetStatus;
  createdAt: string;
  collectorName: string;
  totalItems: number;
}

export interface CollectionSheetItem {
  orderNumber: number;
  plannedAmount: number;
  inclusionCriteria: InclusionCriteria;
  antecedentType: AntecedentType | null;
  antecedentDate: string | null;
  antecedentNotes: string | null;
  nextVisitDate: string | null;
  installmentId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  installmentStatus: InstallmentStatus;
  creditId: string;
  creditType: 'SALE' | 'LOAN';
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
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

// ── Raw API shapes ─────────────────────────────────────────────────────────────

export interface CollectionSheetRaw {
  id: string;
  sheet_date: string;
  filter_used: CollectionFilter;
  status: CollectionSheetStatus;
  created_at: string;
  collector_name: string;
  total_items: number;
}

export interface CollectionSheetItemRaw {
  order_number: number;
  planned_amount: number;
  inclusion_criteria: InclusionCriteria;
  antecedent_type: AntecedentType | null;
  antecedent_date: string | null;
  antecedent_notes: string | null;
  next_visit_date: string | null;
  installment_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  penalty_amount: number;
  installment_status: InstallmentStatus;
  credit_id: string;
  credit_type: 'SALE' | 'LOAN';
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
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
  TODAY: 'Hoy',
  OVERDUE: 'Vencidas',
  TODAY_AND_OVERDUE: 'Hoy y vencidas',
  ALL_PENDING: 'Todas las pendientes',
};

export const ANTECEDENT_TYPE_LABELS: Record<AntecedentType, string> = {
  PARTIAL_PAYMENT: 'Cobro parcial',
  NO_PAYMENT: 'No pagó',
  NOT_FOUND: 'No encontrado',
};

export const SHEET_STATUS_LABELS: Record<CollectionSheetStatus, string> = {
  ACTIVE: 'Activa',
  REGENERATED: 'Regenerada',
};

export interface CollectionGeneratePayload {
  collectorId: string;
  date: string;
  filter: CollectionFilter;
}
