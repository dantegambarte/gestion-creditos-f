import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { CashRegisterComponent } from './cash-register.component';
import { CashRegisterService } from './cash-register.service';
import { ExpenseCategoriesService } from '../expenses/expense-categories.service';

describe('CashRegisterComponent', () => {
  let component: CashRegisterComponent;
  let fixture: ComponentFixture<CashRegisterComponent>;
  let cashRegisterServiceSpy: jasmine.SpyObj<CashRegisterService>;

  beforeEach(async () => {
    cashRegisterServiceSpy = jasmine.createSpyObj<CashRegisterService>(
      'CashRegisterService',
      [
        'getDashboard',
        'refreshJornadaState',
        'getCashAccounts',
        'createConversion',
        'getSessionMovements',
        'getActiveSession',
      ],
    );
    cashRegisterServiceSpy.getActiveSession.and.returnValue(of(null));
    cashRegisterServiceSpy.getDashboard.and.returnValue(
      of({
        date: '2026-06-15',
        isClosed: false,
        cashAmount: 1000,
        transferAmount: 500,
        totalCollected: 0,
        totalOutflows: 0,
        approvedCount: 0,
        pendingCount: 0,
        netBalance: 0,
        pendingAmount: 0,
        downPaymentsTotal: 0,
        downPaymentsCount: 0,
      }),
    );
    cashRegisterServiceSpy.refreshJornadaState.and.returnValue(
      of({ businessDay: null, activeSession: null }),
    );
    cashRegisterServiceSpy.getCashAccounts.and.returnValue(
      of([
        {
          id: 'acc-general',
          name: 'Caja General',
          type: 'GENERAL_CASH',
          is_active: true,
          current_balance: 5000,
          created_at: '2026-06-15T00:00:00Z',
        },
      ]),
    );

    const expenseCategoriesSpy = jasmine.createSpyObj<ExpenseCategoriesService>(
      'ExpenseCategoriesService',
      ['getAll'],
    );
    expenseCategoriesSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [CashRegisterComponent],
      providers: [
        provideHttpClient(),
        { provide: CashRegisterService, useValue: cashRegisterServiceSpy },
        { provide: ExpenseCategoriesService, useValue: expenseCategoriesSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CashRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('conversión: selector de Origen (DAILY/COMPANY)', () => {
    it('openConversionDialog resetea criteria a DAILY y carga el saldo de Caja General', () => {
      component.openConversionDialog();

      expect(component.conversionCriteria()).toBe('DAILY');
      expect(component.generalCashBalance()).toBe(5000);
    });

    it('conversionSourceAvailable usa el disponible de la caja activa cuando criteria es DAILY', () => {
      component.openConversionDialog();
      component.conversionSourceMethod.set('CASH');

      expect(component.conversionSourceAvailable()).toBe(1000);
    });

    it('conversionSourceAvailable usa el saldo de Caja General cuando criteria es COMPANY', () => {
      component.openConversionDialog();
      component.conversionCriteria.set('COMPANY');

      expect(component.conversionSourceAvailable()).toBe(5000);
    });

    it('conversionExceedsAvailable es true cuando el monto supera el disponible', () => {
      component.openConversionDialog();
      component.conversionSourceMethod.set('CASH');
      component.conversionAmount.set(1500);

      expect(component.conversionExceedsAvailable()).toBe(true);
    });

    it('conversionExceedsAvailable es false cuando el monto está dentro del disponible', () => {
      component.openConversionDialog();
      component.conversionSourceMethod.set('CASH');
      component.conversionAmount.set(500);

      expect(component.conversionExceedsAvailable()).toBe(false);
    });

    it('submitConversion envía el criteria seleccionado en el payload', () => {
      cashRegisterServiceSpy.createConversion.and.returnValue(
        of({
          id: 'conv-001',
          registerDate: '2026-06-15',
          criteria: 'COMPANY',
          sourceMethod: 'CASH',
          targetMethod: 'TRANSFER',
          amount: 100,
          notes: null,
          createdBy: 'admin-001',
          createdAt: '2026-06-15T00:00:00Z',
        }),
      );

      component.openConversionDialog();
      component.conversionCriteria.set('COMPANY');
      component.conversionAmount.set(100);

      component.submitConversion();

      expect(cashRegisterServiceSpy.createConversion).toHaveBeenCalledWith(
        jasmine.objectContaining({ criteria: 'COMPANY' }),
      );
    });
  });
});
