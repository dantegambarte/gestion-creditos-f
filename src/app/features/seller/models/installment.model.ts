export type InstallmentStatus = 'PENDING' | 'OVERDUE' | 'PAID' | 'PARTIAL';

export interface Installment {
  id: string;
  creditId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  status: InstallmentStatus;
  createdAt: string;
  creditType: 'SALE' | 'LOAN';
  customerId: string;
  customerName: string;
  customerDni: string;
  collectorId: string | null;
  collectorName: string | null;
}

export interface InstallmentDetail extends Installment {
  creditTotal: number;
  updatedAt: string;
}

export interface InstallmentListFilters {
  creditId?: string;
  status?: InstallmentStatus;
}

export interface ApplyPenaltyPayload {
  penaltyAmount: number;
  reason?: string;
}

export interface EarlyPayPayload {
  paymentMethod?: 'CASH' | 'TRANSFER' | 'MIXED';
  amountCash?: number;
  amountTransfer?: number;
  transferReference?: string;
}

export interface EarlyPayResult extends InstallmentDetail {
  creditSettled: boolean;
}

// Raw shapes from API (snake_case)
export interface InstallmentRaw {
  id: string;
  credit_id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  penalty_amount: number;
  status: InstallmentStatus;
  created_at: string;
  credit_type: 'SALE' | 'LOAN';
  customer_id: string;
  customer_name: string;
  customer_dni: string;
  collector_id: string | null;
  collector_name: string | null;
}

export interface InstallmentDetailRaw extends InstallmentRaw {
  credit_total: number;
  updated_at: string;
}

export interface EarlyPayResultRaw extends InstallmentDetailRaw {
  credit_settled: boolean;
}
