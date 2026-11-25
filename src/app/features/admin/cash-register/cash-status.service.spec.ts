import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { CashRegisterService } from './cash-register.service';
import { CashStatusService } from './cash-status.service';

describe('CashStatusService', () => {
  let service: CashStatusService;
  let cashSpy: jasmine.SpyObj<CashRegisterService>;
  let authSpy: jasmine.SpyObj<AuthServiceBase>;

  beforeEach(() => {
    cashSpy = jasmine.createSpyObj('CashRegisterService', ['getActiveSession']);
    authSpy = jasmine.createSpyObj('AuthServiceBase', ['hasRole']);
    authSpy.hasRole.and.returnValue(true);
    TestBed.configureTestingModule({
      providers: [
        CashStatusService,
        { provide: CashRegisterService, useValue: cashSpy },
        { provide: AuthServiceBase, useValue: authSpy },
      ],
    });
    service = TestBed.inject(CashStatusService);
  });

  it('returns OPEN when there is an active V4 session', (done) => {
    cashSpy.getActiveSession.and.returnValue(of({ id: 's1' } as never));
    service.resolve().subscribe((s) => {
      expect(s).toBe('OPEN');
      done();
    });
  });

  it('returns CLOSED when there is no active session', (done) => {
    cashSpy.getActiveSession.and.returnValue(of(null));
    service.resolve().subscribe((s) => {
      expect(s).toBe('CLOSED');
      done();
    });
  });

  it('fails closed with UNKNOWN when the query errors', (done) => {
    cashSpy.getActiveSession.and.returnValue(throwError(() => ({ status: 500 })));
    service.resolve().subscribe((s) => {
      expect(s).toBe('UNKNOWN');
      done();
    });
  });

  it('skips the check for non-admin users and lets the backend decide', (done) => {
    authSpy.hasRole.and.returnValue(false);
    service.resolve().subscribe((s) => {
      expect(s).toBe('OPEN');
      expect(cashSpy.getActiveSession).not.toHaveBeenCalled();
      done();
    });
  });

  it('checkAction returns null when open, closed detail when closed, unknown message on error', (done) => {
    cashSpy.getActiveSession.and.returnValue(of({ id: 's1' } as never));
    service.checkAction('cobrar', 'Cerrada').subscribe((open) => {
      expect(open).toBeNull();
      cashSpy.getActiveSession.and.returnValue(of(null));
      service.checkAction('cobrar', 'Cerrada').subscribe((closed) => {
        expect(closed?.summary).toBe('Caja Cerrada');
        expect(closed?.detail).toBe('Cerrada');
        cashSpy.getActiveSession.and.returnValue(throwError(() => new Error('x')));
        service.checkAction('cobrar', 'Cerrada').subscribe((unknown) => {
          expect(unknown?.summary).toBe('Estado de caja desconocido');
          done();
        });
      });
    });
  });

  it('builds a blocking message for an unknown cash status', () => {
    const m = service.unknownMessage('aprobar cobros');
    expect(m.severity).toBe('error');
    expect(m.detail).toContain('No se pudo verificar el estado de la caja');
    expect(m.detail).toContain('aprobar cobros');
  });
});
