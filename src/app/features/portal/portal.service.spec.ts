import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortalService } from './portal.service';
import { environment } from '../../../environments/environment';

describe('PortalService', () => {
  let service: PortalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PortalService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PortalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAccountSummary() maps upcoming_installments with camelCase', () => {
    let result: ReturnType<typeof service.getAccountSummary> extends import('rxjs').Observable<
      infer T
    >
      ? T
      : never;

    service.getAccountSummary().subscribe((data) => (result = data as typeof result));

    const req = http.expectOne(`${environment.apiBaseUrl}/portal/me`);
    req.flush({
      ok: true,
      message: '',
      data: {
        total_owed: 50000,
        paid_count: 3,
        pending_count: 5,
        overdue_count: 1,
        status_indicator: 'YELLOW',
        upcoming_installments: [
          {
            id: 'inst-1',
            installment_number: 4,
            due_date: '2026-05-01T00:00:00.000Z',
            amount_due: 10000,
            amount_paid: 0,
            penalty_amount: 500,
            status: 'OVERDUE',
            credit_id: 'cred-1',
            credit_type: 'LOAN',
          },
        ],
      },
    });

    expect(result!.totalOwed).toBe(50000);
    expect(result!.overdueCount).toBe(1);
    expect(result!.statusIndicator).toBe('YELLOW');
    expect(result!.upcomingInstallments[0].installmentNumber).toBe(4);
    expect(result!.upcomingInstallments[0].creditId).toBe('cred-1');
    expect(result!.upcomingInstallments[0].creditType).toBe('LOAN');
    expect(result!.upcomingInstallments[0].penaltyAmount).toBe(500);
  });

  it('getCredits() mapea remaining_amount (deuda restante calculada por el backend) (#55)', () => {
    let result: Record<string, unknown>[] = [];
    service
      .getCredits()
      .subscribe((data) => (result = data as unknown as Record<string, unknown>[]));

    http.expectOne(`${environment.apiBaseUrl}/portal/credits`).flush({
      ok: true,
      message: '',
      data: [{ id: 'cred-1', type: 'LOAN', status: 'ACTIVE', remaining_amount: 3500 }],
    });

    expect(result[0]['remainingAmount']).toBe(3500);
  });

  it('getCreditById() maps installments with camelCase', () => {
    let result: ReturnType<typeof service.getCreditById> extends import('rxjs').Observable<infer T>
      ? T
      : never;

    service.getCreditById('cred-1').subscribe((data) => (result = data as typeof result));

    const req = http.expectOne(`${environment.apiBaseUrl}/portal/credits/cred-1`);
    req.flush({
      ok: true,
      message: '',
      data: {
        id: 'cred-1',
        type: 'LOAN',
        total_amount: 120000,
        installments_count: 12,
        payment_frequency: 'MONTHLY',
        status: 'ACTIVE',
        created_at: '2025-01-01T00:00:00.000Z',
        approved_at: '2025-01-02T00:00:00.000Z',
        total_installments: 12,
        paid_installments: 3,
        next_due_date: '2026-05-01T00:00:00.000Z',
        next_due_amount: 10000,
        installments: [
          {
            id: 'i-1',
            installment_number: 1,
            due_date: '2025-02-01T00:00:00.000Z',
            amount_due: 10000,
            amount_paid: 10000,
            penalty_amount: 0,
            status: 'PAID',
          },
          {
            id: 'i-4',
            installment_number: 4,
            due_date: '2025-05-01T00:00:00.000Z',
            amount_due: 10000,
            amount_paid: 0,
            penalty_amount: 300,
            status: 'OVERDUE',
          },
        ],
      },
    });

    expect(result!.id).toBe('cred-1');
    expect(result!.totalAmount).toBe(120000);
    expect(result!.paidInstallments).toBe(3);
    expect(result!.installments.length).toBe(2);
    expect(result!.installments[0].installmentNumber).toBe(1);
    expect(result!.installments[0].amountPaid).toBe(10000);
    expect(result!.installments[1].penaltyAmount).toBe(300);
    expect(result!.installments[1].status).toBe('OVERDUE');
  });

  it('getCreditById() codifica el id para que no altere la URL de la API', () => {
    service.getCreditById('../admin?x=1#y').subscribe({ error: () => undefined });

    const req = http.expectOne(`${environment.apiBaseUrl}/portal/credits/..%2Fadmin%3Fx%3D1%23y`);
    expect(req.request.method).toBe('GET');
    req.flush(null, { status: 404, statusText: 'Not Found' });
  });
});
