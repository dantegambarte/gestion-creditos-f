import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { NewOperationComponent } from './new-operation.component';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { OperationFormService } from './operation-form.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ProductsService } from '../../../features/seller/products/products.service';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { MessageService } from 'primeng/api';
import { ProductOperation } from '../../models/interface/product';
import { ClientOperation } from '../../models/interface/client';

const mockClient: ClientOperation = {
  id: 'client-1',
  name: 'Juan Pérez',
  dni: '12345678',
  phone: '',
  email: '',
  status: 'ACTIVE',
  previousCredits: 0,
  delinquency: 'sin mora',
  paymentCapacity: 0,
};

const mockUnit: ProductOperation = {
  id: 'unit-uuid-1',
  name: 'Producto A',
  price: 1000,
  stock: 5,
};

describe('NewOperationComponent', () => {
  let component: NewOperationComponent;
  let fixture: ComponentFixture<NewOperationComponent>;
  let creditsServiceSpy: jasmine.SpyObj<CreditsService>;
  let formService: OperationFormService;

  beforeEach(async () => {
    creditsServiceSpy = jasmine.createSpyObj('CreditsService', ['create']);
    creditsServiceSpy.create.and.returnValue(
      of({ id: 'new-id', status: 'PENDING_APPROVAL' } as any),
    );

    const customersServiceStub = {
      list: () => of([]),
    };
    const productsServiceStub = {
      list: () => of([]),
    };
    const productUnitsServiceStub = {
      getAll: () => of([]),
    };

    await TestBed.configureTestingModule({
      imports: [NewOperationComponent],
      providers: [
        provideRouter([]),
        { provide: CreditsService, useValue: creditsServiceSpy },
        { provide: CustomersService, useValue: customersServiceStub },
        { provide: ProductsService, useValue: productsServiceStub },
        { provide: ProductUnitsService, useValue: productUnitsServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewOperationComponent);
    component = fixture.componentInstance;
    formService = fixture.debugElement.injector.get(OperationFormService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('finish() — SALE con unidades seleccionadas', () => {
    it('envía al builder las unidades seleccionadas, no un array vacío', () => {
      // Arrange
      formService.selectedClient.set(mockClient);
      formService.selectedType.set('SALE');
      formService.selectedProducts.set([mockUnit]);

      // Act
      component.finish();

      // Assert
      expect(creditsServiceSpy.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          type: 'SALE',
          units: [{ unitId: 'unit-uuid-1' }],
        }),
      );
      expect(component.unitsError).toBeNull();
    });
  });

  describe('finish() — SALE sin unidades seleccionadas', () => {
    it('bloquea el envío, muestra error inline y no llama al API', () => {
      // Arrange
      formService.selectedClient.set(mockClient);
      formService.selectedType.set('SALE');
      formService.selectedProducts.set([]);

      // Act
      component.finish();

      // Assert
      expect(creditsServiceSpy.create).not.toHaveBeenCalled();
      expect(component.unitsError).toBe(
        'Agregá al menos una unidad al carrito.',
      );
      expect(component.submitting).toBeFalse();
    });
  });

  describe('finish() — LOAN sin productos (CR-03)', () => {
    it('permite enviar préstamo personal sin exigir unidades/productos', () => {
      formService.selectedClient.set(mockClient);
      formService.selectedType.set('LOAN');
      formService.selectedProducts.set([]);
      formService.loanCapital.set(250000);
      formService.selectedInstallments.set(6);

      component.finish();

      expect(creditsServiceSpy.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({
          type: 'LOAN',
          totalAmount: 250000,
        }),
      );
      expect(component.unitsError).toBeNull();
    });
  });

  describe('canNext — validación fecha primer pago (CR-02)', () => {
    it('en Paso 3 bloquea avanzar cuando no hay fecha de primer pago', () => {
      component.activeIndex = 2;
      formService.firstDueDate.set(undefined);

      expect(component.canNext).toBeFalse();
    });

    it('en Paso 3 bloquea avanzar cuando la fecha es anterior a hoy', () => {
      component.activeIndex = 2;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      formService.firstDueDate.set(yesterday);

      expect(component.canNext).toBeFalse();
    });

    it('en Paso 3 permite avanzar cuando la fecha es hoy o futura', () => {
      component.activeIndex = 2;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      formService.firstDueDate.set(tomorrow);

      expect(component.canNext).toBeTrue();
    });
  });

  describe('canNext — bloqueo explícito sin fecha de primer pago (CR-05)', () => {
    it('en Paso 3 deshabilita avanzar cuando firstDueDate está vacío', () => {
      component.activeIndex = 2;
      formService.firstDueDate.set(undefined);

      expect(component.canNext).toBeFalse();
    });
  });

  describe('isConfirmed — validación de desembolso inmediato (CR-06)', () => {
    it('mantiene enviar deshabilitado si falta marcar disbursement', () => {
      formService.checks.set({
        identity: true,
        conditions: true,
        disbursement: false,
        capacity: true,
      });

      expect(component.isConfirmed).toBeFalse();
    });

    it('habilita enviar solo cuando también se marca disbursement', () => {
      formService.checks.set({
        identity: true,
        conditions: true,
        disbursement: true,
        capacity: true,
      });

      expect(component.isConfirmed).toBeTrue();
    });
  });
});
