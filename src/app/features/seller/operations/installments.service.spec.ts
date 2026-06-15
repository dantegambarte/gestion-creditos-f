import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { jwtInterceptor } from '../../../core/interceptors/jwt.interceptor';
import { InstallmentRaw } from '../models/installment.model';
import { InstallmentsService } from './installments.service';

const BASE = environment.apiBaseUrl;

const mockInstallmentRaw: InstallmentRaw = {
  id: 'inst-1',
  credit_id: 'credit-1',
  installment_number: 1,
  due_date: '2026-02-01',
  amount_due: 1000,
  amount_paid: 0,
  penalty_amount: 0,
  status: 'PENDING',
  created_at: '2026-01-01T00:00:00Z',
  credit_type: 'LOAN',
  customer_id: 'cust-1',
  customer_name: 'Juan Pérez',
  customer_dni: '12345678',
  collector_id: null,
  collector_name: null,
};

describe('InstallmentsService', () => {
  let service: InstallmentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstallmentsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InstallmentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('list', () => {
    it('calls GET /installments without params when no filters', () => {
      service.list().subscribe();
      const req = httpMock.expectOne((r) => r.url === `${BASE}/installments`);
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, data: [mockInstallmentRaw], message: '' });
    });

    it('sends credit_id as query param when filter provided', () => {
      service.list({ creditId: 'credit-1' }).subscribe();
      const req = httpMock.expectOne(
        (r) =>
          r.url === `${BASE}/installments` &&
          r.params.get('credit_id') === 'credit-1',
      );
      req.flush({ ok: true, data: [mockInstallmentRaw], message: '' });
    });

    it('maps snake_case to camelCase', () => {
      let result: any[] = [];
      service.list().subscribe((d) => (result = d));
      const req = httpMock.expectOne((r) => r.url === `${BASE}/installments`);
      req.flush({ ok: true, data: [mockInstallmentRaw], message: '' });
      expect(result[0].creditId).toBe('credit-1');
      expect(result[0].amountDue).toBe(1000);
      expect(result[0].customerName).toBe('Juan Pérez');
    });
  });

  describe('applyPenalty', () => {
    it('sends penalty_amount and reason in body', () => {
      service
        .applyPenalty('inst-1', { penaltyAmount: 200, reason: 'Mora' })
        .subscribe();
      const req = httpMock.expectOne(
        `${BASE}/installments/inst-1/apply-penalty`,
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body['penalty_amount']).toBe(200);
      expect(req.request.body['reason']).toBe('Mora');
      req.flush({
        ok: true,
        data: {
          id: 'inst-1',
          amount_due: 1200,
          penalty_amount: 200,
          status: 'OVERDUE',
        },
        message: '',
      });
    });
  });

  describe('waivePenalty', () => {
    it('sends PATCH with no body', () => {
      service.waivePenalty('inst-1').subscribe();
      const req = httpMock.expectOne(
        `${BASE}/installments/inst-1/waive-penalty`,
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toBeNull();
      req.flush({
        ok: true,
        data: {
          id: 'inst-1',
          amount_due: 1000,
          penalty_amount: 0,
          status: 'OVERDUE',
        },
        message: '',
      });
    });
  });

  describe('earlyPay', () => {
    it('includes transfer_reference when method is TRANSFER', () => {
      service
        .earlyPay('inst-1', {
          paymentMethod: 'TRANSFER',
          transferReference: 'TRF999',
        })
        .subscribe();
      const req = httpMock.expectOne(`${BASE}/installments/inst-1/early-pay`);
      expect(req.request.body['payment_method']).toBe('TRANSFER');
      expect(req.request.body['transfer_reference']).toBe('TRF999');
      req.flush({
        ok: true,
        data: {
          ...mockInstallmentRaw,
          amount_paid: 1000,
          status: 'PAID',
          credit_total: 12000,
          updated_at: '2026-04-24T00:00:00Z',
          credit_settled: false,
        },
        message: '',
      });
    });

    it('sends mixed split amounts without legacy payment_method', () => {
      service
        .earlyPay('inst-1', {
          paymentMethod: 'MIXED',
          amountCash: 400,
          amountTransfer: 600,
          transferReference: 'EARLY-MIX-001',
        } as any)
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/installments/inst-1/early-pay`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body['amount_cash']).toBe(400);
      expect(req.request.body['amount_transfer']).toBe(600);
      expect(req.request.body['payment_method']).toBeUndefined();
      expect(req.request.body['transfer_reference']).toBe('EARLY-MIX-001');
      req.flush({
        ok: true,
        data: {
          ...mockInstallmentRaw,
          amount_paid: 1000,
          status: 'PAID',
          credit_total: 12000,
          updated_at: '2026-04-24T00:00:00Z',
          credit_settled: false,
        },
        message: '',
      });
    });
  });
});
