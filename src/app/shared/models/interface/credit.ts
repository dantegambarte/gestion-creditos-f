export interface Credit {
  id: string;
  type: string;
  product: string;
  originalAmount: number;
  pendingBalance: number;
  currentInstallment: number;
  totalInstallments: number;
  monthlyInstallment: number;
  nextDueDate: string;
  rate: string;
  status: 'ACTIVE' | 'OVERDUE' | 'PAID';
  progress: number;
  overdueDays?: number;
  accruedLateFee?: number;
  lateFeeExpiry?: string;
}
