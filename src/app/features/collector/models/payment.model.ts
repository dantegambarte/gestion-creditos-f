export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Payment {
  id: string;
  installmentId: string;
  amountReceived: number;
  paymentMethod: 'CASH' | 'TRANSFER';
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
}

export interface PaymentCreatePayload {
  installmentId: string;
  amountReceived: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference?: string;
  notes?: string;
}

export interface PaymentCreateResult {
  id: string;
  installmentId: string;
  amountReceived: number;
  paymentMethod: string;
  status: PaymentStatus;
  createdAt: string;
  warning?: string;
}

/** Cobro aprobado dentro del historial de un crédito (GET /credits/:id/payments) */
export interface CreditPayment {
  id: string;
  installmentId: string;
  collectorId: string | null;
  amountReceived: number;
  paymentMethod: 'CASH' | 'TRANSFER';
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
  amountReceived: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference?: string;
  notes?: string;
}

export interface ReversePayload {
  reason: string;
}

// Raw API shapes
export interface PaymentRaw {
  id: string;
  installment_id: string;
  amount_received: number;
  payment_method: 'CASH' | 'TRANSFER';
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
  status: PaymentStatus;
  created_at: string;
  warning?: string;
}

export interface CreditPaymentRaw {
  id: string;
  installment_id: string;
  collector_id: string | null;
  amount_received: number;
  payment_method: 'CASH' | 'TRANSFER';
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
