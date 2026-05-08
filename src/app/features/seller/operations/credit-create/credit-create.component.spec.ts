import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { HeaderService } from '../../../../core/services/header.service';
import { CustomersService } from '../../clients/customers.service';
import { Customer } from '../../models/customer.model';
import { ProductUnit } from '../../models/product-unit.model';
import { ProductVariant } from '../../models/product-variant.model';
import { Product } from '../../models/product.model';
import { ProductUnitsService } from '../../products/product-units.service';
import { ProductVariantsService } from '../../products/product-variants.service';
import { ProductsService } from '../../products/products.service';
import { CreditsService } from '../credits.service';
import { CreditCreateComponent } from './credit-create.component';

const mockCustomer: Customer = {
  id: 'cust-1',
  fullName: 'Ana García',
  dni: '12345678',
  phone: '3811234567',
  email: 'ana@test.com',
  address: 'Siempre Viva 123',
  status: 'ACTIVE',
  portalEnabled: false,
  createdAt: '2026-01-01T00:00:00Z',
  collectorId: null,
  collectorName: null,
};

const mockProduct: Product = {
  id: 'prod-1',
  title: 'Moto X',
  description: '',
  model: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  categoryId: null,
  categoryName: null,
  brandId: null,
  brandName: null,
  availableCount: 1,
  reservedCount: 0,
  soldCount: 0,
  variants: [],
};

describe('CreditCreateComponent', () => {
  let component: CreditCreateComponent;
  let creditsServiceSpy: jasmine.SpyObj<CreditsService>;

  beforeEach(async () => {
    creditsServiceSpy = jasmine.createSpyObj('CreditsService', [
      'simulate',
      'create',
    ]);
    creditsServiceSpy.simulate.and.returnValue(
      of({
        type: 'SALE',
        paymentFrequency: 'MONTHLY',
        installmentsCount: 3,
        totalAmount: 1000,
        installmentAmount: 300,
        totalToReturn: 900,
        note: '',
        downPayment: 200,
        financedAmount: 800,
      }),
    );
    creditsServiceSpy.create.and.returnValue(
      of({ id: 'credit-1', status: 'PENDING_APPROVAL' as const }),
    );

    await TestBed.configureTestingModule({
      imports: [CreditCreateComponent],
      providers: [
        provideRouter([]),
        MessageService,
        { provide: CreditsService, useValue: creditsServiceSpy },
        {
          provide: CustomersService,
          useValue: { list: () => of([mockCustomer]) },
        },
        {
          provide: ProductsService,
          useValue: { list: () => of([mockProduct]) },
        },
        {
          provide: ProductVariantsService,
          useValue: { getAll: () => of([] as ProductVariant[]) },
        },
        {
          provide: ProductUnitsService,
          useValue: { getAll: () => of([] as ProductUnit[]) },
        },
        {
          provide: HeaderService,
          useValue: { set: jasmine.createSpy() },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreditCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * Completa el formulario base de venta para reutilizarlo entre casos.
   */
  function completeCommonSaleForm() {
    component.form.patchValue({
      type: 'SALE',
      customerId: 'cust-1',
      paymentFrequency: 'MONTHLY',
      installmentsCount: 3,
      downPayment: 200,
      downPaymentMethod: 'CASH',
    });
    component.cart = [
      {
        unitId: 'unit-1',
        unitCode: 'U-001',
        productName: 'Moto X',
        variantLabel: 'Rojo',
        price: 1000,
        variantId: 'var-1',
      },
    ];
  }

  it('simula una venta con downPayment y sin prepaid_installments', () => {
    completeCommonSaleForm();

    component.simulate();

    expect(creditsServiceSpy.simulate).toHaveBeenCalledWith({
      type: 'SALE',
      totalAmount: 1000,
      installmentsCount: 3,
      paymentFrequency: 'MONTHLY',
      downPayment: 200,
    });
  });

  it('crea una venta con downPayment y sin campos de prepaid_installments', () => {
    completeCommonSaleForm();

    component.onSubmit();

    expect(creditsServiceSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        customerId: 'cust-1',
        type: 'SALE',
        installmentsCount: 3,
        paymentFrequency: 'MONTHLY',
        downPayment: 200,
        downPaymentMethod: 'CASH',
        units: [{ unitId: 'unit-1' }],
      }),
    );
    const payload = creditsServiceSpy.create.calls.mostRecent().args[0] as unknown as Record<
      string,
      unknown
    >;
    expect(payload['prepaidInstallments']).toBeUndefined();
    expect(payload['prepaidInstallmentsMethod']).toBeUndefined();
  });

  it('bloquea venta cuando el enganche supera el total seleccionado', () => {
    completeCommonSaleForm();
    component.form.patchValue({ downPayment: 1500 });

    component.onSubmit();

    expect(creditsServiceSpy.create).not.toHaveBeenCalled();
    expect(component.unitsError).toBe(
      'El enganche no puede ser mayor al total de la venta.',
    );
  });
});
