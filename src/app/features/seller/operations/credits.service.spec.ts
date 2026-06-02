import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { jwtInterceptor } from '../../../core/interceptors/jwt.interceptor';
import {
  CreditDetailRaw,
  CreditRaw,
} from '../models/credit.model';

import { CreditsService } from './credits.service';

const BASE = environment.apiBaseUrl;

const mockCreditRaw: CreditRaw = {
  id: 'credit-1',
  type: 'LOAN',
  total_amount: 10000,
  installments_count: 12,
  payment_frequency: 'MONTHLY',
  interest_rate: 5,
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  approved_at: null,
  customer_id: 'cust-1',
  customer_name: 'Juan Pérez',
  customer_dni: '12345678',
  created_by_id: 'user-1',
  created_by_name: 'Vendedor Uno',
};

const mockDetailRaw: CreditDetailRaw = {
  ...mockCreditRaw,
  type: 'SALE',
  rejection_reason: null,
  notes: null,
  approved_by: null,
  customer_phone: '1122334455',
  financed_amount: 10000,
  products: [
    {
      id: 'cp-1',
      quantity: 2,
      historical_price: 500,
      product_id: 'prod-1',
      product_name: 'Prod A',
      historical_rate: null,
    },
  ],
  installments: [
    {
      id: 'inst-1',
      installment_number: 1,
      due_date: '2026-02-01',
      amount_due: 900,
      amount_paid: 0,
      penalty_amount: 0,
      status: 'PENDING',
    },
  ],
  down_payment: 0,
  down_payment_method: null,
  down_payment_transfer_reference: null,
  prepaid_installments: 0,
  prepaid_installments_method: null,
  prepaid_installments_transfer_reference: null,
  settled_at: null,
  settlement_amount: null,
  settlement_type: null,
  refinanced_from_credit_id: null,
};

const mockSimulateRaw = {
  type: 'LOAN',
  payment_frequency: 'MONTHLY',
  installments_count: 12,
  total_amount: 10000,
  installment_amount: 916.67,
  total_to_return: 11000,
  note: 'Los valores son orientativos.',
};

const mockSimulateSaleRaw = {
  type: 'SALE',
  payment_frequency: 'MONTHLY',
  installments_count: 3,
  total_amount: 1000,
  installment_amount: 350,
  total_to_return: 1050,
  note: '',
  items: [
    {
      product_id: 'prod-1',
      product_name: 'Prod A',
      quantity: 2,
      unit_price: 500,
      line_total: 1000,
      rate: 0.05,
      installment_contribution: 350,
    },
  ],
};

const mockSimulateSaleWithDownPaymentRaw = {
  ...mockSimulateSaleRaw,
  down_payment: 200,
  financed_amount: 800,
};

describe('CreditsService', () => {
  let service: CreditsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CreditsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CreditsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('simulate', () => {
    it('does not attach Authorization header even when token is present', () => {
      localStorage.setItem(environment.tokenKey, 'test-token');
      service
        .simulate({
          type: 'LOAN',
          totalAmount: 10000,
          installmentsCount: 12,
          paymentFrequency: 'MONTHLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.headers.has('Authorization')).toBeFalse();
      req.flush({ ok: true, data: mockSimulateRaw, message: '' });
    });

    it('sends correct snake_case body', () => {
      service
        .simulate({
          type: 'LOAN',
          totalAmount: 5000,
          installmentsCount: 6,
          paymentFrequency: 'WEEKLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.body).toEqual({
        type: 'LOAN',
        installments_count: 6,
        payment_frequency: 'WEEKLY',
        total_amount: 5000,
      });
      req.flush({ ok: true, data: mockSimulateRaw, message: '' });
    });

    it('SALE sends total_amount (unit prices sum) without products array', () => {
      service
        .simulate({
          type: 'SALE',
          totalAmount: 1000,
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.body['total_amount']).toBe(1000);
      expect(req.request.body['products']).toBeUndefined();
      req.flush({ ok: true, data: mockSimulateSaleRaw, message: '' });
    });

    it('SALE without downPayment does not send down_payment field', () => {
      service
        .simulate({
          type: 'SALE',
          totalAmount: 1000,
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.body['down_payment']).toBeUndefined();
      req.flush({ ok: true, data: mockSimulateSaleRaw, message: '' });
    });

    it('SALE with downPayment=0 does not send down_payment field', () => {
      service
        .simulate({
          type: 'SALE',
          totalAmount: 1000,
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
          downPayment: 0,
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.body['down_payment']).toBeUndefined();
      req.flush({ ok: true, data: mockSimulateSaleRaw, message: '' });
    });

    it('SALE with downPayment > 0 sends down_payment and maps response fields', () => {
      let result: any;
      service
        .simulate({
          type: 'SALE',
          totalAmount: 1000,
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
          downPayment: 200,
        })
        .subscribe((r) => (result = r));

      const req = httpMock.expectOne(`${BASE}/credits/simulate`);
      expect(req.request.body['down_payment']).toBe(200);
      req.flush({ ok: true, data: mockSimulateSaleWithDownPaymentRaw, message: '' });
      expect(result.downPayment).toBe(200);
      expect(result.financedAmount).toBe(800);
    });
  });

  describe('list', () => {
    it('calls GET /credits without params when no filters', () => {
      service.list().subscribe();
      const req = httpMock.expectOne((r) => r.url === `${BASE}/credits`);
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, data: [mockCreditRaw], message: '' });
    });

    it('passes status and type as query params', () => {
      service.list({ status: 'ACTIVE', type: 'LOAN' }).subscribe();
      const req = httpMock.expectOne(
        (r) =>
          r.url === `${BASE}/credits` &&
          r.params.get('status') === 'ACTIVE' &&
          r.params.get('type') === 'LOAN',
      );
      req.flush({ ok: true, data: [mockCreditRaw], message: '' });
    });

    it('maps snake_case to camelCase', () => {
      let result: ReturnType<
        typeof service.list
      > extends import('rxjs').Observable<infer T>
        ? T
        : never = [];
      service.list().subscribe((data) => (result = data));
      const req = httpMock.expectOne((r) => r.url === `${BASE}/credits`);
      req.flush({ ok: true, data: [mockCreditRaw], message: '' });
      expect(result[0].totalAmount).toBe(10000);
      expect(result[0].customerName).toBe('Juan Pérez');
      expect(result[0].installmentsCount).toBe(12);
    });
  });

  describe('getById', () => {
    it('maps installments and products correctly', () => {
      let detail: any;
      service.getById('credit-1').subscribe((d) => (detail = d));
      const req = httpMock.expectOne(`${BASE}/credits/credit-1`);
      req.flush({ ok: true, data: mockDetailRaw, message: '' });

      expect(detail.installments.length).toBe(1);
      expect(detail.installments[0].installmentNumber).toBe(1);
      expect(detail.installments[0].amountDue).toBe(900);

      expect(detail.products!.length).toBe(1);
      expect(detail.products![0].historicalPrice).toBe(500);
      expect(detail.products![0].productName).toBe('Prod A');
      expect(detail.customerPhone).toBe('1122334455');
      expect(detail.financedAmount).toBe(10000);
    });
  });

  describe('create', () => {
    it('sends SALE body with units array and no total_amount', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'SALE',
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
          units: [{ unitId: 'unit-1' }],
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['type']).toBe('SALE');
      expect(req.request.body['unit_ids']).toEqual(['unit-1']);
      expect(req.request.body['units']).toBeUndefined();
      expect(req.request.body['total_amount']).toBeUndefined();
      expect(req.request.body['products']).toBeUndefined();
      req.flush({
        ok: true,
        data: { id: 'new-id', status: 'PENDING_APPROVAL' },
        message: '',
      });
    });

    it('sends LOAN body with total_amount and no products', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'LOAN',
          totalAmount: 5000,
          installmentsCount: 6,
          paymentFrequency: 'WEEKLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['type']).toBe('LOAN');
      expect(req.request.body['total_amount']).toBe(5000);
      expect(req.request.body['products']).toBeUndefined();
      req.flush({
        ok: true,
        data: { id: 'new-id', status: 'PENDING_APPROVAL' },
        message: '',
      });
    });

    it('operación no-SALE no incluye unit_ids en el body', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'LOAN',
          totalAmount: 3000,
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['unit_ids']).toBeUndefined();
      expect(req.request.body['units']).toBeUndefined();
      req.flush({
        ok: true,
        data: { id: 'new-id', status: 'PENDING_APPROVAL' },
        message: '',
      });
    });

    it('SALE with downPayment includes down_payment and down_payment_method', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'SALE',
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
          units: [{ unitId: 'unit-1' }],
          downPayment: 500,
          downPaymentMethod: 'CASH',
        } as any)
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['down_payment']).toBe(500);
      expect(req.request.body['down_payment_method']).toBe('CASH');
      expect(req.request.body['prepaid_installments']).toBeUndefined();
      req.flush({ ok: true, data: { id: 'new-id', status: 'PENDING_APPROVAL' }, message: '' });
    });

    it('SALE with prepaid installments includes dedicated prepaid fields', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'SALE',
          installmentsCount: 4,
          paymentFrequency: 'MONTHLY',
          units: [{ unitId: 'unit-1' }],
          advancedInstallmentsCount: 1,
          advancedInstallmentsMethod: 'TRANSFER',
          advancedInstallmentsTransferReference: 'TRX-123',
        } as any)
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['down_payment']).toBeUndefined();
      expect(req.request.body['prepaid_installments']).toBe(1);
      expect(req.request.body['prepaid_installments_method']).toBe('TRANSFER');
      expect(req.request.body['prepaid_installments_transfer_reference']).toBe('TRX-123');
      req.flush({ ok: true, data: { id: 'new-id', status: 'PENDING_APPROVAL' }, message: '' });
    });

    it('SALE without downPayment does not send down_payment field', () => {
      service
        .create({
          customerId: 'cust-1',
          type: 'SALE',
          installmentsCount: 3,
          paymentFrequency: 'MONTHLY',
          units: [{ unitId: 'unit-1' }],
        })
        .subscribe();

      const req = httpMock.expectOne(`${BASE}/credits`);
      expect(req.request.body['down_payment']).toBeUndefined();
      expect(req.request.body['prepaid_installments']).toBeUndefined();
      req.flush({ ok: true, data: { id: 'new-id', status: 'PENDING_APPROVAL' }, message: '' });
    });
  });

  describe('approve', () => {
    it('sends PATCH with empty body when no installmentsCount', () => {
      service.approve('credit-1', {}).subscribe();
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/approve`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({});
      req.flush({ ok: true, data: mockDetailRaw, message: '' });
    });

    it('sends installments_count when provided', () => {
      service.approve('credit-1', { installmentsCount: 6 }).subscribe();
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/approve`);
      expect(req.request.body['installments_count']).toBe(6);
      req.flush({ ok: true, data: mockDetailRaw, message: '' });
    });

    it('maps response to CreditDetail', () => {
      let result: any;
      service.approve('credit-1', {}).subscribe((d) => (result = d));
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/approve`);
      req.flush({ ok: true, data: mockDetailRaw, message: '' });
      expect(result.customerPhone).toBe('1122334455');
      expect(result.installments.length).toBe(1);
    });
  });

  describe('reject', () => {
    it('sends rejectionReason as rejection_reason in body', () => {
      service.reject('credit-1', { rejectionReason: 'Mora activa' }).subscribe();
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/reject`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body['rejection_reason']).toBe('Mora activa');
      req.flush({ ok: true, data: null, message: '' });
    });
  });

  describe('earlySettlement', () => {
    it('maps settlementAmount from snake_case response', () => {
      let result: any;
      service
        .earlySettlement('credit-1', { paymentMethod: 'CASH' })
        .subscribe((r) => (result = r));
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/early-settlement`);
      expect(req.request.method).toBe('PATCH');
      req.flush({
        ok: true,
        data: {
          credit_id: 'credit-1',
          settlement_amount: 5000,
          payment_method: 'CASH',
        },
        message: '',
      });
      expect(result.creditId).toBe('credit-1');
      expect(result.settlementAmount).toBe(5000);
    });

    it('includes transfer_reference when TRANSFER method', () => {
      service
        .earlySettlement('credit-1', {
          paymentMethod: 'TRANSFER',
          transferReference: 'REF123',
        })
        .subscribe();
      const req = httpMock.expectOne(`${BASE}/credits/credit-1/early-settlement`);
      expect(req.request.body['payment_method']).toBe('TRANSFER');
      expect(req.request.body['transfer_reference']).toBe('REF123');
      req.flush({
        ok: true,
        data: { credit_id: 'credit-1', settlement_amount: 3000, payment_method: 'TRANSFER' },
        message: '',
      });
    });
  });
});
