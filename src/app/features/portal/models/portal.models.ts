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
}

export interface AccountSummary {
  totalOwed: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  statusIndicator: 'GREEN' | 'YELLOW' | 'RED';
  totalPaidAmount: number;
  pendingPenaltyAmount: number;
  upcomingInstallments: UpcomingInstallment[];
}

export interface PortalCredit {
  id: string;
  type: 'SALE' | 'LOAN';
  totalAmount: number;
  totalToReturn: number;
  installmentsCount: number;
  paymentFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  status: 'ACTIVE' | 'SETTLED';
  createdAt: string;
  approvedAt: string | null;
  totalInstallments: number;
  paidInstallments: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
  pendingPenalty: number;
  hasOverdue: boolean;
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
}
