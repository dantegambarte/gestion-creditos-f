import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SimpleChange } from '@angular/core';
import { AuthServiceBase } from '../../../../../core/auth/auth-service.base';
import { provideAuthTesting } from '../../../../../core/auth/testing/auth-testing';
import { StepConditionsComponent } from './step-conditions.component';

describe('StepConditionsComponent', () => {
  let component: StepConditionsComponent;
  let fixture: ComponentFixture<StepConditionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepConditionsComponent],
      providers: [provideAuthTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(StepConditionsComponent);
    component = fixture.componentInstance;

    const fb = TestBed.inject(FormBuilder);
    component.form = fb.group({
      operationType: ['SALE'],
      paymentFrequency: [null],
      installmentsCount: [null],
      firstPaymentDateMode: ['APPROVAL_DATE'],
      downPayment: [null],
      firstPaymentDate: [null],
      initialPaymentType: ['NONE'],
      downPaymentMethod: [null],
      downPaymentTransferReference: [null],
      advancedInstallmentsCount: [null],
      advancedInstallmentsMethod: [null],
      advancedInstallmentsTransferReference: [null],
    });
    component.todayDate = new Date();
    fixture.detectChanges();
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

  it('configura el calendario con appendTo body y autoZIndex para evitar clipping — CR-10', () => {
    const calendar = fixture.nativeElement.querySelector('p-calendar');

    // iconDisplay="input" fue removido: click en fechas no funcionaba con readonlyInput=true
    expect(calendar.getAttribute('iconDisplay')).toBeNull();
    expect(calendar.getAttribute('styleClass')).toContain('op-calendar');
    expect(calendar.getAttribute('appendTo')).toBe('body');
    expect(calendar.getAttribute('ng-reflect-auto-z-index')).not.toBeNull();
  });

  describe('getInstallmentsOptionsForLine', () => {
    it('devuelve lista vacía si la línea no tiene tasas', () => {
      const result = component.getInstallmentsOptionsForLine({
        productoId: 'p1', nombre: 'Prod', variantId: 'v1', variantLabel: 'Std',
        cantidad: 1, precio: 1000, subtotal: 1000, stockDisponible: 5,
        unitIds: [], unitCodes: [], productIds: [], selectedUnitIds: [], rates: [], selectedInstallments: null,
      });
      expect(result).toEqual([]);
    });

    it('filtra por frecuencia seleccionada en el formulario', () => {
      component.form.controls['paymentFrequency'].setValue('MONTHLY');
      const result = component.getInstallmentsOptionsForLine({
        productoId: 'p1', nombre: 'Prod', variantId: 'v1', variantLabel: 'Std',
        cantidad: 1, precio: 1000, subtotal: 1000, stockDisponible: 5,
        unitIds: [], unitCodes: [], productIds: [], selectedUnitIds: [],
        rates: [
          { installmentsCount: 3, paymentFrequency: 'MONTHLY', rate: 0.1, active: true } as any,
          { installmentsCount: 2, paymentFrequency: 'WEEKLY', rate: 0.08, active: true } as any,
        ],
        selectedInstallments: null,
      });
      expect(result.length).toBe(1);
      expect(result[0].value).toBe(3);
    });
  });

  describe('getLineInstallmentValue', () => {
    it('devuelve 0 si no hay cuotas seleccionadas', () => {
      const result = component.getLineInstallmentValue({
        productoId: 'p1', nombre: 'Prod', variantId: 'v1', variantLabel: 'Std',
        cantidad: 1, precio: 10000, subtotal: 10000, stockDisponible: 5,
        unitIds: [], unitCodes: [], productIds: [], selectedUnitIds: [], rates: [], selectedInstallments: null,
      });
      expect(result).toBe(0);
    });
  });

  it('muestra la frecuencia real seleccionada en el resumen del plan — CR-30', () => {
    component.form.controls['operationType'].setValue('LOAN');

    component.form.controls['paymentFrequency'].setValue('WEEKLY');
    expect(component.getInstallmentLabel()).toBe('Cuota semanal');

    component.form.controls['paymentFrequency'].setValue('BIWEEKLY');
    expect(component.getInstallmentLabel()).toBe('Cuota quincenal');

    component.form.controls['paymentFrequency'].setValue('MONTHLY');
    expect(component.getInstallmentLabel()).toBe('Cuota mensual');
  });

  it('limita el adelanto de cuotas a una menos que el plan seleccionado — CR-29', () => {
    component.form.controls['operationType'].setValue('SALE');
    component.cartLines = [
      {
        productoId: 'p1', nombre: 'Prod', variantId: 'v1', variantLabel: 'Std',
        cantidad: 1, precio: 1000, subtotal: 1000, stockDisponible: 5,
        unitIds: [], unitCodes: [], productIds: [], selectedUnitIds: [], rates: [], selectedInstallments: 4,
      },
    ];

    expect(component.getSelectedInstallmentsCount()).toBe(4);
    expect(component.getMaxAdvancedInstallments()).toBe(3);
    expect(component.canAdvanceInstallments()).toBeTrue();
  });

  it('cierra la simulación visible cuando el resultado previo queda invalidado por cambios del plan', () => {
    component.simulationVisible = true;
    component.simulationResult = { installmentsCount: 4, installmentAmount: 1000 } as any;

    component.ngOnChanges({
      simulationResult: new SimpleChange(null, component.simulationResult, true),
    });

    component.simulationResult = null;
    component.simulationLoading = false;
    component.ngOnChanges({
      simulationResult: new SimpleChange({ installmentsCount: 4, installmentAmount: 1000 } as any, null, false),
    });

    expect(component.simulationVisible).toBeFalse();
  });

});
