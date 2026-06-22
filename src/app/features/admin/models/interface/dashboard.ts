import { Credit } from '../../../seller/models/credit.model';

export interface PendingCreditGroup {
  sellerName: string | null;
  count: number;
  totalAmount: number;
  oldestDate: string;
  credits: Credit[];
}

export interface PendingPaymentGroup {
  collectorName: string | null;
  count: number;
  totalAmount: number;
  oldestDate: string;
  payments: Payment[];
}

export interface Payment {
  id: string;
  amountReceived: number;
  paymentMethod: string;
  createdAt: string;
  installmentNumber?: number;
  amountDue?: number;
  customerName?: string;
  collectorName?: string | null;
}
