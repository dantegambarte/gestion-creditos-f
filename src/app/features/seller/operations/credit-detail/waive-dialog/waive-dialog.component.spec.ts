import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Subject, of, throwError } from 'rxjs';
import { CreditDetail } from '../../../models/credit.model';
import { Installment } from '../../../models/installment.model';
import { InstallmentsService } from '../../installments.service';
import { WaiveDialogComponent } from './waive-dialog.component';

describe('WaiveDialogComponent', () => {
  let svc: jasmine.SpyObj<InstallmentsService>;
  let msg: jasmine.SpyObj<MessageService>;
  let c: WaiveDialogComponent;

  beforeEach(() => {
    svc = jasmine.createSpyObj('InstallmentsService', ['waivePenalty']);
    msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [WaiveDialogComponent],
      providers: [
        { provide: InstallmentsService, useValue: svc },
        { provide: MessageService, useValue: msg },
      ],
    }).overrideComponent(WaiveDialogComponent, { set: { template: '' } });
    c = TestBed.createComponent(WaiveDialogComponent).componentInstance;
    c.installment = { id: 'inst-7' } as CreditDetail['installments'][number];
  });

  it('condona la mora de la cuota, cierra, avisa y emite la cuota actualizada', () => {
    const updated = { id: 'inst-7', penaltyAmount: 0 } as Partial<Installment>;
    svc.waivePenalty.and.returnValue(of(updated));
    const visible: boolean[] = [];
    const waived: Partial<Installment>[] = [];
    c.visibleChange.subscribe((v) => visible.push(v));
    c.waived.subscribe((u) => waived.push(u));

    c.confirm();

    expect(svc.waivePenalty).toHaveBeenCalledOnceWith('inst-7');
    expect(visible).toEqual([false]);
    expect(waived).toEqual([updated]);
    expect(msg.add).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ severity: 'success', summary: 'Mora condonada' }),
    );
    expect(c.processing).toBeFalse();
  });

  it('queda en proceso mientras espera la respuesta', () => {
    svc.waivePenalty.and.returnValue(new Subject<Partial<Installment>>());
    c.confirm();
    expect(c.processing).toBeTrue();
  });

  it('sin cuota no llama al backend', () => {
    c.installment = null;
    c.confirm();
    expect(svc.waivePenalty).not.toHaveBeenCalled();
  });

  it('un conflicto 409 se muestra como advertencia, no cierra ni emite', () => {
    svc.waivePenalty.and.returnValue(
      throwError(() => ({ status: 409, message: 'Sin mora para condonar' })),
    );
    const emitted = spyOn(c.waived, 'emit');
    const closed = spyOn(c.visibleChange, 'emit');

    c.confirm();

    expect(msg.add).toHaveBeenCalledOnceWith({
      severity: 'warn',
      summary: 'Advertencia',
      detail: 'Sin mora para condonar',
    });
    expect(emitted).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(c.processing).toBeFalse();
  });

  it('otro error se muestra como error con mensaje de respaldo', () => {
    svc.waivePenalty.and.returnValue(throwError(() => ({ status: 500 })));

    c.confirm();

    expect(msg.add).toHaveBeenCalledOnceWith({
      severity: 'error',
      summary: 'Error',
      detail: 'No se pudo condonar mora.',
    });
  });
});
