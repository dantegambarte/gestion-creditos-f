import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CreditDetail, WriteOffResult } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';
import { WriteOffDialogComponent } from './write-off-dialog.component';

/**
 * Construye una cuota mínima para calcular el saldo castigable.
 * @param status - estado de la cuota
 * @param amountDue - monto adeudado
 * @param amountPaid - monto pagado
 */
function inst(
  status: string,
  amountDue: number,
  amountPaid: number,
): CreditDetail['installments'][number] {
  return { status, amountDue, amountPaid } as CreditDetail['installments'][number];
}

describe('WriteOffDialogComponent', () => {
  let svc: jasmine.SpyObj<CreditsService>;
  let msg: jasmine.SpyObj<MessageService>;
  let c: WriteOffDialogComponent;

  beforeEach(() => {
    svc = jasmine.createSpyObj('CreditsService', ['writeOff']);
    msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [WriteOffDialogComponent],
      providers: [
        { provide: CreditsService, useValue: svc },
        { provide: MessageService, useValue: msg },
      ],
    }).overrideComponent(WriteOffDialogComponent, { set: { template: '' } });
    c = TestBed.createComponent(WriteOffDialogComponent).componentInstance;
    c.credit = {
      id: 'cr-1',
      installments: [
        inst('PENDING', 1000, 0),
        inst('PARTIAL', 1000, 400),
        inst('OVERDUE', 2000, 0),
        inst('PAID', 1000, 1000),
        inst('WRITTEN_OFF', 5000, 0),
      ],
    } as CreditDetail;
  });

  it('el saldo castigable suma solo lo pendiente de cuotas abiertas (PENDING, PARTIAL, OVERDUE)', () => {
    expect(c.pendingBalance).toBe(3600);
  });

  it('sin crédito el saldo castigable es 0', () => {
    c.credit = null;
    expect(c.pendingBalance).toBe(0);
  });

  it('exige un motivo de al menos 5 caracteres sin contar espacios', () => {
    c.reason = '   abcd   ';
    expect(c.canConfirm).toBeFalse();
    c.reason = ' abcde ';
    expect(c.canConfirm).toBeTrue();
  });

  it('sin motivo válido no llama al backend', () => {
    c.reason = 'abc';
    c.confirm();
    expect(svc.writeOff).not.toHaveBeenCalled();
  });

  it('castiga con motivo y observaciones recortados, cierra, avisa y emite', () => {
    svc.writeOff.and.returnValue(of({ message: 'Crédito castigado' } as WriteOffResult));
    const closed: boolean[] = [];
    let emitted = 0;
    c.visibleChange.subscribe((v) => closed.push(v));
    c.writtenOff.subscribe(() => emitted++);
    c.reason = '  Cliente inubicable  ';
    c.observations = '   ';

    c.confirm();

    expect(svc.writeOff).toHaveBeenCalledOnceWith('cr-1', {
      reason: 'Cliente inubicable',
      observations: undefined,
    });
    expect(closed).toEqual([false]);
    expect(emitted).toBe(1);
    expect(msg.add).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ severity: 'success', detail: 'Crédito castigado' }),
    );
    expect(c.processing).toBeFalse();
  });

  it('no permite un doble envío mientras procesa', () => {
    c.reason = 'Cliente inubicable';
    c.processing = true;
    c.confirm();
    expect(svc.writeOff).not.toHaveBeenCalled();
  });

  it('un 409 se muestra como advertencia y no emite', () => {
    svc.writeOff.and.returnValue(throwError(() => ({ status: 409, message: 'Ya castigado' })));
    const emitted = spyOn(c.writtenOff, 'emit');
    c.reason = 'Cliente inubicable';

    c.confirm();

    expect(msg.add).toHaveBeenCalledOnceWith({
      severity: 'warn',
      summary: 'No se pudo castigar el crédito',
      detail: 'Ya castigado',
    });
    expect(emitted).not.toHaveBeenCalled();
    expect(c.processing).toBeFalse();
  });

  it('al reabrir limpia motivo, observaciones y estado de proceso', () => {
    c.reason = 'viejo motivo';
    c.observations = 'obs';
    c.processing = true;

    c.ngOnChanges({ visible: new SimpleChange(false, true, false) });

    expect(c.reason).toBe('');
    expect(c.observations).toBe('');
    expect(c.processing).toBeFalse();
  });
});
