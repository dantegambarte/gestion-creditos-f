// Modelo TypeScript para Cash Sessions V4 (caja operativa de la jornada).
// Ver docs/cash-model-v4.md del backend para la fuente de verdad arquitectónica.

export type CashSessionStatus = 'OPEN' | 'PENDING_RECONCILIATION' | 'CLOSED';
export type DropPaymentMethod = 'CASH' | 'TRANSFER';
export type DeclaredPaymentMethod =
  | 'CASH'
  | 'TRANSFER'
  | 'MP'
  | 'QR'
  | 'CHECK'
  | 'OTHER';

/**
 * Métodos válidos para declarar al cerrar una caja. Hardcodeado contra los
 * valores aceptados por el backend (cashSessions.routes: declared.*.payment_method).
 * Si el backend agrega más, sumarlos acá y el dialog los renderiza solo.
 */
export const DECLARED_PAYMENT_METHODS: Array<{
  value: DeclaredPaymentMethod;
  label: string;
}> = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'MP', label: 'Mercado Pago' },
  { value: 'QR', label: 'QR' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Otro' },
];

// ── Caja activa ────────────────────────────────────────────────────────────

export interface CashSession {
  id: string;
  business_day_id: string;
  owner_user_id: string;
  opened_at: string;
  opened_by: string;
  opening_amount: number;
  status: CashSessionStatus;
  closed_at?: string | null;
  closed_by?: string | null;
  shift_label?: string | null;
  observations?: string | null;
  /** Diferencia total del cierre (cash + transfer). Null si la caja sigue OPEN sin arquear. */
  closure_total_difference?: number | null;
  /** Suma de declared_amount (cash + transfer) del arqueo de cierre. Null si todavía no se arqueó. */
  cash_counted?: number | null;
}

/**
 * F2-0: estructura derivada del closure_snapshot expuesta en GET
 * /api/cash-sessions. Los consumers NO leen closure_snapshot directamente;
 * usan este objeto para que la API quede estable frente a la evolución
 * del snapshot (v2, métodos nuevos, etc.).
 */
export interface CashSessionSummary {
  collections: number;
  expenses: number;
  drops: number;
  difference: number;
}

/**
 * Item del listado GET /api/cash-sessions?business_day_id=X. Extiende
 * CashSession con campos enriquecidos del JOIN y el summary derivado.
 */
export interface CashSessionListItem extends CashSession {
  closure_total_difference?: number | null;
  closure_difference_status?: 'EXACT' | 'SURPLUS' | 'SHORTAGE' | null;
  pending_reconciliation_at?: string | null;
  pending_reconciliation_reason?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: string | null;
  business_date?: string;
  branch_id?: string;
  owner_name?: string;
  /** null en sesiones OPEN o PENDING (sin snapshot aún). */
  summary: CashSessionSummary | null;
}

// ── Snapshot (X report en vivo) ────────────────────────────────────────────

export interface CashByMethod {
  cash: number;
  transfer: number;
}

export interface CashSessionDropItem {
  id: string;
  amount: number;
  payment_method: DropPaymentMethod;
  destination?: string | null;
  destination_account_id?: string;
}

export interface CashSessionSnapshot {
  session_id: string;
  status: CashSessionStatus;
  owner_user_id: string;
  opened_at: string;
  opening: CashByMethod;
  collections: {
    payments: CashByMethod;
    down_payments: CashByMethod;
    manual_incomes: CashByMethod;
  };
  outflows: {
    expenses: CashByMethod;
    /** DEPRECATED V4: siempre 0. Las comisiones van a Caja General. */
    commissions: CashByMethod;
    /** Desembolso de préstamos (LOAN) entregados en efectivo desde esta caja (rama DAILY). */
    loans: CashByMethod;
  };
  conversions: {
    cash_delta: number;
    transfer_delta: number;
  };
  drops: {
    cash: number;
    transfer: number;
    items: CashSessionDropItem[];
  };
  expected: CashByMethod;
}

// ── Payloads ────────────────────────────────────────────────────────────────

export interface CashSessionOpenPayload {
  opening_amount: number;
  shift_label?: string;
  observations?: string;
}

export interface DeclaredItem {
  payment_method: DeclaredPaymentMethod;
  declared_amount: number;
  notes?: string;
}

export interface CashSessionClosePayload {
  declared: DeclaredItem[];
}

export interface CashSessionDropPayload {
  amount: number;
  payment_method: DropPaymentMethod;
  destination_account_id?: string;
  reason?: string;
  receipt_reference?: string;
}

// ── Caja General (tesorería) ───────────────────────────────────────────────

export interface CashAccount {
  id: string;
  name: string;
  type: 'GENERAL_CASH' | string;
  is_active: boolean;
  current_balance: number;
  created_at: string;
}

export interface CashSessionDropResponse {
  id: string;
  cash_session_id: string;
  amount: number;
  payment_method: DropPaymentMethod;
  destination?: string | null;
  destination_account_id: string;
  reason?: string | null;
  status: 'ACTIVE' | 'REVERSED';
  performed_by: string;
  performed_at: string;
}

// ── Detalle de caja cerrada (reporte histórico) ────────────────────────────

/** Item de `cash_session_closure_details`: arqueo declarado por método de pago. */
export interface CashSessionClosureDetail {
  id: string;
  payment_method: DeclaredPaymentMethod;
  expected_amount: number;
  declared_amount: number;
  difference: number;
  difference_status: 'EXACT' | 'SURPLUS' | 'SHORTAGE';
  notes: string | null;
}

/** Drop de una caja, tal como lo devuelve GET /cash-sessions/:id. */
export interface CashSessionDropDetail {
  id: string;
  amount: number;
  payment_method: DropPaymentMethod;
  destination?: string | null;
  destination_account_id: string;
  reason?: string | null;
  receipt_reference?: string | null;
  status: 'ACTIVE' | 'REVERSED';
  performed_by: string;
  performed_at: string;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversed_reason?: string | null;
}

/**
 * Snapshot persistido en `closure_snapshot` al cerrar la caja. Mismo shape
 * que `CashSessionSnapshot` pero sin los campos identificatorios de sesión
 * (esos ya están en `CashSessionDetail`).
 */
export interface CashSessionClosureSnapshot {
  opening: CashByMethod;
  collections: {
    payments: CashByMethod;
    down_payments: CashByMethod;
    manual_incomes: CashByMethod;
  };
  outflows: {
    expenses: CashByMethod;
    commissions: CashByMethod;
    /** Desembolso de préstamos (LOAN) entregados en efectivo desde esta caja (rama DAILY). */
    loans: CashByMethod;
  };
  conversions: {
    cash_delta: number;
    transfer_delta: number;
  };
  drops: {
    cash: number;
    transfer: number;
    items: CashSessionDropItem[];
  };
  expected: CashByMethod;
}

/** Respuesta de GET /cash-sessions/:id — detalle completo para auditoría. */
export interface CashSessionDetail extends CashSession {
  owner: { id: string; full_name: string; role: string } | null;
  drops: CashSessionDropDetail[];
  closure_details: CashSessionClosureDetail[];
  closure_difference_status?: 'EXACT' | 'SURPLUS' | 'SHORTAGE' | null;
  closure_snapshot?: CashSessionClosureSnapshot | null;
}
