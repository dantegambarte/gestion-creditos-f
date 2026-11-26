/// <reference types="jasmine" />
declare const expect: any;
declare const spyOn: any;
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Subject, of } from 'rxjs';

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
        {
          provide: CustomersService,
          useValue: {
            list: () => of([]),
            getWizardSummary: () =>
              of({
                phone: null,
                email: null,
                status: 'ACTIVE',
                address: null,
                collectorName: null,
                activeCredits: 0,
                delinquency: 'sin mora',
                paymentCapacity: 0,
                createdAt: '',
                paidInstallments: 0,
                pendingInstallments: 0,
                overdueInstallments: 0,
                credits: [],
              }),
          },
        },
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

    const result = service.getFirstPaymentDateFromApprovalRule(approvalDate, 'MONTHLY');

    // Mes calendario (mismo día del mes siguiente), igual que el backend.
    expect(service.toApiDate(result)).toBe('2026-02-01');
  });

  it('calcula la primera cuota diaria un día después de la aprobación (días corridos)', () => {
    const approvalDate = new Date(2026, 0, 31);

    const result = service.getFirstPaymentDateFromApprovalRule(approvalDate, 'DAILY');

    // +1 día corrido, cruzando fin de mes.
    expect(service.toApiDate(result)).toBe('2026-02-01');
  });

  describe('cambio rápido de cliente (#46)', () => {
    /**
     * Construye un cliente mínimo para los tests de selección.
     * @param {string} id - id del cliente
     */
    function buildClient(id: string): any {
      return {
        id,
        name: `Cliente ${id}`,
        dni: id,
        phone: '',
        email: '',
        status: 'ACTIVE',
        previousCredits: 0,
        delinquency: 'sin mora',
        paymentCapacity: 0,
      };
    }

    /**
     * Arma un resumen de wizard con el teléfono indicado para distinguir respuestas.
     * @param {string} phone - teléfono marcador
     */
    function buildSummary(phone: string): any {
      return {
        phone,
        email: null,
        status: 'ACTIVE',
        address: null,
        collectorName: null,
        activeCredits: 0,
        delinquency: 'sin mora',
        paymentCapacity: 0,
        createdAt: '',
        paidInstallments: 0,
        pendingInstallments: 0,
        overdueInstallments: 0,
        credits: [],
      };
    }

    it('descarta la respuesta tardía del cliente deseleccionado y envía el cliente visible', () => {
      const customers = TestBed.inject(CustomersService);
      const summaryA = new Subject<any>();
      const summaryB = new Subject<any>();
      spyOn(customers, 'getWizardSummary').and.callFake((id: string) =>
        (id === 'A' ? summaryA : summaryB).asObservable(),
      );

      service.selectClient(buildClient('A'));
      service.selectClient(buildClient('B'));
      summaryB.next(buildSummary('phone-B'));
      summaryB.complete();
      summaryA.next(buildSummary('phone-A'));
      summaryA.complete();

      expect(service.selectedClient()?.id).toBe('B');
      expect(service.selectedClient()?.phone).toBe('phone-B');
      expect(service.operationForm.controls.customerId.value).toBe('B');
      expect(service.loadingSelectedClientSummary()).toBeFalse();

      service.operationForm.controls.operationType.setValue('LOAN');
      service.submit().subscribe();

      expect(creditsServiceSpy.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ customerId: 'B' }),
      );
    });

    it('submit usa el customerId del formulario aunque selectedClient quede desfasado', () => {
      service.selectClient(buildClient('A'));
      service.operationForm.controls.customerId.setValue('B');
      service.operationForm.controls.operationType.setValue('LOAN');

      service.submit().subscribe();

      expect(creditsServiceSpy.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ customerId: 'B' }),
      );
    });
  });

  describe('reglas monetarias del plan de venta', () => {
    const line = (id: string, subtotal: number) =>
      ({
        productoId: id,
        nombre: id,
        variantId: 'v-' + id,
        variantLabel: 'Variante',
        cantidad: 1,
        precio: subtotal,
        subtotal,
        stockDisponible: 1,
        unitIds: [],
        unitCodes: [],
        productIds: [id],
        selectedUnitIds: [],
        rates: [{ installmentsCount: 4, paymentFrequency: 'MONTHLY', rate: 0.2 }],
        selectedInstallments: 4,
      }) as any;

    beforeEach(() => {
      service.initialize().subscribe();
      service.operationForm.controls.operationType.setValue('SALE');
      service.operationForm.controls.paymentFrequency.setValue('MONTHLY');
      service.cartLines.set([line('p1', 100000), line('p2', 300000)]);
    });

    it('prorratea el anticipo por el peso de cada línea en el total', () => {
      service.operationForm.controls.initialPaymentType.setValue('DOWN_PAYMENT');
      service.operationForm.controls.downPayment.setValue(40000);
      const [l1, l2] = service.cartLines();
      expect(service.getLineDownPayment(l1)).toBe(10000);
      expect(service.getLineDownPayment(l2)).toBe(30000);
    });

    it('calcula la cuota de cada línea sobre el capital neto del anticipo con su tasa', () => {
      service.operationForm.controls.initialPaymentType.setValue('DOWN_PAYMENT');
      service.operationForm.controls.downPayment.setValue(40000);
      const [l1, l2] = service.cartLines();
      // (100000 - 10000) * 1.2 / 4 = 27000 ; (300000 - 30000) * 1.2 / 4 = 81000
      expect(service.getLineInstallmentValue(l1)).toBe(27000);
      expect(service.getLineInstallmentValue(l2)).toBe(81000);
      expect(service.valorCuota).toBe(108000);
    });

    it('acota el anticipo entre 0 y el capital, y lo ignora si no es enganche', () => {
      service.operationForm.controls.initialPaymentType.setValue('DOWN_PAYMENT');
      service.operationForm.controls.downPayment.setValue(999999);
      expect(service.getValidatedDownPayment()).toBe(400000);
      service.operationForm.controls.downPayment.setValue(-500);
      expect(service.getValidatedDownPayment()).toBe(0);
      service.operationForm.controls.initialPaymentType.setValue('NONE');
      service.operationForm.controls.downPayment.setValue(1000);
      expect(service.getValidatedDownPayment()).toBe(0);
    });

    it('cobra por cuotas adelantadas el valor de cuota por la cantidad, solo en ese modo', () => {
      service.operationForm.controls.initialPaymentType.setValue('ADVANCED_INSTALLMENTS');
      service.operationForm.controls.advancedInstallmentsCount.setValue(2);
      // sin anticipo: 100000*1.2/4 = 30000 ; 300000*1.2/4 = 90000 -> cuota 120000
      expect(service.getAdvancedInstallmentsTotal()).toBe(240000);
      service.operationForm.controls.initialPaymentType.setValue('NONE');
      expect(service.getAdvancedInstallmentsTotal()).toBe(0);
    });

    it('acepta el pago mixto solo si ambas partes son positivas y suman el total exacto', () => {
      expect(service.isSplitMatchingTotal(1000.1, 2000.2, 3000.3)).toBeTrue();
      expect(service.isSplitMatchingTotal(1000, 1999, 3000)).toBeFalse();
      expect(service.isSplitMatchingTotal(0, 3000, 3000)).toBeFalse();
      expect(service.isSplitMatchingTotal(3000, null, 3000)).toBeFalse();
    });
  });
});
