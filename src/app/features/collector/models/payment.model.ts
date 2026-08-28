export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'MIXED';

export interface Payment {
  id: string;
  installmentId: string;
  amountReceived: number;
  paymentMethod: PaymentMethod;
  amountCash: number;
  amountTransfer: number;
  transferReference: string | null;
  status: PaymentStatus;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  installmentNumber: number;
  amountDue: number;
  dueDate: string;
  creditId: string;
  creditType: 'SALE' | 'LOAN';
  customerName: string;
  customerDni: string;
  collectorName: string | null;
  isReversal: boolean;
  adminDirect: boolean;
  parentPaymentId: string | null;
  /** ID del payment de reversión que anuló este cobro (null si no fue revertido). */
  reversalPaymentId: string | null;
  /**
   * Concepto del movimiento clasificado por el backend (única fuente compartida
   * con Caja y Reportes): p. ej. "Venta de contado", "Cobro de cuota", etc.
   */
  concepto: string;
}

export interface PaymentDetail extends Payment {
  amountPaid: number;
  penaltyAmount: number;
  customerId: string;
  collectorId: string | null;
  isReversal: boolean;
  adminDirect: boolean;
  reversalReason: string | null;
  /** ID del payment de reversión que anuló este cobro (null si no fue revertido). */
  reversalPaymentId: string | null;
}

export interface PaymentListFilters {
  status?: PaymentStatus;
  collectorId?: string;
  installmentId?: string;
  /** Filtro por fecha (YYYY-MM-DD) sobre approved_at, aplicado en el backend. */
  dateFrom?: string;
  dateTo?: string;
}

export interface PaymentCreatePayload {
  installmentId: string;
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
  amountCash?: number;
  amountTransfer?: number;
  transferReference?: string;
  notes?: string;
  /** Obligatorio cuando el cobro queda parcial (amount < saldo restante). */
  nextVisitDate?: string;
  /**
   * Tipo de generación del pago. Único valor que el cliente fija: 'RENEWAL'
   * (pre-carga de renovación). Ausente = cobro normal.
   */
  generationType?: 'RENEWAL';
}

export interface PaymentCreateResult {
  id: string;
  installmentId: string;
  amountReceived: number;
  paymentMethod: string;
  amountCash: number;
  amountTransfer: number;
  status: PaymentStatus;
  createdAt: string;
  nextVisitDate: string | null;
  warning?: string;
}

/** Cobro aprobado dentro del historial de un crédito (GET /credits/:id/payments) */
export interface CreditPayment {
  id: string;
  installmentId: string;
  collectorId: string | null;
  amountReceived?: number;
  paymentMethod: PaymentMethod;
  amountCash: number;
  amountTransfer: number;
  transferReference: string | null;
  status: PaymentStatus;
  isReversal: boolean;
  reversalReason: string | null;
  adminDirect: boolean;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  parentPaymentId: string | null;
  reversedByPaymentId: string | null;
  installmentNumber: number;
  amountDue: number;
  dueDate: string;
  collectorName: string | null;
  approverName: string | null;
}

export interface AdminDirectPayload {
  installmentId: string;
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
  amountCash?: number;
  amountTransfer?: number;
  transferReference?: string;
  notes?: string;
  /** Obligatorio cuando el cobro queda parcial (amount < saldo restante). */
  nextVisitDate?: string;
}

export interface ReversePayload {
  reason: string;
}

// Raw API shapes
export interface PaymentRaw {
  id: string;
  installment_id: string;
  amount_received: number;
  payment_method: PaymentMethod;
  amount_cash?: number;
  amount_transfer?: number;
  transfer_reference: string | null;
  status: PaymentStatus;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  installment_number: number;
  amount_due: number;
  due_date: string;
  credit_id: string;
  credit_type: 'SALE' | 'LOAN';
  customer_name: string;
  customer_dni: string;
  collector_name: string | null;
  is_reversal: boolean;
  admin_direct: boolean;
  parent_payment_id: string | null;
  reversal_payment_id: string | null;
  concepto: string;
}

export interface PaymentDetailRaw extends PaymentRaw {
  amount_paid: number;
  penalty_amount: number;
  customer_id: string;
  collector_id: string | null;
  is_reversal: boolean;
  admin_direct: boolean;
  reversal_reason: string | null;
  reversal_payment_id: string | null;
}

export interface PaymentCreateResultRaw {
  id: string;
  installment_id: string;
  amount_received: number;
  payment_method: string;
  amount_cash?: number;
  amount_transfer?: number;
  status: PaymentStatus;
  created_at: string;
  next_visit_date: string | null;
  warning?: string;
}

export interface CreditPaymentRaw {
  id: string;
  installment_id: string;
  collector_id: string | null;
  amount_received: number;
  payment_method: PaymentMethod;
  amount_cash?: number;
  amount_transfer?: number;
  transfer_reference: string | null;
  status: PaymentStatus;
  is_reversal: boolean;
  reversal_reason: string | null;
  admin_direct: boolean;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  parent_payment_id: string | null;
  reversed_by_payment_id: string | null;
  installment_number: number;
  amount_due: number;
  due_date: string;
  collector_name: string | null;
  approver_name: string | null;
}
