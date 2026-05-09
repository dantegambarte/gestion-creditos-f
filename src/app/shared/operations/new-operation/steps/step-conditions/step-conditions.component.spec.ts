import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { StepConditionsComponent } from './step-conditions.component';

describe('StepConditionsComponent', () => {
  let component: StepConditionsComponent;
  let fixture: ComponentFixture<StepConditionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StepConditionsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StepConditionsComponent);
    component = fixture.componentInstance;

    const fb = TestBed.inject(FormBuilder);
    component.form = fb.group({
      operationType: ['SALE'],
      paymentFrequency: [null],
      installmentsCount: [null],
      downPayment: [null],
      firstPaymentDate: [null],
    });
    component.todayDate = new Date();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('configura el calendario para selección desde input y overlay sobre el layout', () => {
    const calendar = fixture.nativeElement.querySelector('p-calendar');

    expect(calendar.getAttribute('iconDisplay')).toBe('input');
    expect(calendar.getAttribute('styleClass')).toContain('op-calendar');
    expect(calendar.getAttribute('appendTo')).toBe('body');
  });

  describe('getInstallmentsOptionsForLine', () => {
    it('devuelve lista vacía si la línea no tiene tasas', () => {
      const result = component.getInstallmentsOptionsForLine({
        productoId: 'p1', nombre: 'Prod', cantidad: 1, precio: 1000,
        subtotal: 1000, stockDisponible: 5, unitIds: [], productIds: [],
        rates: [], selectedInstallments: null,
      });
      expect(result).toEqual([]);
    });

    it('filtra por frecuencia seleccionada en el formulario', () => {
      component.form.controls['paymentFrequency'].setValue('MONTHLY');
      const result = component.getInstallmentsOptionsForLine({
        productoId: 'p1', nombre: 'Prod', cantidad: 1, precio: 1000,
        subtotal: 1000, stockDisponible: 5, unitIds: [], productIds: [],
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
        productoId: 'p1', nombre: 'Prod', cantidad: 1, precio: 10000,
        subtotal: 10000, stockDisponible: 5, unitIds: [], productIds: [],
        rates: [], selectedInstallments: null,
      });
      expect(result).toBe(0);
    });
  });
});
