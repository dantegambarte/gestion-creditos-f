import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { jwtInterceptor } from '../../core/interceptors/jwt.interceptor';
import { CollectionSheetDetailRaw, CollectionSheetRaw } from './models/collection.model';
import { CollectionsService } from './collections.service';

const BASE = environment.apiBaseUrl;

const mockSheetRaw: CollectionSheetRaw = {
  id: 'sheet-1',
  sheet_date: '2026-04-24',
  filter_used: 'TODAY',
  status: 'ACTIVE',
  created_at: '2026-04-24T08:00:00Z',
  sent_at: null,
  collector_id: 'coll-1',
  collector_name: 'María G.',
  total_items: 3,
};

const mockDetailRaw: CollectionSheetDetailRaw = {
  ...mockSheetRaw,
  collector_id: 'coll-1',
  generated_by_name: 'Admin User',
  items: [
    {
      order_number: 1,
      planned_amount: 1000,
      inclusion_criteria: 'DUE_DATE',
      inclusion_reason: 'OVERDUE',
      op_priority: null,
      remaining_amount: null,
      antecedent_id: null,
      antecedent_type: null,
      antecedent_date: null,
      antecedent_notes: null,
      next_visit_date: null,
      has_pending_payment: false,
      installment_id: 'inst-1',
      installment_number: 3,
      due_date: '2026-04-24',
      amount_due: 1150,
      amount_paid: 0,
      penalty_amount: 150,
      installment_status: 'OVERDUE',
      credit_id: 'credit-1',
      credit_type: 'LOAN',
      collection_reference: 'Cuota 3 de 12 · préstamo de $10.000',
      customer_name: 'Juan Pérez',
      customer_phone: '1122334455',
      customer_address: 'Av. Corrientes 1234',
      customer_dni: '12345678',
      management_status: 'PENDING',
      live: null,
    },
  ],
};

describe('CollectionsService', () => {
  let service: CollectionsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CollectionsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(CollectionsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('list', () => {
    it('calls GET /collections without params when no filters', () => {
      service.list().subscribe();
      const req = httpMock.expectOne((r) => r.url === `${BASE}/collections`);
      expect(req.request.method).toBe('GET');
      req.flush({ ok: true, data: [mockSheetRaw], message: '' });
    });

    it('maps snake_case to camelCase', () => {
      let result: any[] = [];
      service.list().subscribe((d) => (result = d));
      const req = httpMock.expectOne((r) => r.url === `${BASE}/collections`);
      req.flush({ ok: true, data: [mockSheetRaw], message: '' });
      expect(result[0].sheetDate).toBe('2026-04-24');
      expect(result[0].filterUsed).toBe('TODAY');
      expect(result[0].totalItems).toBe(3);
    });
  });

  describe('getById', () => {
    it('maps items with camelCase including plannedAmount', () => {
      let result: any;
      service.getById('sheet-1').subscribe((d) => (result = d));
      const req = httpMock.expectOne(`${BASE}/collections/sheet-1`);
      req.flush({ ok: true, data: mockDetailRaw, message: '' });

      expect(result.collectorId).toBe('coll-1');
      expect(result.generatedByName).toBe('Admin User');
      expect(result.items.length).toBe(1);
      expect(result.items[0].plannedAmount).toBe(1000);
      expect(result.items[0].amountDue).toBe(1150);
      expect(result.items[0].penaltyAmount).toBe(150);
      expect(result.items[0].installmentStatus).toBe('OVERDUE');
      expect(result.items[0].customerPhone).toBe('1122334455');
    });
  });

  describe('generate', () => {
    it('sends correct snake_case body', () => {
      service
        .generate({ collectorId: 'coll-1', date: '2026-04-24', filter: 'TODAY' })
        .subscribe();
      const req = httpMock.expectOne(`${BASE}/collections`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        collector_id: 'coll-1',
        date: '2026-04-24',
        filter: 'TODAY',
      });
      req.flush({
        ok: true,
        data: { sheet: mockDetailRaw, alerts: { overdue_next_visits: [], unassigned_customers: [] } },
        message: '',
      });
    });

    it('maps response to CollectionGenerateResult with nested sheet', () => {
      let result: any;
      service
        .generate({ collectorId: 'coll-1', date: '2026-04-24', filter: 'OVERDUE' })
        .subscribe((d) => (result = d));
      const req = httpMock.expectOne(`${BASE}/collections`);
      req.flush({
        ok: true,
        data: { sheet: mockDetailRaw, alerts: { overdue_next_visits: [], unassigned_customers: [] } },
        message: '',
      });
      expect(result.sheet.collectorId).toBe('coll-1');
      expect(result.sheet.totalItems).toBe(3);
      expect(result.sheet.items[0].plannedAmount).toBe(1000);
    });

    it('propagates 409 error', () => {
      let error: any;
      service
        .generate({ collectorId: 'coll-1', date: '2026-04-24', filter: 'TODAY' })
        .subscribe({ error: (e) => (error = e) });
      const req = httpMock.expectOne(`${BASE}/collections`);
      req.flush(
        { ok: false, message: 'No hay cuotas para cobrar en el filtro seleccionado.', data: null },
        { status: 409, statusText: 'Conflict' },
      );
      expect(error).toBeTruthy();
    });
  });
});
