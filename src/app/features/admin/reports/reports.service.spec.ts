import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiHttpService } from '../../../core/http/api-http.service';
import { ReportsService } from './reports.service';

const mockCollectionRaw = {
  summary: {
    grand_total: 100000,
    total_cash: 60000,
    total_transfer: 40000,
    payments_count: 20,
    avg_payment: 5000,
  },
  daily: [
    {
      day: '2026-04-01',
      total: 10000,
      total_cash: 6000,
      total_transfer: 4000,
      payments_count: 2,
    },
  ],
};

const mockPortfolioRaw = {
  by_status_type: [
    { status: 'ACTIVE', type: 'SALE', count: 10, total_amount: 500000 },
    { status: 'SETTLED', type: 'LOAN', count: 5, total_amount: 200000 },
  ],
  active_pending_balance: 350000,
};

const mockOverdueRaw = {
  summary: {
    overdue_installments: 15,
    total_overdue_amount: 75000,
    total_penalties: 3000,
    avg_days_overdue: 12.5,
  },
  by_customer: [
    {
      customer_id: 'c1',
      customer_name: 'Juan Pérez',
      phone: '1112345678',
      overdue_count: 3,
      total_overdue: 30000,
      max_days_overdue: 20,
    },
  ],
};

const mockCollectorsRaw = [
  {
    collector_id: 'col1',
    collector_name: 'María García',
    total_payments: 50,
    approved_count: 45,
    rejected_count: 5,
    total_collected: 225000,
    approval_rate: 90.0,
  },
  {
    collector_id: 'col2',
    collector_name: 'Luis Torres',
    total_payments: 0,
    approved_count: 0,
    rejected_count: 0,
    total_collected: 0,
    approval_rate: null,
  },
];

const mockProductsRaw = [
  {
    id: 'p1',
    name: 'Producto A',
    current_price: 15000,
    available_stock: 10,
    status: 'ACTIVE',
    times_sold: 25,
    total_units_sold: 30,
    total_revenue: 450000,
  },
  {
    id: 'p2',
    name: 'Producto B',
    current_price: 8000,
    available_stock: 0,
    status: 'ACTIVE',
    times_sold: 0,
    total_units_sold: 0,
    total_revenue: 0,
  },
];

describe('ReportsService', () => {
  let service: ReportsService;
  let apiSpy: jasmine.SpyObj<ApiHttpService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiHttpService', ['get']);
    TestBed.configureTestingModule({
      providers: [ReportsService, { provide: ApiHttpService, useValue: apiSpy }],
    });
    service = TestBed.inject(ReportsService);
  });

  describe('getCollectionReport', () => {
    it('returns error observable without calling backend when dateFrom is missing', (done) => {
      service
        .getCollectionReport({ dateFrom: '', dateTo: '2026-04-30' })
        .subscribe({
          next: () => fail('expected error'),
          error: (err) => {
            expect(err.status).toBe(400);
            expect(apiSpy.get).not.toHaveBeenCalled();
            done();
          },
        });
    });

    it('returns error observable without calling backend when dateTo is missing', (done) => {
      service
        .getCollectionReport({ dateFrom: '2026-04-01', dateTo: '' })
        .subscribe({
          next: () => fail('expected error'),
          error: (err) => {
            expect(err.status).toBe(400);
            expect(apiSpy.get).not.toHaveBeenCalled();
            done();
          },
        });
    });

    it('maps response to camelCase when both dates provided', (done) => {
      apiSpy.get.and.returnValue(of(mockCollectionRaw));
      service
        .getCollectionReport({ dateFrom: '2026-04-01', dateTo: '2026-04-30' })
        .subscribe((r) => {
          expect(r.summary.grandTotal).toBe(100000);
          expect(r.summary.totalCash).toBe(60000);
          expect(r.summary.paymentsCount).toBe(20);
          expect(r.daily.length).toBe(1);
          expect(r.daily[0].totalCash).toBe(6000);
          done();
        });
    });
  });

  describe('getPortfolioReport', () => {
    it('maps byStatusType with camelCase', (done) => {
      apiSpy.get.and.returnValue(of(mockPortfolioRaw));
      service.getPortfolioReport().subscribe((r) => {
        expect(r.activePendingBalance).toBe(350000);
        expect(r.byStatusType.length).toBe(2);
        expect(r.byStatusType[0].totalAmount).toBe(500000);
        expect(r.byStatusType[0].status).toBe('ACTIVE');
        done();
      });
    });
  });

  describe('getOverdueReport', () => {
    it('maps summary fields', (done) => {
      apiSpy.get.and.returnValue(of(mockOverdueRaw));
      service.getOverdueReport().subscribe((r) => {
        expect(r.summary.overdueInstallments).toBe(15);
        expect(r.summary.totalOverdueAmount).toBe(75000);
        expect(r.summary.avgDaysOverdue).toBe(12.5);
        done();
      });
    });

    it('maps byCustomer correctly', (done) => {
      apiSpy.get.and.returnValue(of(mockOverdueRaw));
      service.getOverdueReport().subscribe((r) => {
        expect(r.byCustomer.length).toBe(1);
        expect(r.byCustomer[0].customerName).toBe('Juan Pérez');
        expect(r.byCustomer[0].maxDaysOverdue).toBe(20);
        done();
      });
    });
  });

  describe('getCollectorsReport', () => {
    it('returns error observable without calling backend when dates missing', (done) => {
      service
        .getCollectorsReport({ dateFrom: '', dateTo: '' })
        .subscribe({
          next: () => fail('expected error'),
          error: (err) => {
            expect(err.status).toBe(400);
            expect(apiSpy.get).not.toHaveBeenCalled();
            done();
          },
        });
    });

    it('maps approvalRate null as null (not 0)', (done) => {
      apiSpy.get.and.returnValue(of(mockCollectorsRaw));
      service
        .getCollectorsReport({ dateFrom: '2026-04-01', dateTo: '2026-04-30' })
        .subscribe((rows) => {
          expect(rows[0].approvalRate).toBe(90.0);
          expect(rows[1].approvalRate).toBeNull();
          done();
        });
    });
  });

  describe('getProductsReport', () => {
    it('maps all fields including zero-sales products', (done) => {
      apiSpy.get.and.returnValue(of(mockProductsRaw));
      service.getProductsReport().subscribe((rows) => {
        expect(rows.length).toBe(2);
        expect(rows[0].maxPrice).toBe(15000);
        expect(rows[0].availableCount).toBe(10);
        expect(rows[0].timesSold).toBe(25);
        expect(rows[0].totalRevenue).toBe(450000);
        expect(rows[1].timesSold).toBe(0);
        expect(rows[1].availableCount).toBe(0);
        done();
      });
    });

    it('passes stock_threshold param when provided', () => {
      apiSpy.get.and.returnValue(of([]));
      service.getProductsReport(5).subscribe(() => {});
      const [, params] = apiSpy.get.calls.mostRecent().args;
      expect((params as Record<string, string>)['stock_threshold']).toBe('5');
    });

    it('does not pass stock_threshold when undefined', () => {
      apiSpy.get.and.returnValue(of([]));
      service.getProductsReport().subscribe(() => {});
      const [, params] = apiSpy.get.calls.mostRecent().args;
      expect((params as Record<string, string>)['stock_threshold']).toBeUndefined();
    });
  });

  describe('getSummaryReport', () => {
    const mockSummaryRaw = {
      report_date: '2026-04-28',
      today_collected: 50000,
      today_cash: 30000,
      today_transfer: 20000,
      today_payments_count: 15,
      today_down_payments: 5000,
      today_down_payments_count: 3,
      today_total: 55000,
      pending_payments_count: 8,
      pending_credits_count: 4,
      active_portfolio_balance: 500000,
      overdue_count: 12,
      overdue_amount: 60000,
      upcoming_7d_count: 20,
      upcoming_7d_amount: 100000,
    };

    it('maps all fields to camelCase', (done) => {
      apiSpy.get.and.returnValue(of(mockSummaryRaw));
      service.getSummaryReport().subscribe((r) => {
        expect(r.reportDate).toBe('2026-04-28');
        expect(r.todayCollected).toBe(50000);
        expect(r.todayCash).toBe(30000);
        expect(r.todayTransfer).toBe(20000);
        expect(r.todayPaymentsCount).toBe(15);
        expect(r.todayDownPayments).toBe(5000);
        expect(r.todayDownPaymentsCount).toBe(3);
        expect(r.todayTotal).toBe(55000);
        expect(r.pendingPaymentsCount).toBe(8);
        expect(r.pendingCreditsCount).toBe(4);
        expect(r.activePortfolioBalance).toBe(500000);
        expect(r.overdueCount).toBe(12);
        expect(r.overdueAmount).toBe(60000);
        expect(r.upcoming7dCount).toBe(20);
        expect(r.upcoming7dAmount).toBe(100000);
        done();
      });
    });

    it('calls GET reports/summary', () => {
      apiSpy.get.and.returnValue(of(mockSummaryRaw));
      service.getSummaryReport().subscribe(() => {});
      const [path] = apiSpy.get.calls.mostRecent().args;
      expect(path).toBe('reports/summary');
    });
  });

  describe('getUpcomingReport', () => {
    const mockUpcomingRaw = {
      days: 30,
      summary: { installments_count: 50, expected_amount: 250000 },
      by_day: [{ due_date: '2026-05-01', count: 5, expected_amount: 25000 }],
      by_customer: [{
        customer_id: 'c1',
        customer_name: 'Ana García',
        phone: '1122334455',
        assigned_collector: 'Pedro Cobrador',
        installments_count: 2,
        expected_amount: 10000,
        next_due_date: '2026-05-01',
      }],
    };

    it('maps all fields to camelCase', (done) => {
      apiSpy.get.and.returnValue(of(mockUpcomingRaw));
      service.getUpcomingReport(30).subscribe((r) => {
        expect(r.days).toBe(30);
        expect(r.summary.installmentsCount).toBe(50);
        expect(r.summary.expectedAmount).toBe(250000);
        expect(r.byDay.length).toBe(1);
        expect(r.byDay[0].dueDate).toBe('2026-05-01');
        expect(r.byDay[0].expectedAmount).toBe(25000);
        expect(r.byCustomer.length).toBe(1);
        expect(r.byCustomer[0].customerName).toBe('Ana García');
        expect(r.byCustomer[0].assignedCollector).toBe('Pedro Cobrador');
        expect(r.byCustomer[0].installmentsCount).toBe(2);
        done();
      });
    });

    it('passes days query param when provided', () => {
      apiSpy.get.and.returnValue(of(mockUpcomingRaw));
      service.getUpcomingReport(14).subscribe(() => {});
      const [, params] = apiSpy.get.calls.mostRecent().args;
      expect((params as Record<string, string>)['days']).toBe('14');
    });

    it('does not pass days param when undefined', () => {
      apiSpy.get.and.returnValue(of(mockUpcomingRaw));
      service.getUpcomingReport().subscribe(() => {});
      const [, params] = apiSpy.get.calls.mostRecent().args;
      expect((params as Record<string, string>)['days']).toBeUndefined();
    });
  });
});
