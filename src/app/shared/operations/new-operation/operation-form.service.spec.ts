/// <reference types="jasmine" />
declare const expect: any;
declare const spyOn: any;
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { OperationFormService } from './operation-form.service';
import { OperationCatalogService } from './operation-catalog.service';
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
        OperationCatalogService,
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

  it('agrupa el catálogo por productId real aunque coincidan nombre y precio', () => {
    service.catalogSvc.availableProducts = [
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

    const result = service.catalogSvc.buildCatalogProducts();

    expect(result.length).toBe(2);
    expect(result.map((item) => item.productoId)).toEqual(['prod-1', 'prod-2']);
    expect(result[0].unitIds).toEqual(['unit-1']);
    expect(result[1].unitIds).toEqual(['unit-2']);
  });

  it('envía unidades seleccionadas de SALE usando ids reales del carrito', () => {
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
    service.cartLines.set([
      {
        productoId: 'prod-1',
        nombre: 'Heladera',
        variantId: 'var-1',
        variantLabel: 'Variante estándar',
        cantidad: 1,
        precio: 1000,
        subtotal: 1000,
        stockDisponible: 1,
        unitIds: ['unit-1'],
        unitCodes: ['SN-001'],
        productIds: ['prod-1'],
        selectedUnitIds: ['unit-1'],
        rates: [],
        selectedInstallments: 1,
      },
    ]);
    service.catalogSvc.availableProducts = [
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

  it('permite avanzar en condiciones con fecha derivada cuando usa fecha de aprobación', () => {
    service.operationForm.controls.operationType.setValue('SALE');
    service.operationForm.controls.paymentFrequency.setValue('BIWEEKLY');
    service.cartLines.set([
      {
        productoId: 'prod-1',
        nombre: 'Heladera',
        variantId: 'var-1',
        variantLabel: 'Variante estándar',
        cantidad: 1,
        precio: 1000,
        subtotal: 1000,
        stockDisponible: 1,
        unitIds: ['unit-1'],
        unitCodes: ['SN-001'],
        productIds: ['prod-1'],
        selectedUnitIds: ['unit-1'],
        rates: [],
        selectedInstallments: 1,
      },
    ]);

    service.syncFirstPaymentDateWithMode();

    expect(service.operationForm.controls.firstPaymentDate.value).not.toBeNull();
    expect(service.canNext(2)).toBeTrue();
  });

  it('bloquea avanzar en condiciones con fecha personalizada si falta elegir fecha', () => {
    service.operationForm.controls.operationType.setValue('SALE');
    service.operationForm.controls.paymentFrequency.setValue('BIWEEKLY');
    service.operationForm.controls.firstPaymentDateMode.setValue('CUSTOM_DATE');
    service.operationForm.controls.firstPaymentDate.setValue(null);
    service.cartLines.set([
      {
        productoId: 'prod-1',
        nombre: 'Heladera',
        variantId: 'var-1',
        variantLabel: 'Variante estándar',
        cantidad: 1,
        precio: 1000,
        subtotal: 1000,
        stockDisponible: 1,
        unitIds: ['unit-1'],
        unitCodes: ['SN-001'],
        productIds: ['prod-1'],
        selectedUnitIds: ['unit-1'],
        rates: [],
        selectedInstallments: 1,
      },
    ]);

    expect(service.canNext(2)).toBeFalse();
  });

  it('acota las cuotas adelantadas al máximo permitido del plan — CR-29', () => {
    service.initialize().subscribe();
    service.operationForm.controls.operationType.setValue('SALE');
    service.operationForm.controls.paymentFrequency.setValue('MONTHLY');
    service.cartLines.set([
      {
        productoId: 'prod-1',
        nombre: 'Heladera',
        variantId: 'var-1',
        variantLabel: 'Variante estándar',
        cantidad: 1,
        precio: 1000,
        subtotal: 1000,
        stockDisponible: 1,
        unitIds: ['unit-1'],
        unitCodes: ['SN-001'],
        productIds: ['prod-1'],
        selectedUnitIds: ['unit-1'],
        rates: [],
        selectedInstallments: 4,
      },
    ]);

    service.operationForm.controls.advancedInstallmentsCount.setValue(99);

    expect(service.operationForm.controls.advancedInstallmentsCount.value).toBe(3);
  });

  it('limpia anticipo y cuotas adelantadas cuando se cambia a préstamo de efectivo — CR-31', () => {
    service.initialize().subscribe();
    service.operationForm.controls.operationType.setValue('SALE');
    service.operationForm.controls.initialPaymentType.setValue('DOWN_PAYMENT');
    service.operationForm.controls.downPayment.setValue(1000);
    service.operationForm.controls.downPaymentMethod.setValue('CASH');
    service.operationForm.controls.advancedInstallmentsCount.setValue(2);
    service.operationForm.controls.advancedInstallmentsMethod.setValue('CASH');

    service.operationForm.controls.operationType.setValue('LOAN');

    expect(service.operationForm.controls.initialPaymentType.value).toBe('NONE');
    expect(service.operationForm.controls.downPayment.value).toBeNull();
    expect(service.operationForm.controls.downPaymentMethod.value).toBeNull();
    expect(service.operationForm.controls.advancedInstallmentsCount.value).toBeNull();
    expect(service.operationForm.controls.advancedInstallmentsMethod.value).toBeNull();
  });

  it('calcula la primera cuota mensual por mes calendario desde aprobación — CR-25', () => {
    const approvalDate = new Date(2026, 0, 1);

    const result = service.getFirstPaymentDateFromApprovalRule(
      approvalDate,
      'MONTHLY',
    );

    // Mes calendario (mismo día del mes siguiente), igual que el backend.
    expect(service.toApiDate(result)).toBe('2026-02-01');
  });
});
