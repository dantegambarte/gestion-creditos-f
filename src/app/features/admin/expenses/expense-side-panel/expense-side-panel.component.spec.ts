import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CashRegisterService } from '../../cash-register/cash-register.service';
import { ExpensesService } from '../expenses.service';
import { ExpenseSidePanelComponent } from './expense-side-panel.component';

describe('ExpenseSidePanelComponent', () => {
  let component: ExpenseSidePanelComponent;
  let fixture: ComponentFixture<ExpenseSidePanelComponent>;
  let cashRegisterSpy: jasmine.SpyObj<CashRegisterService>;
  let expensesSpy: jasmine.SpyObj<ExpensesService>;

  const mockSession = {
    id: 'sess-1',
    business_day_id: 'bd-1',
    owner_user_id: 'u-1',
    opened_at: '2026-06-15T00:00:00Z',
    opened_by: 'u-1',
    opening_amount: 0,
    status: 'OPEN' as const,
  };

  const mockSnapshot = {
    session_id: 'sess-1',
    status: 'OPEN' as const,
    owner_user_id: 'u-1',
    opened_at: '2026-06-15T00:00:00Z',
    opening: { cash: 0, transfer: 0 },
    collections: {
      payments: { cash: 0, transfer: 0 },
      down_payments: { cash: 0, transfer: 0 },
      manual_incomes: { cash: 0, transfer: 0 },
    },
    outflows: {
      expenses: { cash: 0, transfer: 0 },
      commissions: { cash: 0, transfer: 0 },
    },
    conversions: { cash_delta: 0, transfer_delta: 0 },
    drops: { cash: 0, transfer: 0, items: [] },
    expected: { cash: 1000, transfer: 500 },
  };

  const mockGeneralAccount = {
    id: 'acc-general',
    name: 'Caja General',
    type: 'GENERAL_CASH' as const,
    is_active: true,
    current_balance: 5000,
    created_at: '2026-06-15T00:00:00Z',
  };

  function setup(hasActiveSession: boolean): void {
    cashRegisterSpy = jasmine.createSpyObj<CashRegisterService>(
      'CashRegisterService',
      [
        'getActiveSession',
        'getSessionSnapshot',
        'getCashAccounts',
        'getDashboard',
      ],
    );
    cashRegisterSpy.getActiveSession.and.returnValue(
      of(hasActiveSession ? mockSession : null),
    );
    cashRegisterSpy.getSessionSnapshot.and.returnValue(of(mockSnapshot));
    cashRegisterSpy.getCashAccounts.and.returnValue(of([mockGeneralAccount]));
    cashRegisterSpy.getDashboard.and.returnValue(
      of({
        date: '2026-06-17',
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

    expensesSpy = jasmine.createSpyObj<ExpensesService>('ExpensesService', [
      'create',
      'update',
      'remove',
    ]);

    TestBed.configureTestingModule({
      imports: [ExpenseSidePanelComponent],
      providers: [
        { provide: CashRegisterService, useValue: cashRegisterSpy },
        { provide: ExpensesService, useValue: expensesSpy },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseSidePanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('con caja activa', () => {
    beforeEach(() => setup(true));

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('hasActiveSession queda true y createSource defaultea a DAILY', () => {
      expect(component.hasActiveSession).toBeTrue();
      expect(component.createSource).toBe('DAILY');
    });

    it('resetForm mantiene DAILY como default cuando hay caja activa', () => {
      component.createSource = 'COMPANY';
      component.resetForm();
      expect(component.createSource).toBe('DAILY');
    });
  });

  describe('sin caja activa (jornada cerrada)', () => {
    beforeEach(() => setup(false));

    it('hasActiveSession queda false y createSource fuerza a COMPANY', () => {
      expect(component.hasActiveSession).toBeFalse();
      expect(component.createSource).toBe('COMPANY');
    });

    it('resetForm defaultea a COMPANY cuando no hay caja activa', () => {
      component.createSource = 'DAILY';
      component.resetForm();
      expect(component.createSource).toBe('COMPANY');
    });

    it('submitCreate permite registrar un gasto con source COMPANY', () => {
      expensesSpy.create.and.returnValue(
        of({
          id: 'exp-1',
          amount: 750,
          description: 'Gasto a Caja General',
          paymentMethod: 'CASH',
          transferReference: null,
          categoryId: null,
          expenseDate: '2026-06-17',
          source: 'COMPANY',
          createdAt: '2026-06-17T00:00:00Z',
          createdByName: 'Admin',
        } as any),
      );

      component.createAmount = 750;
      component.createDescription = 'Gasto a Caja General';
      component.submitCreate();

      expect(expensesSpy.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ source: 'COMPANY' }),
      );
    });
  });

  describe('con activeSessionOverride provisto por el padre (ej. cash-register page)', () => {
    function setupWithOverride(): void {
      cashRegisterSpy = jasmine.createSpyObj<CashRegisterService>(
        'CashRegisterService',
        [
          'getActiveSession',
          'getSessionSnapshot',
          'getCashAccounts',
          'getDashboard',
        ],
      );
      cashRegisterSpy.getActiveSession.and.returnValue(of(null));
      cashRegisterSpy.getSessionSnapshot.and.returnValue(of(mockSnapshot));
      cashRegisterSpy.getCashAccounts.and.returnValue(of([]));
      cashRegisterSpy.getDashboard.and.returnValue(
        of({
          date: '2026-06-17',
          isClosed: false,
          cashAmount: 0,
          transferAmount: 0,
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

      expensesSpy = jasmine.createSpyObj<ExpensesService>('ExpensesService', [
        'create',
        'update',
        'remove',
      ]);

      TestBed.configureTestingModule({
        imports: [ExpenseSidePanelComponent],
        providers: [
          { provide: CashRegisterService, useValue: cashRegisterSpy },
          { provide: ExpensesService, useValue: expensesSpy },
          MessageService,
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(ExpenseSidePanelComponent);
      component = fixture.componentInstance;
      component.activeSessionOverride = mockSession;
      component.sessionSnapshotOverride = mockSnapshot;
      component.generalCashBalanceOverride = 5000;
      fixture.detectChanges();
    }

    beforeEach(() => setupWithOverride());

    it('usa el override en vez de pedir su propia sesión/snapshot/cuentas', () => {
      expect(component.hasActiveSession).toBeTrue();
      expect(component.createSource).toBe('DAILY');
      expect(component.dailyAvailable).toBe(1000);
      expect(component.generalAvailable).toBe(5000);
      expect(cashRegisterSpy.getActiveSession).not.toHaveBeenCalled();
      expect(cashRegisterSpy.getSessionSnapshot).not.toHaveBeenCalled();
      expect(cashRegisterSpy.getCashAccounts).not.toHaveBeenCalled();
    });

    it('reacciona a un cambio de activeSessionOverride a null (cierre de jornada)', () => {
      component.activeSessionOverride = null;
      component.sessionSnapshotOverride = null;
      component.ngOnChanges({
        activeSessionOverride: {} as any,
        sessionSnapshotOverride: {} as any,
      });

      expect(component.hasActiveSession).toBeFalse();
      expect(component.createSource).toBe('COMPANY');
      expect(component.dailyAvailable).toBeNull();
    });
  });
});
