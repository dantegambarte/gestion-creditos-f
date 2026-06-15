export type DifferenceStatus = 'EXACT' | 'SURPLUS' | 'SHORTAGE';

export interface CashRegisterDashboard {
  date: string;
  isClosed: boolean;
  cashAmount: number;
  transferAmount: number;
  totalCollected: number;
  totalOutflows: number;
  approvedCount: number;
  pendingCount: number;
  netBalance: number;
  pendingAmount: number;
  downPaymentsTotal: number;
  downPaymentsCount: number;
}

export interface CashRegister {
  id: string;
  registerDate: string;
  totalCollected: number;
  totalOutflows: number;
  cashAmount: number;
  transferAmount: number;
  declaredCash: number;
  difference: number;
  differenceStatus: DifferenceStatus;
  observations: string | null;
  createdAt: string;
  closedByName: string;
}

export interface CashRegisterBreakdownPayment {
  id: string;
  amountReceived: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference: string | null;
  approvedAt: string;
  customerName: string;
  collectorName: string;
  installmentNumber: number;
}

export interface CashRegisterBreakdownDownPayment {
  id: string;
  amount: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference: string | null;
  paymentType: string;
  createdAt: string;
  customerName: string;
  approvedByName: string;
}

export interface CashRegisterBreakdownLiquidation {
  id: string;
  totalPaid: number;
  commissionsTotal: number;
  salaryAmount: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference: string | null;
  paidAt: string;
  employeeName: string;
}

export interface CashRegisterBreakdownExpense {
  id: string;
  amount: number;
  description: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  transferReference: string | null;
  createdAt: string;
  createdByName: string;
}

export interface CashRegisterDetail extends CashRegister {
  breakdown: {
    payments: CashRegisterBreakdownPayment[];
    downPayments: CashRegisterBreakdownDownPayment[];
    liquidations: CashRegisterBreakdownLiquidation[];
    expenses: CashRegisterBreakdownExpense[];
  };
}

export interface CashRegisterPreClose {
  date: string;
  ingresos: {
    cobrosEfectivo: number;
    cobrosTransferencia: number;
    enganchesEfectivo: number;
    enganchesTransferencia: number;
    totalBruto: number;
  };
  egresos: {
    gastosEfectivo: number;
    gastosTransferencia: number;
    comisionesEfectivo: number;
    comisionesTransferencia: number;
    total: number;
  };
  efectivo: { esperado: number };
  transferencias: { esperado: number };
  pendientes: { count: number; amount: number };
}

export interface CashRegisterPreCloseRaw {
  date: string;
  ingresos: {
    cobros_efectivo: number;
    cobros_transferencia: number;
    enganches_efectivo: number;
    enganches_transferencia: number;
    total_bruto: number;
  };
  egresos: {
    gastos_efectivo: number;
    gastos_transferencia: number;
    comisiones_efectivo: number;
    comisiones_transferencia: number;
    total: number;
  };
  efectivo: { esperado: number };
  transferencias: { esperado: number };
  pendientes: { count: number; amount: number };
}

export interface CashRegisterFilters {
  dateFrom?: string;
  dateTo?: string;
  differenceStatus?: DifferenceStatus;
}

export interface CashRegisterClosePayload {
  declaredCash: number;
  observations?: string;
  force?: boolean;
  /** Fecha para cierre retroactivo (YYYY-MM-DD). Opcional. */
  registerDate?: string;
}

export interface CashConversionPayload {
  criteria: 'DAILY' | 'COMPANY';
  sourceMethod: 'CASH' | 'TRANSFER';
  amount: number;
  notes?: string;
  registerDate?: string;
}

export interface CashSessionManualIncomePayload {
  amount: number;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'MIXED';
  amountCash?: number;
  amountTransfer?: number;
  description: string;
  receiptReference?: string;
}

export interface CashSessionManualIncome {
  id: string;
  cashSessionId: string;
  amount: number;
  paymentMethod: 'CASH' | 'TRANSFER';
  description: string;
  receiptReference: string | null;
  createdBy: string;
  createdAt: string;
}

export interface CashConversion {
  id: string;
  registerDate: string;
  criteria: 'DAILY' | 'COMPANY';
  sourceMethod: 'CASH' | 'TRANSFER';
  targetMethod: 'CASH' | 'TRANSFER';
  amount: number;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export type CashRegisterMovementType = 'INGRESO' | 'EGRESO' | 'CONVERSION';

export interface CashRegisterMovement {
  id: string;
  concepto: string;
  fechaHora: string;
  responsable: string;
  tipo: CashRegisterMovementType;
  monto: number;
  metodoPago: string;
}

export interface CashRegisterDashboardRaw {
  date: string;
  is_closed: boolean;
  cash_amount: number;
  transfer_amount: number;
  total_collected: number;
  total_outflows: number;
  approved_count: number;
  pending_count: number;
  net_balance: number;
  pending_amount: number;
  down_payments_total: number;
  down_payments_count: number;
}

export interface CashRegisterRaw {
  id: string;
  register_date: string;
  total_collected: number;
  total_outflows: number;
  cash_amount: number;
  transfer_amount: number;
  declared_cash: number;
  difference: number;
  difference_status: string;
  observations: string | null;
  created_at: string;
  closed_by_name: string;
}

export interface CashRegisterMovementRaw {
  id: string;
  concepto: string;
  fecha_hora: string;
  responsable: string;
  tipo: CashRegisterMovementType;
  monto: number;
  metodo_pago: string;
}

export interface CashRegisterDetailRaw extends CashRegisterRaw {
  breakdown: {
    payments: Array<{
      id: string;
      amount_received: number;
      payment_method: string;
      transfer_reference: string | null;
      approved_at: string;
      customer_name: string;
      collector_name: string;
      installment_number: number;
    }>;
    down_payments: Array<{
      id: string;
      amount: number;
      payment_method: string;
      transfer_reference: string | null;
      payment_type: string;
      created_at: string;
      customer_name: string;
      approved_by_name: string;
    }>;
    liquidations: Array<{
      id: string;
      total_paid: number;
      commissions_total: number;
      salary_amount: number;
      payment_method: string;
      transfer_reference: string | null;
      paid_at: string;
      employee_name: string;
    }>;
    expenses: Array<{
      id: string;
      amount: number;
      description: string;
      payment_method: string;
      transfer_reference: string | null;
      created_at: string;
      created_by_name: string;
    }>;
  };
}
