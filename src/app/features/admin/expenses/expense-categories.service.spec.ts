import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiHttpService } from '../../../core/http/api-http.service';
import { ExpenseCategoriesService } from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;
  let apiSpy: jasmine.SpyObj<ApiHttpService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiHttpService', ['get', 'post', 'patch']);
    TestBed.configureTestingModule({
      providers: [
        ExpenseCategoriesService,
        { provide: ApiHttpService, useValue: apiSpy },
      ],
    });
    service = TestBed.inject(ExpenseCategoriesService);
  });

  it('getAll envía include_inactive=true cuando se solicita', () => {
    apiSpy.get.and.returnValue(of([]));

    service.getAll(true).subscribe(() => {});

    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect(params).toEqual({ include_inactive: 'true' });
  });

  it('getAll no envía query params cuando no se solicita incluir inactivas', () => {
    apiSpy.get.and.returnValue(of([]));

    service.getAll().subscribe(() => {});

    const [, params] = apiSpy.get.calls.mostRecent().args;
    expect(params).toBeUndefined();
  });

  it('getAll mapea active y created_at al modelo de frontend', (done) => {
    apiSpy.get.and.returnValue(
      of([
        {
          id: 'cat-1',
          name: 'Alquiler',
          active: false,
          created_at: '2026-05-05T10:00:00.000Z',
        },
      ]),
    );

    service.getAll(true).subscribe((rows) => {
      expect(rows[0].id).toBe('cat-1');
      expect(rows[0].name).toBe('Alquiler');
      expect(rows[0].active).toBeFalse();
      expect(rows[0].createdAt).toBe('2026-05-05T10:00:00.000Z');
      done();
    });
  });
});
