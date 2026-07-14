import { PaymentFrequency } from '../../../shared/models/payment-frequency';

export interface PortalCustomer {
  id: string;
  fullName: string;
  dni: string;
  portalIsTempPassword: boolean;
}

export interface PortalLoginPayload {
  dni: string;
  password: string;
}

export interface PortalChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface UpcomingInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  status: 'PENDING' | 'OVERDUE' | 'PARTIAL';
  creditId: string;
  creditType: 'SALE' | 'LOAN';
  creditInstallmentsCount: number;
  creditName: string | null;
}

export interface AccountSummary {
  totalOwed: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  statusIndicator: 'GREEN' | 'YELLOW' | 'RED';
  totalPaidAmount: number;
  pendingPenaltyAmount: number;
  activeCredits: number;
  settledCredits: number;
  totalInstallmentsCount: number;
  upcomingInstallments: UpcomingInstallment[];
}

export interface PortalCredit {
  id: string;
  type: 'SALE' | 'LOAN';
  name: string | null;
  totalAmount: number;
  totalToReturn: number;
  installmentsCount: number;
  installmentAmount: number | null;
  paymentFrequency: PaymentFrequency;
  status: 'ACTIVE' | 'SETTLED';
  createdAt: string;
  approvedAt: string | null;
  settledAt: string | null;
  totalInstallments: number;
  paidInstallments: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
  pendingPenalty: number;
  hasOverdue: boolean;
  overdueInstallmentsCount: number;
}

export interface PortalInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  penaltyAmount: number;
  status: 'PENDING' | 'OVERDUE' | 'PARTIAL' | 'PAID';
}

export interface PortalCreditDetail extends PortalCredit {
  installments: PortalInstallment[];
  downPayment: number;
  downPaymentMethod: string | null;
  prepaidInstallments: number;
  interestRate: number | null;
}
