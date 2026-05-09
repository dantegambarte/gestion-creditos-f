import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { NewOperationComponent } from './new-operation.component';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { ProductUnitsService } from '../../../features/seller/products/product-units.service';
import { InterestRatesService } from '../../../features/admin/config/services/interest-rates.service';
import { ProductRatesService } from '../../../features/admin/config/services/product-rates.service';
import { OperationFormService } from './operation-form.service';
import { MessageService } from 'primeng/api';

describe('NewOperationComponent', () => {
  let component: NewOperationComponent;
  let fixture: ComponentFixture<NewOperationComponent>;
  let formService: OperationFormService;
  let creditsServiceSpy: jasmine.SpyObj<CreditsService>;

  beforeEach(async () => {
    creditsServiceSpy = jasmine.createSpyObj('CreditsService', ['create']);
    creditsServiceSpy.create.and.returnValue(of({ id: 'new-id', status: 'PENDING_APPROVAL' } as any));

    await TestBed.configureTestingModule({
      imports: [NewOperationComponent],
      providers: [
        provideRouter([]),
        { provide: CreditsService, useValue: creditsServiceSpy },
        { provide: CustomersService, useValue: { list: () => of([]) } },
        { provide: ProductUnitsService, useValue: { getAll: () => of([]) } },
        { provide: InterestRatesService, useValue: { getAll: () => of([]) } },
        { provide: ProductRatesService, useValue: { getAll: () => of([]) } },
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

  it('empieza en el paso 0', () => {
    expect(component.activeIndex).toBe(0);
  });

  it('avanza al paso siguiente con nextStep()', () => {
    component.nextStep();
    expect(component.activeIndex).toBe(1);
  });

  it('no retrocede del paso 0', () => {
    component.prevStep();
    expect(component.activeIndex).toBe(0);
  });

  it('retrocede correctamente desde el paso 1', () => {
    component.activeIndex = 1;
    component.prevStep();
    expect(component.activeIndex).toBe(0);
  });

  describe('canNext — paso 0 (cliente)', () => {
    it('bloquea avanzar sin cliente seleccionado', () => {
      expect(formService.canNext(0)).toBeFalse();
    });

    it('permite avanzar con cliente activo seleccionado', () => {
      formService.clients = [{
        id: 'c1', name: 'Test', dni: '123', phone: '', email: '',
        status: 'ACTIVE', previousCredits: 0, delinquency: '', paymentCapacity: 0,
      }];
      formService.selectClient(formService.clients[0]);
      expect(formService.canNext(0)).toBeTrue();
    });
  });

  describe('canNext — paso 1 (tipo y producto)', () => {
    it('bloquea avanzar sin tipo de operación seleccionado', () => {
      expect(formService.canNext(1)).toBeFalse();
    });

    it('permite avanzar en LOAN con monto válido', () => {
      formService.operationForm.controls.operationType.setValue('LOAN');
      formService.operationForm.controls.totalAmount.setValue(50000);
      expect(formService.canNext(1)).toBeTrue();
    });

    it('bloquea avanzar en SALE con carrito vacío', () => {
      formService.operationForm.controls.operationType.setValue('SALE');
      formService.cartLines = [];
      expect(formService.canNext(1)).toBeFalse();
    });
  });

  describe('declarationsAccepted', () => {
    it('es false cuando faltan casillas marcadas', () => {
      formService.operationForm.controls.chkIdentity.setValue(false);
      expect(formService.declarationsAccepted).toBeFalse();
    });

    it('es true cuando todas las casillas están marcadas', () => {
      formService.operationForm.controls.chkIdentity.setValue(true);
      formService.operationForm.controls.chkConditions.setValue(true);
      formService.operationForm.controls.chkDisbursement.setValue(true);
      formService.operationForm.controls.chkCapacity.setValue(true);
      expect(formService.declarationsAccepted).toBeTrue();
    });
  });
});
