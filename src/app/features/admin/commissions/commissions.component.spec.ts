import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { UsersService } from '../users/users.service';
import { CommissionsComponent } from './commissions.component';
import { CommissionsService } from './commissions.service';

const mockSummary = {
  employees: [
    {
      userId: 'u1',
      fullName: 'Ana García',
      role: 'SELLER',
      commissionsTotal: 5000,
      earliestWeek: '2026-04-01',
      latestWeek: '2026-04-07',
      salaryAmount: 0,
      totalNet: 5000,
    },
  ],
};

const mockLiquidation = {
  id: 'liq1',
  userId: 'u1',
  weekStart: '2026-04-01',
  weekEnd: '2026-04-07',
  commissionsTotal: 5000,
  salaryAmount: 0,
  totalPaid: 5000,
  paymentMethod: 'CASH' as const,
  transferReference: null,
  paidAt: '2026-04-08T10:00:00Z',
  paidBy: 'admin1',
  userName: 'Ana García',
  paidByName: 'Carlos Admin',
};

describe('CommissionsComponent', () => {
  let component: CommissionsComponent;
  let fixture: ComponentFixture<CommissionsComponent>;
  let commissionsSpy: jasmine.SpyObj<CommissionsService>;
  let usersSpy: jasmine.SpyObj<UsersService>;
  let headerSpy: jasmine.SpyObj<HeaderService>;
  let cashRegisterSpy: jasmine.SpyObj<CashRegisterService>;
  let formatSpy: jasmine.SpyObj<FormatService>;
  let messageService: MessageService;

  beforeEach(async () => {
    commissionsSpy = jasmine.createSpyObj('CommissionsService', [
      'getWeeklySummary',
      'getLiquidations',
      'liquidate',
      'getSalary',
      'setSalary',
    ]);
    usersSpy = jasmine.createSpyObj('UsersService', ['listCollectors']);
    headerSpy = jasmine.createSpyObj('HeaderService', ['set', 'reset']);
    cashRegisterSpy = jasmine.createSpyObj('CashRegisterService', [
      'getDashboard',
    ]);
    formatSpy = jasmine.createSpyObj('FormatService', ['currency']);

    commissionsSpy.getWeeklySummary.and.returnValue(of(mockSummary));
    commissionsSpy.getLiquidations.and.returnValue(of([]));
    usersSpy.listCollectors.and.returnValue(of([]));
    cashRegisterSpy.getDashboard.and.returnValue(
      of({
        date: '2026-06-02',
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
    formatSpy.currency.and.callFake((value: number) => `$${value}`);

    await TestBed.configureTestingModule({
      imports: [CommissionsComponent],
      providers: [
        MessageService,
        { provide: CommissionsService, useValue: commissionsSpy },
        { provide: UsersService, useValue: usersSpy },
        { provide: HeaderService, useValue: headerSpy },
        { provide: CashRegisterService, useValue: cashRegisterSpy },
        { provide: FormatService, useValue: formatSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommissionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    messageService = fixture.debugElement.injector.get(MessageService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ngOnInit loads summary and liquidations', () => {
    expect(commissionsSpy.getWeeklySummary).toHaveBeenCalled();
    expect(commissionsSpy.getLiquidations).toHaveBeenCalled();
    expect(component.vm.employees().length).toBe(1);
    expect(component.vm.employees()[0].fullName).toBe('Ana García');
  });

  it('confirmLiquidate calls liquidate and prepends result', () => {
    commissionsSpy.liquidate.and.returnValue(of(mockLiquidation));
    component.vm.selectedEmployee.set(mockSummary.employees[0]);
    component.vm.liquidatePaymentMethod.set('CASH');
    component.vm.confirmLiquidate();
    expect(commissionsSpy.liquidate).toHaveBeenCalledWith(
      jasmine.objectContaining({ userId: 'u1', paymentMethod: 'CASH' }),
    );
    expect(component.vm.liquidations()[0].id).toBe('liq1');
  });

  it('confirmLiquidate shows warn on 409', () => {
    const msgSpy = spyOn(messageService, 'add');
    commissionsSpy.liquidate.and.returnValue(
      throwError(() => ({ status: 409, message: 'Sin comisiones' })),
    );
    component.vm.selectedEmployee.set(mockSummary.employees[0]);
    component.vm.confirmLiquidate();
    expect(msgSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn' }),
    );
  });
});
