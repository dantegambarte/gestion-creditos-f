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
      providers: [
        ExpensesService,
        { provide: ApiHttpService, useValue: apiSpy },
      ],
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
    expect((body as Record<string, unknown>)['transfer_reference']).toBe(
      'REF123',
    );
    expect((body as Record<string, unknown>)['payment_method']).toBe(
      'TRANSFER',
    );
  });

  it('remove calls DELETE and returns void', (done) => {
    apiSpy.delete.and.returnValue(of(undefined));
    service.remove('exp-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalledWith('expenses/exp-1');
      done();
    });
  });
});
