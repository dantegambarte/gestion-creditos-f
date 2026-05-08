import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { StepConditionsComponent } from './step-conditions.component';
import { OperationFormService } from '../../operation-form.service';

describe('StepConditionsComponent', () => {
  const firstDueDate = signal<Date | undefined>(undefined);
  const todayStart = new Date(2026, 4, 5);

  const formMock = {
    firstDueDate,
    selectedType: signal<'SALE' | 'LOAN'>('SALE'),
    getTodayStart: () => todayStart,
    normalizeToLocalDayStart: (date: Date) =>
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
    isFirstDueDateValid: () => {
      const due = firstDueDate();
      if (!due) return false;
      const normalized = new Date(
        due.getFullYear(),
        due.getMonth(),
        due.getDate(),
      );
      return normalized >= todayStart;
    },
  };

  let component: StepConditionsComponent;

  beforeEach(async () => {
    firstDueDate.set(undefined);

    await TestBed.configureTestingModule({
      imports: [StepConditionsComponent],
      providers: [{ provide: OperationFormService, useValue: formMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(StepConditionsComponent);
    component = fixture.componentInstance;
  });

  it('mantiene estable la fecha mínima para no romper selección con mouse', () => {
    const minDateRef = component.minFirstDueDate;

    component.onFirstDueDateChange(new Date(2026, 4, 10));

    expect(component.minFirstDueDate).toBe(minDateRef);
  });

  it('limpia la fecha cuando se intenta ingresar un día anterior a hoy', () => {
    component.onFirstDueDateChange(new Date(2026, 4, 4));

    expect(firstDueDate()).toBeUndefined();
  });

  it('acepta hoy como fecha válida', () => {
    component.onFirstDueDateChange(new Date(2026, 4, 5));

    expect(firstDueDate()).toEqual(new Date(2026, 4, 5));
  });

  it('bloquea fechas pasadas ingresadas por tipeo manual', () => {
    component.onFirstDueDateChange('04/05/2026');

    expect(firstDueDate()).toBeUndefined();
  });

  it('acepta hoy cuando se ingresa por tipeo manual', () => {
    component.onFirstDueDateChange('05/05/2026');

    expect(firstDueDate()).toEqual(new Date(2026, 4, 5));
  });
});
