import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { jwtInterceptor } from '../../core/interceptors/jwt.interceptor';
import { PaymentRaw } from './models/payment.model';
import { PaymentsService } from './payments.service';

const BASE = environment.apiBaseUrl;

const mockPaymentRaw: PaymentRaw = {
  id: 'pay-1',
  installment_id: 'inst-1',
  amount_received: 500,
  payment_method: 'CASH',
  transfer_reference: null,
  status: 'PENDING',
  rejection_reason: null,
  notes: null,
  created_at: '2026-04-24T10:00:00Z',
  approved_at: null,
  approved_by: null,
  installment_number: 2,
  amount_due: 1000,
  due_date: '2026-04-30',
  credit_id: 'credit-1',
  credit_type: 'LOAN',
  customer_name: 'Juan Pérez',
  customer_dni: '12345678',
  collector_name: 'María G.',
  is_reversal: false,
  admin_direct: false,
  parent_payment_id: null,
  reversal_payment_id: null,
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaymentsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PaymentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('list', () => {
    it('calls GET /payments without params when no filters', () => {
      service.list().subscribe();
      const req = httpMock.expectOne((r) => r.url === `${BASE}/payments`);
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, data: [mockPaymentRaw], message: '' });
    });

    it('sends installment_id as query param when filter provided', () => {
      service.list({ installmentId: 'inst-1' }).subscribe();
      const req = httpMock.expectOne(
        (r) =>
          r.url === `${BASE}/payments` &&
          r.params.get('installment_id') === 'inst-1',
      );
      req.flush({ ok: true, data: [mockPaymentRaw], message: '' });
    });

    it('maps snake_case to camelCase', () => {
      let result: any[] = [];
      service.list().subscribe((d) => (result = d));
      const req = httpMock.expectOne((r) => r.url === `${BASE}/payments`);
      req.flush({ ok: true, data: [mockPaymentRaw], message: '' });
      expect(result[0].installmentId).toBe('inst-1');
      expect(result[0].amountReceived).toBe(500);
      expect(result[0].customerName).toBe('Juan Pérez');
    });
  });

  describe('create', () => {
    it('maps warning field when present in response', () => {
      let result: any;
      service
        .create({
          installmentId: 'inst-1',
          amountReceived: 500,
          paymentMethod: 'CASH',
        })
        .subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${BASE}/payments`);
      req.flush({
        ok: true,
        data: {
          id: 'pay-1',
          installment_id: 'inst-1',
          amount_received: 500,
          payment_method: 'CASH',
          status: 'PENDING',
          created_at: '2026-04-24T10:00:00Z',
          warning: 'El monto supera el 90% del saldo.',
        },
        message: '',
      });

      expect(result.warning).toBe('El monto supera el 90% del saldo.');
      expect(result.installmentId).toBe('inst-1');
    });

    it('warning is undefined when not in response', () => {
      let result: any;
      service
        .create({
          installmentId: 'inst-1',
          amountReceived: 500,
          paymentMethod: 'CASH',
        })
        .subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${BASE}/payments`);
      req.flush({
        ok: true,
        data: {
          id: 'pay-1',
          installment_id: 'inst-1',
          amount_received: 500,
          payment_method: 'CASH',
          status: 'PENDING',
          created_at: '2026-04-24T10:00:00Z',
        },
        message: '',
      });

      expect(result.warning).toBeUndefined();
    });

    it('sends transfer_reference when payment_method is TRANSFER', () => {
      service
        .create({
          installmentId: 'inst-1',
          amountReceived: 500,
          paymentMethod: 'TRANSFER',
          transferReference: 'REF-ABC',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/payments`);
      expect(req.request.body['payment_method']).toBe('TRANSFER');
      expect(req.request.body['transfer_reference']).toBe('REF-ABC');
      req.flush({
        ok: true,
        data: {
          id: 'pay-2',
          installment_id: 'inst-1',
          amount_received: 500,
          payment_method: 'TRANSFER',
          status: 'PENDING',
          created_at: '2026-04-24T10:00:00Z',
        },
        message: '',
      });
    });
  });

  describe('approve', () => {
    it('sends PATCH and maps PaymentDetail', () => {
      let result: any;
      service.approve('pay-1').subscribe((d) => (result = d));
      const req = httpMock.expectOne(`${BASE}/payments/pay-1/approve`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toBeNull();
      req.flush({
        ok: true,
        data: {
          ...mockPaymentRaw,
          amount_paid: 500,
          penalty_amount: 0,
          customer_id: 'cust-1',
          collector_id: 'coll-1',
        },
        message: '',
      });
      expect(result.amountPaid).toBe(500);
      expect(result.customerId).toBe('cust-1');
      expect(result.installmentId).toBe('inst-1');
    });
  });

  describe('reject', () => {
    it('sends rejection_reason in body', () => {
      service.reject('pay-1', 'Monto incorrecto').subscribe();
      const req = httpMock.expectOne(`${BASE}/payments/pay-1/reject`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body['rejection_reason']).toBe('Monto incorrecto');
      req.flush({ ok: true, data: null, message: '' });
    });
  });
});
