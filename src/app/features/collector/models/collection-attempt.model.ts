export type CollectionAttemptType =
  | 'NO_PAYMENT'
  | 'NOT_FOUND'
  | 'SCHEDULED_VISIT';

export interface CollectionAttemptCreatePayload {
  installmentId: string;
  attemptType: CollectionAttemptType;
  /** Obligatorio si attemptType === 'NO_PAYMENT'. */
  reason?: string;
  /** Obligatorio si attemptType === 'NO_PAYMENT'. Ignorado para NOT_FOUND. */
  nextVisitDate?: string;
  notes?: string;
}

export interface CollectionAttempt {
  id: string;
  installmentId: string;
  collectorId: string;
  createdBy: string;
  attemptType: CollectionAttemptType;
  reason: string | null;
  nextVisitDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CollectionAttemptRaw {
  id: string;
  installment_id: string;
  collector_id: string;
  created_by: string;
  attempt_type: CollectionAttemptType;
  reason: string | null;
  next_visit_date: string | null;
  notes: string | null;
  created_at: string;
}

export const ATTEMPT_TYPE_LABELS: Record<CollectionAttemptType, string> = {
  NO_PAYMENT: 'No pagó',
  NOT_FOUND: 'No encontrado',
  SCHEDULED_VISIT: 'Visita programada',
};
