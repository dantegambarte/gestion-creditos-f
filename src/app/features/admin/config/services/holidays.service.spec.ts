import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiHttpService } from '../../../../core/http/api-http.service';
import { HolidaysService } from './holidays.service';

const mockHolidayRaw = {
  id: 'holiday-1',
  date: '2026-05-01',
  name: 'Día del trabajador',
  type: 'NATIONAL' as const,
  affects_due_dates: true,
  active: true,
  repeats_annually: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

describe('HolidaysService', () => {
  let service: HolidaysService;
  let api: jasmine.SpyObj<ApiHttpService>;

  beforeEach(() => {
    api = jasmine.createSpyObj('ApiHttpService', ['get', 'post', 'put']);

    TestBed.configureTestingModule({
      providers: [HolidaysService, { provide: ApiHttpService, useValue: api }],
    });

    service = TestBed.inject(HolidaysService);
  });

  it('getAll mapea filtros camelCase a query params snake_case y normaliza la respuesta', () => {
    api.get.and.returnValue(of([mockHolidayRaw]));

    let result: any[] = [];
    service
      .getAll({ type: 'NATIONAL', active: true, affectsDueDates: false })
      .subscribe((rows) => (result = rows));

    expect(api.get).toHaveBeenCalledWith('holidays', {
      type: 'NATIONAL',
      active: 'true',
      affects_due_dates: 'false',
    });
    expect(result[0].affectsDueDates).toBe(true);
    expect(result[0].repeatsAnnually).toBe(true);
  });

  it('create serializa payload al contrato backend y devuelve resumen normalizado', () => {
    api.post.and.returnValue(
      of({
        holiday: mockHolidayRaw,
        recalculated_installments: 3,
      }),
    );

    let result: any;
    service
      .create({
        date: '2026-05-01',
        name: 'Puente',
        type: 'EXTRAORDINARY',
        affectsDueDates: true,
        active: true,
        repeatsAnnually: false,
        recalculateFutureInstallments: true,
      })
      .subscribe((value) => (result = value));

    expect(api.post).toHaveBeenCalledWith('holidays', {
      date: '2026-05-01',
      name: 'Puente',
      type: 'EXTRAORDINARY',
      affects_due_dates: true,
      active: true,
      repeats_annually: false,
      recalculateFutureInstallments: true,
    });
    expect(result.recalculatedInstallments).toBe(3);
    expect(result.holiday.createdAt).toBe('2026-01-01T00:00:00Z');
  });

  it('update omite recalculateFutureInstallments cuando no se informa', () => {
    api.put.and.returnValue(of(mockHolidayRaw));

    service
      .update('holiday-1', {
        name: 'Nuevo nombre',
        type: 'LOCAL',
        affectsDueDates: false,
        active: false,
        repeatsAnnually: true,
      })
      .subscribe();

    expect(api.put).toHaveBeenCalledWith('holidays/holiday-1', {
      name: 'Nuevo nombre',
      type: 'LOCAL',
      affects_due_dates: false,
      active: false,
      repeats_annually: true,
    });
  });

  it('previewDuplicateToNextYear preserva contadores y listas de backend', () => {
    api.post.and.returnValue(
      of({
        sourceYear: 2026,
        targetYear: 2027,
        eligibleCount: 5,
        toCreateCount: 3,
        skippedCount: 2,
        conflictsCount: 1,
        invalidDatesCount: 1,
        nonRecurringCount: 1,
        toCreate: [{ sourceDate: '2026-05-01', targetDate: '2027-05-01', type: 'NATIONAL', name: 'A' }],
        skipped: [{ sourceDate: '2026-02-29', targetDate: null, type: 'LOCAL', reason: 'invalid_target_date' }],
      }),
    );

    let result: any;
    service.previewDuplicateToNextYear({ sourceYear: 2026 }).subscribe((value) => (result = value));

    expect(api.post).toHaveBeenCalledWith('holidays/duplicate-year/preview', { sourceYear: 2026 });
    expect(result.toCreateCount).toBe(3);
    expect(result.skipped[0].reason).toBe('invalid_target_date');
  });

  it('duplicateToNextYear devuelve el resumen de duplicación normalizado', () => {
    api.post.and.returnValue(
      of({
        sourceYear: 2026,
        targetYear: 2027,
        createdCount: 2,
        skippedCount: 1,
        conflictsCount: 1,
        created: [{ sourceDate: '2026-05-01', targetDate: '2027-05-01', type: 'NATIONAL', name: 'A' }],
        skipped: [{ sourceDate: '2026-12-25', targetDate: '2027-12-25', type: 'NATIONAL', reason: 'duplicate_in_target' }],
      }),
    );

    let result: any;
    service.duplicateToNextYear({ sourceYear: 2026 }).subscribe((value) => (result = value));

    expect(api.post).toHaveBeenCalledWith('holidays/duplicate-year', { sourceYear: 2026 });
    expect(result.createdCount).toBe(2);
    expect(result.conflictsCount).toBe(1);
  });
});
