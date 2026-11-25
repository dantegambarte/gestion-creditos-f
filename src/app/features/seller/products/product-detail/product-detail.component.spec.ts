import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { provideAuthTesting } from '../../../../core/auth/testing/auth-testing';
import { HeaderService } from '../../../../core/services/header.service';
import { ProductsService } from '../products.service';
import { ProductDetailComponent } from './product-detail.component';

describe('ProductDetailComponent — rango de precio (P16)', () => {
  /** Construye una variante mínima con el precio indicado. */
  const variant = (id: string, currentPrice: number) => ({
    id,
    color: null,
    size: null,
    capacity: null,
    currentPrice,
    status: 'ACTIVE',
    availableCount: 0,
    reservedCount: 0,
    soldCount: 0,
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        ...provideAuthTesting(),
        { provide: HeaderService, useValue: { set: jasmine.createSpy() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p-1' }) } },
        },
        {
          provide: ProductsService,
          useValue: {
            getById: () =>
              of({
                id: 'p-1',
                title: 'Prod',
                description: null,
                model: null,
                status: 'ACTIVE',
                createdAt: '',
                updatedAt: '',
                categoryId: null,
                categoryName: null,
                brandId: null,
                brandName: null,
                availableCount: 0,
                reservedCount: 0,
                soldCount: 0,
                variants: [variant('a', 3000), variant('b', 1000), variant('c', 2000)],
              }),
          },
        },
      ],
    }).compileComponents();
  });

  it('usa mínimo y máximo de las variantes, no primera y última', () => {
    const fixture = TestBed.createComponent(ProductDetailComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.priceRange).toEqual({ min: 1000, max: 3000 });
    const el = fixture.nativeElement.querySelector(
      '[data-cy="product-price-range"]',
    ) as HTMLElement;
    const text = el.textContent ?? '';
    expect(text.indexOf('1.000')).toBeGreaterThan(-1);
    expect(text.indexOf('1.000')).toBeLessThan(text.indexOf('3.000'));
  });
});
