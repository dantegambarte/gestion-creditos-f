import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { AuthServiceBase } from '../../../../../core/auth/auth-service.base';
import { provideAuthTesting } from '../../../../../core/auth/testing/auth-testing';
import { StepConfirmComponent } from './step-confirm.component';

describe('StepConfirmComponent', () => {
  let component: StepConfirmComponent;
  let fixture: ComponentFixture<StepConfirmComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepConfirmComponent],
      providers: [provideAuthTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StepConfirmComponent);
    component = fixture.componentInstance;

    const fb = TestBed.inject(FormBuilder);
    component.form = fb.group({
      operationType: ['SALE'],
      paymentCondition: ['FINANCED'],
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('canViewFinancialData', () => {
    it('es true para roles no vendedores (ej. ADMIN)', () => {
      const auth = TestBed.inject(AuthServiceBase);
      spyOn(auth, 'hasAnyRole').and.returnValue(false);
      expect(component.canViewFinancialData).toBeTrue();
    });

    it('es false para roles de venta (SELLER / SELLER_COLLECTOR)', () => {
      const auth = TestBed.inject(AuthServiceBase);
      spyOn(auth, 'hasAnyRole').and.returnValue(true);
      expect(component.canViewFinancialData).toBeFalse();
    });
  });
});
