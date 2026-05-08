import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { jwtInterceptor } from '../../../core/interceptors/jwt.interceptor';
import { ProductVariantRaw } from '../models/product-variant.model';
import { ProductVariantsService } from './product-variants.service';

const BASE = environment.apiBaseUrl;

const mockVariantRaw: ProductVariantRaw = {
  id: 'var-1',
  color: 'Negro',
  size: null,
  capacity: '128GB',
  current_price: 150000,
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  product_id: 'prod-1',
  product_name: 'iPhone 15',
  title: 'iPhone 15',
  model: 'A3090',
  product_status: 'ACTIVE',
  brand_id: 'brand-1',
  brand_name: 'Apple',
  available_count: 7,
  reserved_count: 2,
  sold_count: 5,
};

describe('ProductVariantsService', () => {
  let service: ProductVariantsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductVariantsService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProductVariantsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(environment.tokenKey);
  });

  describe('getAll', () => {
    it('passes product_id filter as query param', () => {
      service.getAll({ productId: 'prod-1' }).subscribe();
      const req = httpMock.expectOne(
        (r) => r.url === `${BASE}/product-variants` && r.params.get('product_id') === 'prod-1',
      );
      req.flush({ ok: true, data: [mockVariantRaw], message: '' });
    });

    it('maps snake_case to camelCase', () => {
      let result: any;
      service.getAll().subscribe((data) => (result = data));
      const req = httpMock.expectOne((r) => r.url === `${BASE}/product-variants`);
      req.flush({ ok: true, data: [mockVariantRaw], message: '' });
      expect(result[0].currentPrice).toBe(150000);
      expect(result[0].productName).toBe('iPhone 15');
      expect(result[0].brandName).toBe('Apple');
    });
  });

  describe('create', () => {
    it('maps camelCase payload to snake_case body', () => {
      service
        .create({ productId: 'prod-1', color: 'Blanco', currentPrice: 200000 })
        .subscribe();
      const req = httpMock.expectOne(`${BASE}/product-variants`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body['product_id']).toBe('prod-1');
      expect(req.request.body['current_price']).toBe(200000);
      expect(req.request.body['color']).toBe('Blanco');
      req.flush({ ok: true, data: mockVariantRaw, message: '' });
    });
  });
});
