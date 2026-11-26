import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';

import { FormatService } from '../../../core/services/format.service';
import { HeaderService } from '../../../core/services/header.service';
import { CashStatusService } from '../cash-register/cash-status.service';
import { Liquidation, WeeklySummaryEmployee } from '../models/commission.model';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { CommissionsFacade } from './commissions.facade';
import { CommissionsService } from './commissions.service';

describe('CommissionsFacade — totales de liquidaciones y sueldos', () => {
  let facade: CommissionsFacade;

  const liq = (
    id: string,
    userId: string,
    paymentMethod: 'CASH' | 'TRANSFER',
    commissionsTotal: number,
    salaryAmount: number,
  ) =>
    ({
      id,
      userId,
      userName: 'Empleado ' + userId,
      paymentMethod,
      commissionsTotal,
      salaryAmount,
      totalPaid: commissionsTotal + salaryAmount,
    }) as Liquidation;

  let salarySvc: jasmine.SpyObj<CommissionsService>;

  beforeEach(() => {
    salarySvc = jasmine.createSpyObj<CommissionsService>('CommissionsService', ['getSalary']);
    TestBed.configureTestingModule({
      providers: [
        CommissionsFacade,
        { provide: CommissionsService, useValue: salarySvc },
        { provide: UsersService, useValue: {} },
        { provide: CashStatusService, useValue: {} },
        { provide: HeaderService, useValue: {} },
        { provide: MessageService, useValue: { add: () => undefined } },
        { provide: FormatService, useValue: {} },
      ],
    });
    facade = TestBed.inject(CommissionsFacade);
    facade.liquidations.set([
      liq('1', 'u1', 'CASH', 5000, 10000),
      liq('2', 'u1', 'TRANSFER', 3000, 0),
      liq('3', 'u2', 'CASH', 7000, 20000),
    ]);
  });

  it('suma comisiones, sueldos y total pagado de todas las liquidaciones', () => {
    expect(facade.historyStats()).toEqual({
      totalCommissions: 15000,
      totalSalary: 30000,
      totalPaid: 45000,
      count: 3,
    });
  });

  it('los totales respetan los filtros por empleado y por método de pago', () => {
    facade.historyEmployeeFilter.set('u1');
    expect(facade.historyStats().totalPaid).toBe(18000);
    facade.historyMethodFilter.set('CASH');
    expect(facade.historyStats()).toEqual({
      totalCommissions: 5000,
      totalSalary: 10000,
      totalPaid: 15000,
      count: 1,
    });
  });

  it('el total semanal de sueldos usa el sueldo configurado de cada cobrador y 0 si no tiene', () => {
    facade.collectors.set([
      { id: 'u1', fullName: 'Ana', role: 'COLLECTOR' },
      { id: 'u2', fullName: 'Beto', role: 'COLLECTOR' },
      { id: 'u3', fullName: 'Caro', role: 'COLLECTOR' },
    ] as User[]);
    facade.configuredSalaries.set(
      new Map([
        ['u1', 15000],
        ['u2', 25000],
      ]),
    );
    expect(facade.salaryStats()).toEqual({ collectors: 3, configured: 2, weeklyTotal: 40000 });
  });

  it('el sueldo sale del endpoint de sueldos y no del resumen semanal (#60)', () => {
    salarySvc.getSalary.and.callFake((userId: string) =>
      userId === 'u1'
        ? of({ userId: 'u1', weeklyAmount: 12000, active: true })
        : throwError(() => ({ status: 404 })),
    );
    facade.collectors.set([
      { id: 'u1', fullName: 'Ana', role: 'COLLECTOR' },
      { id: 'u2', fullName: 'Beto', role: 'COLLECTOR' },
    ] as User[]);
    // El resumen liquida montos del período; no debe usarse como sueldo configurado.
    facade.employees.set([
      { userId: 'u1', salaryAmount: 99999 },
      { userId: 'u2', salaryAmount: 5000 },
    ] as WeeklySummaryEmployee[]);
    facade.loadConfiguredSalaries();
    expect(facade.salaryRows().map((r) => r.weeklyAmount)).toEqual([12000, 0]);
  });
});
