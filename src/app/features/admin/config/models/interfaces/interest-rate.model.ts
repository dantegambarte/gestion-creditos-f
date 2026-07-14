import type { PaymentFrequency } from '../../../../../shared/models/payment-frequency';
export type { PaymentFrequency };

export interface InterestRate {
  id: string;
  paymentFrequency: PaymentFrequency;
  installmentsCount: number;
  minAmount: number;
  maxAmount: number | null;
  rate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InterestRateListFilters {
  paymentFrequency?: PaymentFrequency;
  active?: boolean;
}

export interface InterestRateCreatePayload {
  paymentFrequency: PaymentFrequency;
  installmentsCount: number;
  minAmount: number;
  maxAmount?: number;
  rate: number;
}

export interface InterestRateUpdatePayload {
  rate?: number;
  active?: boolean;
}

export interface RateGroup {
  frequency: PaymentFrequency;
  label: string;
  rates: InterestRate[];
}

export interface CreateForm {
  paymentFrequency: PaymentFrequency | null;
  installmentsCount: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  ratePercent: number | null;
}

export interface InterestRateRaw {
  id: string;
  payment_frequency: string;
  installments_count: number;
  min_amount: number;
  max_amount: number | null;
  rate: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
