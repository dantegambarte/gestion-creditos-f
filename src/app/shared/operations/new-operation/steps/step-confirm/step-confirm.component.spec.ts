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

  describe('coincide con lo que se registra (#50)', () => {
    /**
     * Arma el formulario completo del paso de confirmación.
     * @param {Record<string, unknown>} values - valores a sobrescribir
     */
    function setForm(values: Record<string, unknown>): void {
      const fb = TestBed.inject(FormBuilder);
      component.form = fb.group({
        operationType: ['SALE'],
        paymentCondition: ['FINANCED'],
        paymentFrequency: ['MONTHLY'],
        firstPaymentDate: [null],
        initialPaymentType: ['NONE'],
        downPaymentMethod: [null],
        advancedInstallmentsCount: [null],
        advancedInstallmentsMethod: [null],
        ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, [v]])),
      });
    }

    const line: any = {
      productoId: 'p1',
      nombre: 'Prod',
      variantId: 'v1',
      variantLabel: 'Std',
      cantidad: 1,
      precio: 100000,
      subtotal: 100000,
      stockDisponible: 1,
      unitIds: [],
      unitCodes: [],
      productIds: [],
      selectedUnitIds: [],
      rates: [{ installmentsCount: 4, paymentFrequency: 'MONTHLY', rate: 0.2 }],
      selectedInstallments: 4,
    };

    it('la cuota por línea incluye tasa y anticipo', () => {
      setForm({ initialPaymentType: 'DOWN_PAYMENT' });
      component.cartLines = [line];
      component.validatedDownPayment = 20000;
      // (80.000 * 1.2) / 4 = 24.000
      expect(component.getCuotaPorLinea(line)).toBe(24000);
    });

    it('un anticipo MIXED se muestra como Efectivo + Transferencia', () => {
      setForm({ initialPaymentType: 'DOWN_PAYMENT', downPaymentMethod: 'MIXED' });
      component.validatedDownPayment = 20000;
      expect(component.initialPaymentSummary).toContain('Efectivo + Transferencia');
    });

    it('sin modo adelantado no corre las fechas de la simulación', () => {
      setForm({ initialPaymentType: 'DOWN_PAYMENT', advancedInstallmentsCount: 2 });
      component.cartLines = [line];
      component.simulationResult = {
        type: 'SALE',
        paymentFrequency: 'MONTHLY',
        installmentsCount: 4,
        totalAmount: 100000,
        installmentAmount: 30000,
        totalToReturn: 120000,
        note: '',
        schedule: [
          { installmentNumber: 1, dueDate: '2026-12-10', amount: 30000 },
          { installmentNumber: 2, dueDate: '2027-01-11', amount: 30000 },
          { installmentNumber: 3, dueDate: '2027-02-10', amount: 30000 },
        ],
      };
      expect(component.schedulePreview.map((r) => r.dueDate)).toEqual([
        '10/12/2026',
        '11/01/2027',
        '10/02/2027',
      ]);
    });

    it('el cronograma local respeta la frecuencia DAILY', () => {
      setForm({ paymentFrequency: 'DAILY', firstPaymentDate: new Date(2026, 11, 1) });
      component.cartLines = [{ ...line, selectedInstallments: 3 }];
      component.valorCuota = 1000;
      expect(component.schedulePreview.map((r) => r.dueDate)).toEqual([
        '01/12/2026',
        '02/12/2026',
        '03/12/2026',
      ]);
    });
  });
});
