export interface CollectionSummary {
  grandTotal: number;
  totalCash: number;
  totalTransfer: number;
  paymentsCount: number;
  avgPayment: number;
}

export interface CollectionDailyRow {
  day: string;
  total: number;
  totalCash: number;
  totalTransfer: number;
  paymentsCount: number;
}

export interface CollectionReport {
  summary: CollectionSummary;
  daily: CollectionDailyRow[];
}

export interface PortfolioByStatusType {
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SETTLED' | 'REJECTED';
  type: 'SALE' | 'LOAN';
  count: number;
  totalAmount: number;
}

export interface PortfolioReport {
  byStatusType: PortfolioByStatusType[];
  activePendingBalance: number;
}

export interface OverdueSummary {
  overdueInstallments: number;
  totalOverdueAmount: number;
  totalPenalties: number;
  avgDaysOverdue: number | null;
}

export interface OverdueByCustomer {
  customerId: string;
  customerName: string;
  phone: string | null;
  overdueCount: number;
  totalOverdue: number;
  maxDaysOverdue: number;
}

export interface OverdueReport {
  summary: OverdueSummary;
  byCustomer: OverdueByCustomer[];
}

export interface CollectorReportRow {
  collectorId: string;
  collectorName: string;
  totalPayments: number;
  approvedCount: number;
  rejectedCount: number;
  totalCollected: number;
  approvalRate: number | null;
}

export interface SellerReportRow {
  sellerId: string;
  sellerName: string;
  role: string;
  totalCredits: number;
  totalAmount: number;
}

export interface ProductReportRow {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE';
  minPrice: number;
  maxPrice: number;
  availableCount: number;
  timesSold: number;
  totalRevenue: number;
  avgSellingPrice: number;
}

export interface ReportDateRange {
  dateFrom: string;
  dateTo: string;
}

export interface SummaryReport {
  reportDate: string;
  todayCollected: number;
  todayCash: number;
  todayTransfer: number;
  todayPaymentsCount: number;
  todayDownPayments: number;
  todayDownPaymentsCount: number;
  todayTotal: number;
  pendingPaymentsCount: number;
  pendingCreditsCount: number;
  activePortfolioBalance: number;
  activeCreditsCount: number;
  overdueCount: number;
  overdueAmount: number;
  upcoming7dCount: number;
  upcoming7dAmount: number;
  refinancedMonthCount: number;
  refinancedMonthAmount: number;
}

export interface UpcomingByDay {
  dueDate: string;
  count: number;
  expectedAmount: number;
}

export interface UpcomingByCustomer {
  customerId: string;
  customerName: string;
  phone: string | null;
  assignedCollector: string | null;
  installmentsCount: number;
  expectedAmount: number;
  nextDueDate: string;
}

export interface UpcomingReport {
  days: number;
  summary: { installmentsCount: number; expectedAmount: number };
  byDay: UpcomingByDay[];
  byCustomer: UpcomingByCustomer[];
}

export interface SummaryReportRaw {
  report_date: string;
  today_collected: number;
  today_cash: number;
  today_transfer: number;
  today_payments_count: number;
  today_down_payments: number;
  today_down_payments_count: number;
  today_total: number;
  pending_payments_count: number;
  pending_credits_count: number;
  active_portfolio_balance: number;
  active_credits_count: number;
  overdue_count: number;
  overdue_amount: number;
  upcoming_7d_count: number;
  upcoming_7d_amount: number;
  refinanced_month_count: number;
  refinanced_month_amount: number;
}

export interface UpcomingByDayRaw {
  due_date: string;
  count: number;
  expected_amount: number;
}

export interface UpcomingByCustomerRaw {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  assigned_collector: string | null;
  installments_count: number;
  expected_amount: number;
  next_due_date: string;
}

export interface UpcomingReportRaw {
  days: number;
  summary: { installments_count: number; expected_amount: number };
  by_day: UpcomingByDayRaw[];
  by_customer: UpcomingByCustomerRaw[];
}

export type ReportTab =
  | 'summary'
  | 'collection'
  | 'portfolio'
  | 'overdue'
  | 'collectors'
  | 'products'
  | 'upcoming';

export interface CollectionSummaryRaw {
  grand_total: number;
  total_cash: number;
  total_transfer: number;
  payments_count: number;
  avg_payment: number;
}

export interface CollectionDailyRaw {
  day: string;
  total: number;
  total_cash: number;
  total_transfer: number;
  payments_count: number;
}

export interface CollectionReportRaw {
  summary: CollectionSummaryRaw;
  daily: CollectionDailyRaw[];
}

export interface PortfolioByStatusTypeRaw {
  status: string;
  type: string;
  count: number;
  total_amount: number;
}

export interface PortfolioReportRaw {
  by_status_type: PortfolioByStatusTypeRaw[];
  active_pending_balance: number;
}

export interface OverdueSummaryRaw {
  overdue_installments: number;
  total_overdue_amount: number;
  total_penalties: number;
  avg_days_overdue: number | null;
}

export interface OverdueByCustomerRaw {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  overdue_count: number;
  total_overdue: number;
  max_days_overdue: number;
}

export interface OverdueReportRaw {
  summary: OverdueSummaryRaw;
  by_customer: OverdueByCustomerRaw[];
}

export interface CollectorReportRowRaw {
  collector_id: string;
  collector_name: string;
  total_payments: number;
  approved_count: number;
  rejected_count: number;
  total_collected: number;
  approval_rate: number | null;
}

export interface SellerReportRowRaw {
  seller_id: string;
  seller_name: string;
  role: string;
  total_credits: number;
  total_amount: number;
}

export interface ProductReportRowRaw {
  id: string;
  title: string;
  description: string;
  status: string;
  min_price: number;
  max_price: number;
  available_count: number;
  times_sold: number;
  total_revenue: number;
  avg_selling_price: number;
}
