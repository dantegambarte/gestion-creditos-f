import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CommissionsFacade,
        { provide: CommissionsService, useValue: {} },
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

  it('el total semanal de sueldos usa el sueldo de cada cobrador y 0 si no tiene', () => {
    facade.collectors.set([
      { id: 'u1', fullName: 'Ana', role: 'COLLECTOR' },
      { id: 'u2', fullName: 'Beto', role: 'COLLECTOR' },
      { id: 'u3', fullName: 'Caro', role: 'COLLECTOR' },
    ] as User[]);
    facade.employees.set([
      { userId: 'u1', salaryAmount: 15000 },
      { userId: 'u2', salaryAmount: 25000 },
    ] as WeeklySummaryEmployee[]);
    expect(facade.salaryStats()).toEqual({ collectors: 3, configured: 2, weeklyTotal: 40000 });
  });
});
