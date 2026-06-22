import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiHttpService } from '../../../core/http/api-http.service';
import { CashRegisterService } from './cash-register.service';

const mockDashboardRaw = {
  date: '2026-04-24',
  cash_amount: 30000,
  transfer_amount: 15000,
  total_collected: 45000,
  total_outflows: 5000,
  approved_count: 12,
  pending_count: 3,
  net_balance: 40000,
  pending_amount: 8000,
  down_payments_total: 2000,
  down_payments_count: 3,
};

const mockRegisterRaw = {
  id: 'cr1',
  register_date: '2026-04-23',
  total_collected: 40000,
  cash_amount: 25000,
  transfer_amount: 15000,
  declared_cash: 25000,
  difference: 0,
  difference_status: 'EXACT',
  observations: null,
  created_at: '2026-04-23T18:00:00Z',
  closed_by_name: 'Carlos Admin',
};

describe('CashRegisterService', () => {
  let service: CashRegisterService;
  let apiSpy: jasmine.SpyObj<ApiHttpService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiHttpService', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [
        CashRegisterService,
        { provide: ApiHttpService, useValue: apiSpy },
      ],
    });
    service = TestBed.inject(CashRegisterService);
  });

  it('getDashboard maps all fields including new ones', (done) => {
    apiSpy.get.and.returnValue(of(mockDashboardRaw));
    service.getDashboard().subscribe((d) => {
      expect(d.cashAmount).toBe(30000);
      expect(d.transferAmount).toBe(15000);
      expect(d.totalCollected).toBe(45000);
      expect(d.totalOutflows).toBe(5000);
      expect(d.approvedCount).toBe(12);
      expect(d.pendingCount).toBe(3);
      expect(d.netBalance).toBe(40000);
      expect(d.pendingAmount).toBe(8000);
      expect(d.downPaymentsTotal).toBe(2000);
      expect(d.downPaymentsCount).toBe(3);
      done();
    });
  });

  it('close sends declared_cash as snake_case', () => {
    apiSpy.post.and.returnValue(of(mockRegisterRaw));
    service.close({ declaredCash: 25000 }).subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['declared_cash']).toBe(25000);
  });

  it('close includes observations when provided', () => {
    apiSpy.post.and.returnValue(of(mockRegisterRaw));
    service
      .close({ declaredCash: 25000, observations: 'Sin novedad' })
      .subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['observations']).toBe(
      'Sin novedad',
    );
  });

  it('close with force=true includes force in body', () => {
    apiSpy.post.and.returnValue(of(mockRegisterRaw));
    service.close({ declaredCash: 25000, force: true }).subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['force']).toBe(true);
  });

  it('close without force does not send force field', () => {
    apiSpy.post.and.returnValue(of(mockRegisterRaw));
    service.close({ declaredCash: 25000 }).subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['force']).toBeUndefined();
  });

  it('createManualIncome sends mixed split amounts without legacy payment_method', () => {
    apiSpy.post.and.returnValue(
      of({
        id: 'income-1',
        cash_session_id: 'session-1',
        amount: 5000,
        payment_method: 'MIXED',
        description: 'Ingreso mixto test',
        receipt_reference: 'MIX-INC-001',
        created_by: 'Admin',
        created_at: '2026-04-24T10:00:00Z',
      }),
    );

    service
      .createManualIncome('session-1', {
        amount: 5000,
        amountCash: 2000,
        amountTransfer: 3000,
        description: 'Ingreso mixto test',
        receiptReference: 'MIX-INC-001',
      })
      .subscribe(() => {});

    const [path, body] = apiSpy.post.calls.mostRecent().args;
    expect(path).toBe('cash-sessions/session-1/manual-incomes');
    expect((body as Record<string, unknown>)['amount']).toBe(5000);
    expect((body as Record<string, unknown>)['amount_cash']).toBe(2000);
    expect((body as Record<string, unknown>)['amount_transfer']).toBe(3000);
    expect((body as Record<string, unknown>)['payment_method']).toBeUndefined();
    expect((body as Record<string, unknown>)['receipt_reference']).toBe(
      'MIX-INC-001',
    );
  });

  it('createManualIncomeCompany resuelve la Caja General y posta el movimiento MANUAL_INCOME', () => {
    apiSpy.get.and.returnValue(
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
    apiSpy.post.and.returnValue(of({}));

    service
      .createManualIncomeCompany({
        amount: 1200,
        description: 'Aporte de capital',
        receiptReference: 'REF-001',
      })
      .subscribe(() => {});

    const [path, body] = apiSpy.post.calls.mostRecent().args;
    expect(path).toBe('cash-accounts/acc-general/movements');
    expect((body as Record<string, unknown>)['movement_type']).toBe(
      'MANUAL_INCOME',
    );
    expect((body as Record<string, unknown>)['amount']).toBe(1200);
    expect((body as Record<string, unknown>)['description']).toBe(
      'Aporte de capital (Ref: REF-001)',
    );
  });

  it('createManualIncomeCompany envía el split efectivo/transferencia cuando se provee', () => {
    apiSpy.get.and.returnValue(
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
    apiSpy.post.and.returnValue(of({}));

    service
      .createManualIncomeCompany({
        amount: 500,
        amountCash: 300,
        amountTransfer: 200,
        description: 'Ingreso mixto',
      })
      .subscribe(() => {});

    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['amount_cash']).toBe(300);
    expect((body as Record<string, unknown>)['amount_transfer']).toBe(200);
  });

  it('createManualIncomeCompany falla si no existe Caja General activa', (done) => {
    apiSpy.get.and.returnValue(of([]));

    service
      .createManualIncomeCompany({ amount: 100, description: 'x' })
      .subscribe({
        error: (err) => {
          expect(err.status).toBe(409);
          done();
        },
      });
  });

  it('getAll maps list items to camelCase with EXACT status', (done) => {
    apiSpy.get.and.returnValue(of([mockRegisterRaw]));
    service.getAll().subscribe((items) => {
      const item = items[0];
      expect(item.totalCollected).toBe(40000);
      expect(item.declaredCash).toBe(25000);
      expect(item.differenceStatus).toBe('EXACT');
      expect(item.closedByName).toBe('Carlos Admin');
      done();
    });
  });

  it('getAll sends difference_status filter when provided', () => {
    apiSpy.get.and.returnValue(of([]));
    service.getAll({ differenceStatus: 'SHORTAGE' }).subscribe(() => {});
    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect((params as Record<string, string>)['difference_status']).toBe(
      'SHORTAGE',
    );
  });

  it('getAll does not send difference_status when not provided', () => {
    apiSpy.get.and.returnValue(of([]));
    service.getAll().subscribe(() => {});
    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect(
      (params as Record<string, string>)['difference_status'],
    ).toBeUndefined();
  });
});
