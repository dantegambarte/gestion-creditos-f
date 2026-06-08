// Modelo TypeScript para Business Days V4 (jornada del día).
// Ver docs/cash-model-v4.md del backend.

export type BusinessDayStatus = 'OPEN' | 'READY_TO_CLOSE' | 'CLOSED' | 'AUDITED';

export interface BusinessDaySessionCounts {
  open_count: number;
  pending_count: number;
  closed_count: number;
  total_count: number;
}

export interface BusinessDay {
  id: string;
  business_date: string;
  branch_id: string;
  status: BusinessDayStatus;
  opened_at: string;
  ready_to_close_at?: string | null;
  closed_at?: string | null;
  closed_by?: string | null;
  audited_at?: string | null;
  audited_by?: string | null;
  observations?: string | null;
}

/** Respuesta de GET /api/business-days/active. */
export interface ActiveBusinessDay extends BusinessDay {
  session_counts: BusinessDaySessionCounts;
}

/** Item del listado GET /api/business-days. Trae datos del JOIN con branches. */
export interface BusinessDayListItem extends BusinessDay {
  branch_code?: string;
  branch_name?: string;
}

/**
 * Filtros aceptados por GET /api/business-days.
 * status omitido = todos los status.
 * Fechas en ISO yyyy-mm-dd.
 */
export interface BusinessDayFilters {
  status?: BusinessDayStatus;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Respuesta de GET /api/business-days/:id (detalle con cajas embebidas). */
export interface BusinessDayDetail extends BusinessDayListItem {
  session_counts: BusinessDaySessionCounts;
  /** Cajas embebidas en formato compacto (id, owner, status, opening_amount, etc.). */
  sessions: Array<{
    id: string;
    owner_user_id: string;
    owner_name?: string;
    opened_at: string;
    closed_at?: string | null;
    opening_amount: number;
    status: string;
    shift_label?: string | null;
  }>;
}
