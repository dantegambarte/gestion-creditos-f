import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { jwtInterceptor } from '../../../core/interceptors/jwt.interceptor';
import { ProductUnitRaw } from '../models/product-unit.model';
import { ProductUnitsService } from './product-units.service';

const BASE = environment.apiBaseUrl;

const mockUnitRaw: ProductUnitRaw = {
  id: 'unit-1',
  unit_code: '354789012345678',
  status: 'AVAILABLE',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  variant_id: 'var-1',
  color: 'Negro',
  size: null,
  capacity: '128GB',
  current_price: 150000,
  product_id: 'prod-1',
  product_name: 'iPhone 15',
};

describe('ProductUnitsService', () => {
  let service: ProductUnitsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductUnitsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductUnitsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('createBulk', () => {
    it('maps result created+units correctly', () => {
      let result: any;
      service
        .createBulk({ variantId: 'var-1', units: [{ unitCode: '111' }, { unitCode: '222' }] })
        .subscribe((r) => (result = r));
      const req = httpMock.expectOne(`${BASE}/product-units/bulk`);
      expect(req.request.body['variant_id']).toBe('var-1');
      expect(req.request.body['units']).toEqual([{ unit_code: '111' }, { unit_code: '222' }]);
      req.flush({
        ok: true,
        data: {
          created: 2,
          units: [mockUnitRaw, { ...mockUnitRaw, id: 'unit-2', unit_code: '222' }],
        },
        message: '',
      });
      expect(result.created).toBe(2);
      expect(result.units.length).toBe(2);
      expect(result.units[0].unitCode).toBe('354789012345678');
    });
  });

  describe('deactivate', () => {
    it('sends PATCH to deactivate endpoint', () => {
      service.deactivate('unit-1').subscribe();
      const req = httpMock.expectOne(`${BASE}/product-units/unit-1/deactivate`);
      expect(req.request.method).toBe('PATCH');
      req.flush({ ok: true, data: null, message: '' });
    });

    it('propagates error for SOLD unit (409)', () => {
      let errStatus: number | undefined;
      service.deactivate('unit-2').subscribe({
        error: (err) => (errStatus = err.status),
      });
      const req = httpMock.expectOne(`${BASE}/product-units/unit-2/deactivate`);
      req.flush(
        { ok: false, data: null, message: 'No se puede dar de baja una unidad ya vendida.' },
        { status: 409, statusText: 'Conflict' },
      );
      expect(errStatus).toBe(409);
    });
  });
});
