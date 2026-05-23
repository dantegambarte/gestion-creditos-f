export interface Expense {
  id: string;
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference: string | null;
  categoryId: string | null;
  categoryName: string | null;
  expenseDate: string;
  createdAt: string;
  createdByName: string;
}

export interface ExpenseListFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseCreatePayload {
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference?: string;
  categoryId?: string;
  expenseDate?: string;
}

export interface ExpenseUpdatePayload {
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference?: string;
  categoryId?: string;
  expenseDate?: string;
}

export interface ExpensePagedResponse {
  rows: Expense[];
  total: number;
}

export interface ExpenseRaw {
  id: string;
  amount: number;
  description: string;
  payment_method: string;
  transfer_reference: string | null;
  category_id: string | null;
  category_name: string | null;
  expense_date: string;
  created_at: string;
  created_by_name: string;
}

export interface ExpensePagedRaw {
  rows: ExpenseRaw[];
  total: number;
}
