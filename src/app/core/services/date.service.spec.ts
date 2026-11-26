import { TestBed } from '@angular/core/testing';

import { DateService } from './date.service';

describe('DateService', () => {
  let service: DateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DateService);
    jasmine.clock().install();
    // 2026-03-15 22:30 hora local: después de las 21 en UTC-3 ya es otro día en UTC.
    jasmine.clock().mockDate(new Date(2026, 2, 15, 22, 30, 0));
  });

  afterEach(() => jasmine.clock().uninstall());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('daysOverdue', () => {
    it('cuenta días calendario desde el vencimiento hasta hoy', () => {
      expect(service.daysOverdue('2026-03-14')).toBe(1);
      expect(service.daysOverdue('2026-03-05')).toBe(10);
      expect(service.daysOverdue(new Date(2026, 1, 13, 23, 59))).toBe(30);
    });

    it('devuelve 0 si vence hoy o en el futuro', () => {
      expect(service.daysOverdue('2026-03-15')).toBe(0);
      expect(service.daysOverdue('2026-03-20')).toBe(0);
    });

    it('devuelve 0 si la fecha es inválida', () => {
      expect(service.daysOverdue('no-es-fecha')).toBe(0);
    });
  });

  it('isOverdue es verdadero solo con al menos un día de atraso', () => {
    expect(service.isOverdue('2026-03-14')).toBeTrue();
    expect(service.isOverdue('2026-03-15')).toBeFalse();
  });

  it('toLocalIso usa la fecha local, no UTC', () => {
    expect(service.toLocalIso(new Date())).toBe('2026-03-15');
    expect(service.toLocalIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('startOfToday y endOfToday delimitan el día local', () => {
    const start = service.startOfToday();
    const end = service.endOfToday();
    expect([start.getDate(), start.getHours(), start.getMinutes()]).toEqual([15, 0, 0]);
    expect([end.getDate(), end.getHours(), end.getMinutes()]).toEqual([15, 23, 59]);
  });

  it('display formatea dd/MM/yyyy y muestra guion ante valores vacíos o inválidos', () => {
    expect(service.display('2026-03-05')).toBe('05/03/2026');
    expect(service.display(null)).toBe('—');
    expect(service.display('basura')).toBe('—');
  });
});
