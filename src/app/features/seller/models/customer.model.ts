export type CustomerStatus = 'ACTIVE' | 'INACTIVE';

export interface Customer {
  id: string;
  fullName: string;
  dni: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: CustomerStatus;
  portalEnabled: boolean;
  createdAt: string;
  collectorId: string | null;
  collectorName: string | null;
  activeCredits?: number;
  delinquency?: string;
  paymentCapacity?: number;
}

export interface CustomerDetail extends Customer {
  portalIsTempPassword: boolean;
  portalFailedAttempts: number;
  portalLockedAt: string | null;
  updatedAt: string;
}

export interface CustomerWizardCreditSummary {
  id: string;
  type: 'SALE' | 'LOAN';
  creditName: string | null;
  totalAmount: number;
  installmentsCount: number;
  status: 'ACTIVE' | 'SETTLED';
  referenceDate: string;
}

export interface CustomerWizardSummary extends Customer {
  delinquency: string;
  paymentCapacity: number;
  activeCredits: number;
  paidInstallments: number;
  pendingInstallments: number;
  overdueInstallments: number;
  credits: CustomerWizardCreditSummary[];
}

export interface CustomerListFilters {
  status?: CustomerStatus;
  search?: string;
  collectorId?: string;
  includeSummary?: boolean;
}

export interface CustomerCreatePayload {
  fullName: string;
  dni: string;
  address?: string;
  phone?: string;
  email?: string;
  assignedCollectorId?: string;
}

export interface CustomerUpdatePayload {
  fullName?: string;
  /** Editable solo por Admin. Si cambia, es el nuevo usuario de acceso al portal. */
  dni?: string;
  address?: string;
  phone?: string;
  email?: string;
  assignedCollectorId?: string;
}

export interface CustomerRaw {
  id: string;
  full_name: string;
  dni: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  portal_enabled: boolean;
  created_at: string;
  collector_id: string | null;
  collector_name: string | null;
  active_credits?: number;
  delinquency?: string;
  payment_capacity?: number;
}

export interface CustomerDetailRaw extends CustomerRaw {
  portal_is_temp_password: boolean;
  portal_failed_attempts: number;
  portal_locked_at: string | null;
  updated_at: string;
}

export interface CustomerWizardCreditSummaryRaw {
  id: string;
  type: 'SALE' | 'LOAN';
  credit_name: string | null;
  total_amount: number;
  installments_count: number;
  status: 'ACTIVE' | 'SETTLED';
  reference_date: string;
}

export interface CustomerWizardSummaryRaw extends CustomerRaw {
  delinquency: string;
  payment_capacity: number;
  active_credits: number;
  paid_installments: number;
  pending_installments: number;
  overdue_installments: number;
  credits: CustomerWizardCreditSummaryRaw[];
}
