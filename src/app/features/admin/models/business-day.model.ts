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
