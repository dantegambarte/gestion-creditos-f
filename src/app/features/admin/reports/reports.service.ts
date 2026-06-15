import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
  CashConversionReport,
  CashConversionReportRaw,
  CashConversionReportRow,
  CashConversionReportRowRaw,
  CashConversionReportSummary,
  CashConversionReportSummaryRaw,
  CashMovementReport,
  CashMovementReportRaw,
  CashMovementReportRow,
  CashMovementReportRowRaw,
  CashMovementReportSummary,
  CashMovementReportSummaryRaw,
  CollectionDailyRaw,
  CollectionDailyRow,
  CollectionReport,
  CollectionReportRaw,
  CollectionSummary,
  CollectionSummaryRaw,
  CollectorReportRow,
  CollectorReportRowRaw,
  OverdueByCustomer,
  OverdueByCustomerRaw,
  OverdueReport,
  OverdueReportRaw,
  OverdueSummary,
  OverdueSummaryRaw,
  PortfolioByStatusType,
  PortfolioByStatusTypeRaw,
  PortfolioReport,
  PortfolioReportRaw,
  ProductReportRow,
  ProductReportRowRaw,
  ReportDateRange,
  SellerReportRow,
  SellerReportRowRaw,
  SummaryReport,
  SummaryReportRaw,
  UpcomingByCustomer,
  UpcomingByCustomerRaw,
  UpcomingByDay,
  UpcomingByDayRaw,
  UpcomingReport,
  UpcomingReportRaw,
} from './report.models';

/**
 * Convierte un objeto CollectionSummaryRaw a CollectionSummary.
 * @param r
 * @returns
 */
function toCollectionSummary(r: CollectionSummaryRaw): CollectionSummary {
  return {
    grandTotal: r.grand_total,
    totalCash: r.total_cash,
    totalTransfer: r.total_transfer,
    paymentsCount: r.payments_count,
    avgPayment: r.avg_payment,
  };
}

/**
 * Convierte un objeto CollectionDailyRaw a CollectionDailyRow.
 * @param r
 * @returns
 */
function toCollectionDaily(r: CollectionDailyRaw): CollectionDailyRow {
  return {
    day: r.day,
    total: r.total,
    totalCash: r.total_cash,
    totalTransfer: r.total_transfer,
    paymentsCount: r.payments_count,
  };
}

/**
 * Convierte un objeto CollectionReportRaw a CollectionReport.
 * @param r
 * @returns
 */
function toCollectionReport(r: CollectionReportRaw): CollectionReport {
  return {
    summary: toCollectionSummary(r.summary),
    daily: r.daily.map(toCollectionDaily),
  };
}

/**
 * Convierte un objeto CashConversionReportSummaryRaw a CashConversionReportSummary.
 * @param r
 * @returns
 */
function toCashConversionSummary(
  r: CashConversionReportSummaryRaw,
): CashConversionReportSummary {
  return {
    totalConversions: r.total_conversions,
    totalAmount: r.total_amount,
    cashToTransfer: r.cash_to_transfer,
    transferToCash: r.transfer_to_cash,
  };
}

/**
 * Convierte un objeto CashConversionReportRowRaw a CashConversionReportRow.
 * @param r
 * @returns
 */
function toCashConversionRow(
  r: CashConversionReportRowRaw,
): CashConversionReportRow {
  return {
    id: r.id,
    registerDate: r.register_date,
    criteria: r.criteria,
    sourceMethod: r.source_method,
    targetMethod: r.target_method,
    amount: r.amount,
    notes: r.notes,
    createdByName: r.created_by_name,
    createdAt: r.created_at,
  };
}

/**
 * Convierte un objeto CashConversionReportRaw a CashConversionReport.
 * @param r
 * @returns
 */
function toCashConversionReport(
  r: CashConversionReportRaw,
): CashConversionReport {
  return {
    summary: toCashConversionSummary(r.summary),
    rows: r.rows.map(toCashConversionRow),
  };
}

/**
 * Convierte un objeto CashMovementReportSummaryRaw a CashMovementReportSummary.
 * @param r
 * @returns
 */
function toCashMovementSummary(
  r: CashMovementReportSummaryRaw,
): CashMovementReportSummary {
  return {
    totalMovements: r.total_movements,
    totalCollections: r.total_collections,
    totalDownPayments: r.total_down_payments,
    totalExpenses: r.total_expenses,
    totalDrops: r.total_drops,
  };
}

/**
 * Convierte un objeto CashMovementReportRowRaw a CashMovementReportRow.
 * @param r
 * @returns
 */
function toCashMovementRow(r: CashMovementReportRowRaw): CashMovementReportRow {
  return {
    id: r.id,
    type: r.type,
    occurredAt: r.occurred_at,
    cashSessionId: r.cash_session_id,
    businessDate: r.business_date,
    branchName: r.branch_name,
    shiftLabel: r.shift_label,
    amount: r.amount,
    paymentMethod: r.payment_method,
    description: r.description,
    performedByName: r.performed_by_name,
    transferReference: r.transfer_reference,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerDni: r.customer_dni,
    creditId: r.credit_id,
    creditType: r.credit_type,
    installmentId: r.installment_id,
    installmentNumber: r.installment_number,
    expenseCategoryId: r.expense_category_id,
    expenseCategoryName: r.expense_category_name,
    expenseSource: r.expense_source,
    dropDestination: r.drop_destination,
    dropReason: r.drop_reason,
    dropStatus: r.drop_status,
    receiptReference: r.receipt_reference,
    conversionSourceMethod: r.conversion_source_method,
    conversionTargetMethod: r.conversion_target_method,
    conversionCriteria: r.conversion_criteria,
    productSummary: r.product_summary,
  };
}

/**
 * Convierte un objeto CashMovementReportRaw a CashMovementReport.
 * @param r
 * @returns
 */
function toCashMovementReport(r: CashMovementReportRaw): CashMovementReport {
  return {
    summary: toCashMovementSummary(r.summary),
    rows: r.rows.map(toCashMovementRow),
  };
}

/**
 * Convierte un objeto PortfolioByStatusTypeRaw a PortfolioByStatusType.
 * @param r
 * @returns
 */
function toPortfolioRow(r: PortfolioByStatusTypeRaw): PortfolioByStatusType {
  return {
    status: r.status as PortfolioByStatusType['status'],
    type: r.type as PortfolioByStatusType['type'],
    count: r.count,
    totalAmount: r.total_amount,
  };
}

/**
 * Convierte un objeto PortfolioReportRaw a PortfolioReport.
 * @param r
 * @returns
 */
function toPortfolioReport(r: PortfolioReportRaw): PortfolioReport {
  return {
    byStatusType: r.by_status_type.map(toPortfolioRow),
    activePendingBalance: r.active_pending_balance,
  };
}

/**
 * Convierte un objeto OverdueSummaryRaw a OverdueSummary.
 * @param r
 * @returns
 */
function toOverdueSummary(r: OverdueSummaryRaw): OverdueSummary {
  return {
    overdueInstallments: r.overdue_installments,
    totalOverdueAmount: r.total_overdue_amount,
    totalPenalties: r.total_penalties,
    avgDaysOverdue: r.avg_days_overdue,
  };
}

/**
 * Convierte un objeto OverdueByCustomerRaw a OverdueByCustomer.
 * @param r
 * @returns
 */
function toOverdueByCustomer(r: OverdueByCustomerRaw): OverdueByCustomer {
  return {
    customerId: r.customer_id,
    customerName: r.customer_name,
    phone: r.phone,
    overdueCount: r.overdue_count,
    totalOverdue: r.total_overdue,
    maxDaysOverdue: r.max_days_overdue,
  };
}

/**
 * Convierte un objeto OverdueReportRaw a OverdueReport.
 * @param r
 * @returns
 */
function toOverdueReport(r: OverdueReportRaw): OverdueReport {
  return {
    summary: toOverdueSummary(r.summary),
    byCustomer: r.by_customer.map(toOverdueByCustomer),
  };
}

/**
 * Convierte un objeto CollectorReportRowRaw a CollectorReportRow.
 * @param r
 * @returns
 */
function toCollectorRow(r: CollectorReportRowRaw): CollectorReportRow {
  return {
    collectorId: r.collector_id,
    collectorName: r.collector_name,
    totalPayments: r.total_payments,
    approvedCount: r.approved_count,
    rejectedCount: r.rejected_count,
    totalCollected: r.total_collected,
    approvalRate: r.approval_rate,
  };
}

/**
 * Convierte un objeto SellerReportRowRaw a SellerReportRow.
 * @param r
 * @returns
 */
function toSellerRow(r: SellerReportRowRaw): SellerReportRow {
  return {
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    role: r.role,
    totalCredits: r.total_credits,
    totalAmount: r.total_amount,
  };
}

/**
 * Convierte un objeto ProductReportRowRaw a ProductReportRow.
 * @param r
 * @returns
 */
function toProductRow(r: ProductReportRowRaw): ProductReportRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    status: r.status as ProductReportRow['status'],
    minPrice: r.min_price,
    maxPrice: r.max_price,
    availableCount: r.available_count,
    timesSold: r.times_sold,
    totalRevenue: r.total_revenue,
    avgSellingPrice: r.avg_selling_price,
  };
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly api = inject(ApiHttpService);

  /**
   * Obtiene el informe de colección para un rango de fechas.
   * @param range
   * @returns
   */
  getCollectionReport(range: ReportDateRange): Observable<CollectionReport> {
    if (!range.dateFrom || !range.dateTo) {
      return throwError(() => ({
        status: 400,
        message: 'Los parámetros date_from y date_to son obligatorios.',
      }));
    }
    const params = { date_from: range.dateFrom, date_to: range.dateTo };
    return this.api
      .get<CollectionReportRaw>('reports/collection', params)
      .pipe(map(toCollectionReport));
  }

  /**
   * Obtiene el informe de portafolio.
   * @returns
   */
  getPortfolioReport(): Observable<PortfolioReport> {
    return this.api
      .get<PortfolioReportRaw>('reports/portfolio')
      .pipe(map(toPortfolioReport));
  }

  /**
   * Obtiene el informe de vencimientos.
   * @returns
   */
  getOverdueReport(): Observable<OverdueReport> {
    return this.api
      .get<OverdueReportRaw>('reports/overdue')
      .pipe(map(toOverdueReport));
  }

  /**
   * Obtiene el informe de cobradores para un rango de fechas.
   * @param range
   * @param nocache Parámetro opcional para evitar caching HTTP 304
   * @returns
   */
  getCollectorsReport(
    range: ReportDateRange,
    nocache?: boolean,
  ): Observable<CollectorReportRow[]> {
    if (!range.dateFrom || !range.dateTo) {
      return throwError(() => ({
        status: 400,
        message: 'Los parámetros date_from y date_to son obligatorios.',
      }));
    }
    const params: Record<string, string> = {
      date_from: range.dateFrom,
      date_to: range.dateTo,
    };
    if (nocache) {
      params['t'] = Date.now().toString();
    }
    return this.api
      .get<CollectorReportRowRaw[]>('reports/collectors', params)
      .pipe(map((items) => items.map(toCollectorRow)));
  }

  /**
   * Obtiene el informe de vendedores para un rango de fechas.
   * @param range
   * @param nocache Parámetro opcional para evitar caching HTTP 304
   * @returns
   */
  getSellersReport(
    range: ReportDateRange,
    nocache?: boolean,
  ): Observable<SellerReportRow[]> {
    if (!range.dateFrom || !range.dateTo) {
      return throwError(() => ({
        status: 400,
        message: 'Los parámetros date_from y date_to son obligatorios.',
      }));
    }
    const params: Record<string, string> = {
      date_from: range.dateFrom,
      date_to: range.dateTo,
    };
    if (nocache) {
      params['t'] = Date.now().toString();
    }
    return this.api
      .get<SellerReportRowRaw[]>('reports/sellers', params)
      .pipe(map((items) => items.map(toSellerRow)));
  }

  /**
   * Obtiene el informe de productos.
   */
  getProductsReport(stockThreshold?: number): Observable<ProductReportRow[]> {
    const params: Record<string, string> = {};
    if (stockThreshold !== undefined && stockThreshold >= 0) {
      params['stock_threshold'] = String(stockThreshold);
    }
    return this.api
      .get<ProductReportRowRaw[]>('reports/products', params)
      .pipe(map((items) => items.map(toProductRow)));
  }

  /**
   * Obtiene el resumen del día.
   */
  getSummaryReport(): Observable<SummaryReport> {
    return this.api
      .get<SummaryReportRaw>('reports/summary')
      .pipe(map(toSummaryReport));
  }

  /**
   * Obtiene el reporte de vencimientos próximos.
   */
  getUpcomingReport(days?: number): Observable<UpcomingReport> {
    const params: Record<string, string> = {};
    if (days !== undefined) params['days'] = String(days);
    return this.api
      .get<UpcomingReportRaw>('reports/upcoming', params)
      .pipe(map(toUpcomingReport));
  }

  /**
   * Obtiene el reporte de conversiones de caja para un rango de fechas.
   * @param range
   * @returns
   */
  getCashConversionsReport(
    range: ReportDateRange,
  ): Observable<CashConversionReport> {
    if (!range.dateFrom || !range.dateTo) {
      return throwError(() => ({
        status: 400,
        message: 'Los parámetros date_from y date_to son obligatorios.',
      }));
    }
    const params = { date_from: range.dateFrom, date_to: range.dateTo };
    return this.api
      .get<CashConversionReportRaw>('reports/cash-conversions', params)
      .pipe(map(toCashConversionReport));
  }

  /**
   * Obtiene el reporte de movimientos de una caja operativa puntual.
   * @param cashSessionId - ID de la caja (cash_sessions.id)
   * @returns
   */
  getCashMovementsReport(
    cashSessionId: string,
  ): Observable<CashMovementReport> {
    if (!cashSessionId) {
      return throwError(() => ({
        status: 400,
        message: 'Debe seleccionar una caja para ver sus movimientos.',
      }));
    }
    return this.api
      .get<CashMovementReportRaw>('reports/cash-movements', {
        cash_session_id: cashSessionId,
      })
      .pipe(map(toCashMovementReport));
  }
}

function toSummaryReport(r: SummaryReportRaw): SummaryReport {
  return {
    reportDate: r.report_date,
    todayCollected: r.today_collected,
    todayCash: r.today_cash,
    todayTransfer: r.today_transfer,
    todayPaymentsCount: r.today_payments_count,
    todayDownPayments: r.today_down_payments,
    todayDownPaymentsCount: r.today_down_payments_count,
    todayTotal: r.today_total,
    pendingPaymentsCount: r.pending_payments_count,
    pendingCreditsCount: r.pending_credits_count,
    activePortfolioBalance: r.active_portfolio_balance,
    activeCreditsCount: r.active_credits_count,
    overdueCount: r.overdue_count,
    overdueAmount: r.overdue_amount,
    upcoming7dCount: r.upcoming_7d_count,
    upcoming7dAmount: r.upcoming_7d_amount,
    refinancedMonthCount: r.refinanced_month_count,
    refinancedMonthAmount: r.refinanced_month_amount,
  };
}

function toUpcomingByDay(r: UpcomingByDayRaw): UpcomingByDay {
  return {
    dueDate: r.due_date,
    count: r.count,
    expectedAmount: r.expected_amount,
  };
}

function toUpcomingByCustomer(r: UpcomingByCustomerRaw): UpcomingByCustomer {
  return {
    customerId: r.customer_id,
    customerName: r.customer_name,
    phone: r.phone,
    assignedCollector: r.assigned_collector,
    installmentsCount: r.installments_count,
    expectedAmount: r.expected_amount,
    nextDueDate: r.next_due_date,
  };
}

function toUpcomingReport(r: UpcomingReportRaw): UpcomingReport {
  return {
    days: r.days,
    summary: {
      installmentsCount: r.summary.installments_count,
      expectedAmount: r.summary.expected_amount,
    },
    byDay: r.by_day.map(toUpcomingByDay),
    byCustomer: r.by_customer.map(toUpcomingByCustomer),
  };
}
