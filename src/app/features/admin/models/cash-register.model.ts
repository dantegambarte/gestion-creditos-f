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
  cashAmount: number;
  transferAmount: number;
  declaredCash: number;
  difference: number;
  differenceStatus: DifferenceStatus;
  observations: string | null;
  createdAt: string;
  closedByName: string;
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
  cash_amount: number;
  transfer_amount: number;
  declared_cash: number;
  difference: number;
  difference_status: string;
  observations: string | null;
  created_at: string;
  closed_by_name: string;
}
