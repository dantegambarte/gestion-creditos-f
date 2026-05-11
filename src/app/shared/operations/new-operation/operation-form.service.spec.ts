import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { OperationFormService } from './operation-form.service';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { InterestRatesService } from '../../../features/admin/config/services/interest-rates.service';
import { ProductRatesService } from '../../../features/admin/config/services/product-rates.service';

describe('OperationFormService', () => {
  let service: OperationFormService;
  let creditsServiceSpy: jasmine.SpyObj<CreditsService>;

  beforeEach(() => {
    creditsServiceSpy = jasmine.createSpyObj('CreditsService', ['create']);
    creditsServiceSpy.create.and.returnValue(
      of({ id: 'credit-1', status: 'PENDING_APPROVAL' } as any),
    );

    TestBed.configureTestingModule({
      providers: [
        OperationFormService,
        MessageService,
        { provide: CreditsService, useValue: creditsServiceSpy },
        { provide: CustomersService, useValue: { list: () => of([]), getWizardSummary: () => of({ phone: null, email: null, status: 'ACTIVE', address: null, collectorName: null, activeCredits: 0, delinquency: 'sin mora', paymentCapacity: 0, createdAt: '', paidInstallments: 0, pendingInstallments: 0, overdueInstallments: 0, credits: [] }) } },
        { provide: ProductUnitsService, useValue: { getAll: () => of([]) } },
        { provide: InterestRatesService, useValue: { getAll: () => of([]) } },
        { provide: ProductRatesService, useValue: { getAll: () => of([]) } },
      ],
    });

    service = TestBed.inject(OperationFormService);
  });

  it('agrupa el catÃ¡logo por productId real aunque coincidan nombre y precio', () => {
    service.availableProducts = [
      {
        id: 'unit-1',
        productId: 'prod-1',
        name: 'Heladera',
        price: 1000,
        stock: 1,
        unitCode: 'A1',
        historicalPrice: 1000,
      },
      {
        id: 'unit-2',
        productId: 'prod-2',
        name: 'Heladera',
        price: 1000,
        stock: 1,
        unitCode: 'B1',
        historicalPrice: 1000,
      },
    ];

    const result = service.buildCatalogProducts();

    expect(result.length).toBe(2);
    expect(result.map((item) => item.productoId)).toEqual(['prod-1', 'prod-2']);
    expect(result[0].unitIds).toEqual(['unit-1']);
    expect(result[1].unitIds).toEqual(['unit-2']);
  });

  it('envÃ­a unidades seleccionadas de SALE usando ids reales del carrito', () => {
    service.selectClient({
      id: 'client-1',
      name: 'Juan Perez',
      dni: '12345678',
      phone: '',
      email: '',
      status: 'ACTIVE',
      previousCredits: 0,
      delinquency: 'sin mora',
      paymentCapacity: 0,
    });
    service.operationForm.controls.operationType.setValue('SALE');
    service.operationForm.controls.paymentFrequency.setValue('MONTHLY');
    service.operationForm.controls.firstPaymentDate.setValue(new Date(2026, 4, 10));
    service.cartLines = [
      {
        productoId: 'prod-1',
        nombre: 'Heladera',
        variantId: 'var-1',
        variantLabel: 'Variante estÃ¡ndar',
        cantidad: 1,
        precio: 1000,
        subtotal: 1000,
        stockDisponible: 1,
        unitIds: ['unit-1'],
        unitCodes: ['SN-001'],
        productIds: ['prod-1'],
        rates: [],
        selectedInstallments: 1,
      },
    ];
    service.availableProducts = [
      {
        id: 'unit-1',
        productId: 'prod-1',
        name: 'Heladera',
        price: 1000,
        stock: 1,
        unitCode: 'A1',
        historicalPrice: 1000,
      },
    ];
    service.syncSelectedProductsFromCart();

    service.submit().subscribe();

    expect(creditsServiceSpy.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        type: 'SALE',
        units: [{ unitId: 'unit-1' }],
      }),
    );
  });
});

