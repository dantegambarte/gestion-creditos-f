import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiHttpService } from '../../../core/http/api-http.service';
import {
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
    const params: Record<string, string> = { date_from: range.dateFrom, date_to: range.dateTo };
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
    const params: Record<string, string> = { date_from: range.dateFrom, date_to: range.dateTo };
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
