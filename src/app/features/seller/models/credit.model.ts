export type CreditStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SETTLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REFINANCED';
export type CreditType = 'SALE' | 'LOAN';
export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type IntakePaymentMethod = 'CASH' | 'TRANSFER' | 'MIXED';
export type InstallmentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'PARTIAL'
  | 'PLAN_CHANGE_CANCELLED';

export interface Credit {
  id: string;
  type: CreditType;
  totalAmount: number;
  installmentsCount: number;
  paymentFrequency: PaymentFrequency;
  interestRate: number | null;
  status: CreditStatus;
  createdAt: string;
  approvedAt: string | null;
  customerId: string;
  customerName: string;
  customerDni: string;
  createdById: string | null;
  createdByName: string | null;
  downPayment?: number;
  prepaidInstallments?: number;
  downPaymentMethod?: string | null;
  prepaidInstallmentsMethod?: string | null;
}

export interface CreditInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  status: InstallmentStatus;
}

export interface CreditProduct {
  id: string;
  quantity: number;
  historicalPrice: number;
  productId: string;
  productName: string;
  historicalRate: number | null;
}

export interface CreditUnit {
  id: string;
  historicalPrice: number;
  historicalRate: number | null;
  unitId: string;
  unitCode: string;
  unitStatus: string;
  variantId: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  productId: string;
  productName: string;
}

export interface RefinancingChainNode {
  id: string;
  status: CreditStatus;
  createdAt: string;
  depth: number;
}

export interface RefinancingChain {
  predecessorId: string | null;
  successorId: string | null;
  chainDepth: number;
  chain: RefinancingChainNode[];
  isRefinancing: boolean;
  isPredecessor: boolean;
}

export interface CreditDetail extends Credit {
  rejectionReason: string | null;
  notes: string | null;
  approvedBy: string | null;
  customerPhone: string | null;
  products?: CreditProduct[];
  units?: CreditUnit[];
  installments: CreditInstallment[];
  downPayment: number;
  financedAmount: number;
  downPaymentMethod: string | null;
  downPaymentTransferReference: string | null;
  prepaidInstallments: number;
  prepaidInstallmentsMethod: string | null;
  prepaidInstallmentsTransferReference: string | null;
  settledAt: string | null;
  settlementAmount: number | null;
  settlementType: string | null;
  refinancedFromCreditId: string | null;
  refinancingChain: RefinancingChain | null;
}

export interface CreditListFilters {
  status?: CreditStatus;
  type?: CreditType;
  customerId?: string;
}

export interface SimulatePayload {
  type: CreditType;
  totalAmount?: number;
  products?: Array<{
    variantId: string;
    quantity: number;
    installmentsCount?: number;
  }>;
  installmentsCount: number;
  paymentFrequency: PaymentFrequency;
  downPayment?: number;
  firstPaymentDate?: string;
}

export interface SimulateResultItem {
  productId: string;
  productName: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  rate: number;
  installmentContribution: number;
  installmentsCount?: number;
}

export interface SimulateScheduleRow {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  capital?: number;
  interest?: number;
  remainingEstimated?: number;
}

export interface SimulateSummary {
  financedAmount: number;
  downPayment: number;
  interestAmount: number;
}

export interface SimulateResult {
  type: string;
  paymentFrequency: string;
  installmentsCount: number;
  totalAmount: number;
  installmentAmount: number;
  totalToReturn: number;
  note: string;
  rate?: number;
  items?: SimulateResultItem[];
  downPayment?: number;
  financedAmount?: number;
  interestAmount?: number;
  schedule?: SimulateScheduleRow[];
  summary?: SimulateSummary;
}

export interface SaleCreditPayload {
  customerId: string;
  type: 'SALE';
  installmentsCount: number;
  paymentFrequency: PaymentFrequency;
  /** Fecha de la primera cuota en formato 'YYYY-MM-DD' (sin TZ). */
  firstPaymentDate?: string;
  units: Array<{ unitId: string }>;
  notes?: string;
  downPayment?: number;
  downPaymentMethod?: IntakePaymentMethod;
  downPaymentCash?: number;
  downPaymentTransfer?: number;
  downPaymentTransferReference?: string;
  advancedInstallmentsCount?: number;
  advancedInstallmentsMethod?: IntakePaymentMethod;
  advancedInstallmentsCash?: number;
  advancedInstallmentsTransfer?: number;
  advancedInstallmentsTransferReference?: string;
}

export interface LoanCreditPayload {
  customerId: string;
  type: 'LOAN';
  totalAmount: number;
  installmentsCount: number;
  paymentFrequency: PaymentFrequency;
  /** Fecha de la primera cuota en formato 'YYYY-MM-DD' (sin TZ). */
  firstPaymentDate?: string;
  notes?: string;
}

export type CreditCreatePayload = SaleCreditPayload | LoanCreditPayload;

export interface CreditRaw {
  id: string;
  type: CreditType;
  total_amount: number;
  installments_count: number;
  payment_frequency: PaymentFrequency;
  interest_rate: number | null;
  status: CreditStatus;
  created_at: string;
  approved_at: string | null;
  customer_id: string;
  customer_name: string;
  customer_dni: string;
  created_by_id: string | null;
  created_by_name: string | null;
}

export interface CreditInstallmentRaw {
  id: string;
  installment_number: number;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  penalty_amount: number;
  status: InstallmentStatus;
}

export interface CreditProductRaw {
  id: string;
  quantity: number;
  historical_price: number;
  product_id: string;
  product_name: string;
  historical_rate: number | null;
}

export interface CreditUnitRaw {
  id: string;
  historical_price: number;
  historical_rate: number | null;
  unit_id: string;
  unit_code: string;
  unit_status: string;
  variant_id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  product_id: string;
  product_name: string;
}

export interface CreditDetailRaw extends CreditRaw {
  rejection_reason: string | null;
  notes: string | null;
  approved_by: string | null;
  customer_phone: string | null;
  products?: CreditProductRaw[];
  units?: CreditUnitRaw[];
  installments: CreditInstallmentRaw[];
  down_payment: number;
  financed_amount?: number;
  down_payment_method: string | null;
  down_payment_transfer_reference: string | null;
  prepaid_installments: number;
  prepaid_installments_method: string | null;
  prepaid_installments_transfer_reference: string | null;
  settled_at: string | null;
  settlement_amount: number | null;
  settlement_type: string | null;
  refinanced_from_credit_id: string | null;
  refinancing_chain?: {
    predecessor_id: string | null;
    successor_id: string | null;
    chain_depth: number;
    chain: { id: string; status: string; created_at: string; depth: number }[];
    is_refinancing: boolean;
    is_predecessor: boolean;
  } | null;
}

export interface ApprovePayload {
  installmentsCount?: number;
}

export interface RejectPayload {
  rejectionReason: string;
}

export interface EarlySettlementPayload {
  paymentMethod?: IntakePaymentMethod;
  amountCash?: number;
  amountTransfer?: number;
  transferReference?: string;
}

export interface EarlySettlementResult {
  creditId: string;
  settlementAmount: number;
  paymentMethod: string;
}

export interface RefinancePayload {
  installmentsCount: number;
  paymentFrequency: PaymentFrequency;
  reason: string;
  extraCharges?: number;
  notes?: string;
}

// ── Cambio de plan ──────────────────────────────────────────────
export interface PlanChangePlan {
  installments: number;
  rate: number; // porcentaje (ej: 20 = 20%)
}

export interface PlanChangeSimulation {
  currentPlan: PlanChangePlan;
  newPlan: PlanChangePlan;
  totalPaid: number;
  newCreditTotal: number;
  newBalance: number;
  survivingInstallmentId: string | null;
  cancelledInstallments: number[];
  creditWillBeSettled: boolean;
}

export interface PlanChangeResult extends PlanChangeSimulation {
  planChangeId: string;
  executedAt: string;
  message: string;
}

export interface RefinanceResult {
  originalCreditId: string;
  newCredit: {
    id: string;
    type: string;
    totalAmount: number;
    installmentsCount: number;
    paymentFrequency: PaymentFrequency;
    status: CreditStatus;
    refinancedFromCreditId: string;
    createdAt: string;
  };
  pendingBalance: number;
  extraCharges: number;
  totalTransferred: number;
  message: string;
}

export interface RefinanceResultRaw {
  original_credit_id: string;
  new_credit: {
    id: string;
    type: string;
    total_amount: number;
    installments_count: number;
    payment_frequency: PaymentFrequency;
    status: CreditStatus;
    refinanced_from_credit_id: string;
    created_at: string;
  };
  pending_balance: number;
  extra_charges: number;
  total_transferred: number;
  message: string;
}

export interface CartUnit {
  unitId: string;
  unitCode: string;
  productName: string;
  variantLabel: string;
  price: number;
  variantId: string;
}
