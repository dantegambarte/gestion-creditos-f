/**
 * Tipos de evento que pueden aparecer en el log cronológico de gestiones sobre una cuota.
 *  - PAYMENT     → un cobro (parcial o total)
 *  - NO_PAYMENT  → intento NO_PAYMENT (cliente presente, no pagó)
 *  - NOT_FOUND   → intento NOT_FOUND (cliente no encontrado)
 */
export type ManagementEventType = 'PAYMENT' | 'NO_PAYMENT' | 'NOT_FOUND';

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ManagementLogEntry {
  eventType: ManagementEventType;
  eventId: string;
  createdAt: string;
  nextVisitDate: string | null;
  reason: string | null;
  notes: string | null;
  amount: number | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: 'CASH' | 'TRANSFER' | null;
  isReversal: boolean;
  adminDirect: boolean;
  rejectionReason: string | null;
  collectorName: string | null;
}

export interface ManagementLogEntryRaw {
  event_type: ManagementEventType;
  event_id: string;
  created_at: string;
  next_visit_date: string | null;
  reason: string | null;
  notes: string | null;
  amount: number | null;
  payment_status: PaymentStatus | null;
  payment_method: 'CASH' | 'TRANSFER' | null;
  is_reversal: boolean;
  admin_direct: boolean;
  rejection_reason: string | null;
  collector_name: string | null;
}

export const MANAGEMENT_EVENT_LABELS: Record<ManagementEventType, string> = {
  PAYMENT: 'Cobro',
  NO_PAYMENT: 'No pagó',
  NOT_FOUND: 'No encontrado',
};
