import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiHttpService } from '../../../core/http/api-http.service';
import { ExpensesService } from './expenses.service';

const mockExpenseRaw = {
  id: 'exp-1',
  amount: 1500,
  description: 'Almuerzo equipo',
  payment_method: 'CASH',
  transfer_reference: null,
  source: 'DAILY',
  created_at: '2026-04-28T12:00:00Z',
  created_by_name: 'Admin',
};

const mockPagedRaw = { rows: [mockExpenseRaw], total: 1 };

describe('ExpensesService', () => {
  let service: ExpensesService;
  let apiSpy: jasmine.SpyObj<ApiHttpService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiHttpService', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({
      providers: [ExpensesService, { provide: ApiHttpService, useValue: apiSpy }],
    });
    service = TestBed.inject(ExpensesService);
  });

  it('getAll sends page and limit params', () => {
    apiSpy.get.and.returnValue(of(mockPagedRaw));
    service.getAll({ page: 2, limit: 20 }).subscribe(() => {});
    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect((params as Record<string, string>)['page']).toBe('2');
    expect((params as Record<string, string>)['limit']).toBe('20');
  });

  it('getAllRows trae todas las páginas del período para los KPIs (#63)', (done) => {
    const row = (id: string, amount: number) => ({ ...mockExpenseRaw, id, amount });
    apiSpy.get.and.callFake(((_url: string, params: Record<string, string>) =>
      of(
        params['page'] === '1'
          ? { rows: [row('a', 100), row('b', 200)], total: 150 }
          : { rows: [row('c', 300)], total: 150 },
      )) as never);
    service.getAllRows({ dateFrom: '2026-11-01', page: 3, limit: 20 }).subscribe((rows) => {
      const calls = apiSpy.get.calls.allArgs().map((a) => a[1] as Record<string, string>);
      expect(calls.map((p) => p['page'])).toEqual(['1', '2']);
      expect(
        calls.every((p) => p['limit'] === '100' && p['date_from'] === '2026-11-01'),
      ).toBeTrue();
      expect(rows.map((r) => r.amount)).toEqual([100, 200, 300]);
      done();
    });
  });

  it('getAll defaults to page=1 limit=20 when not specified', () => {
    apiSpy.get.and.returnValue(of(mockPagedRaw));
    service.getAll().subscribe(() => {});
    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect((params as Record<string, string>)['page']).toBe('1');
    expect((params as Record<string, string>)['limit']).toBe('20');
  });

  it('getAll maps rows and total correctly', (done) => {
    apiSpy.get.and.returnValue(of(mockPagedRaw));
    service.getAll().subscribe((r) => {
      expect(r.total).toBe(1);
      expect(r.rows.length).toBe(1);
      expect(r.rows[0].paymentMethod).toBe('CASH');
      expect(r.rows[0].createdByName).toBe('Admin');
      done();
    });
  });

  it('create sends correct snake_case body', () => {
    apiSpy.post.and.returnValue(of(mockExpenseRaw));
    service
      .create({ amount: 1500, description: 'Almuerzo', paymentMethod: 'CASH' })
      .subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    const b = body as Record<string, unknown>;
    expect(b['amount']).toBe(1500);
    expect(b['description']).toBe('Almuerzo');
    expect(b['payment_method']).toBe('CASH');
    expect(b['transfer_reference']).toBeUndefined();
  });

  it('create includes transfer_reference when provided', () => {
    apiSpy.post.and.returnValue(
      of({
        ...mockExpenseRaw,
        payment_method: 'TRANSFER',
        transfer_reference: 'REF123',
      }),
    );
    service
      .create({
        amount: 500,
        description: 'Gastos banco',
        paymentMethod: 'TRANSFER',
        transferReference: 'REF123',
      })
      .subscribe(() => {});
    const [, body] = apiSpy.post.calls.mostRecent().args;
    expect((body as Record<string, unknown>)['transfer_reference']).toBe('REF123');
    expect((body as Record<string, unknown>)['payment_method']).toBe('TRANSFER');
  });

  it('remove calls DELETE and returns void', (done) => {
    apiSpy.delete.and.returnValue(of(undefined));
    service.remove('exp-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalledWith('expenses/exp-1');
      done();
    });
  });
});
