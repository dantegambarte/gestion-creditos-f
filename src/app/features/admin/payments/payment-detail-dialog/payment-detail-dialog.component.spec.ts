import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { PaymentsService } from '../../../collector/payments.service';
import { CashStatusService } from '../../cash-register/cash-status.service';
import { PaymentDetailDialogComponent } from './payment-detail-dialog.component';

describe('PaymentDetailDialogComponent', () => {
  let paymentsSpy: jasmine.SpyObj<PaymentsService>;
  let cashStatusSpy: jasmine.SpyObj<CashStatusService>;
  let msg: MessageService;
  const unknown = {
    severity: 'error' as const,
    summary: 'Estado de caja desconocido',
    detail: 'x',
    life: 6000,
  };

  beforeEach(() => {
    paymentsSpy = jasmine.createSpyObj('PaymentsService', ['approve', 'reject', 'getById']);
    paymentsSpy.approve.and.returnValue(of({}) as never);
    paymentsSpy.reject.and.returnValue(of({}) as never);
    cashStatusSpy = jasmine.createSpyObj('CashStatusService', ['checkAction']);
    TestBed.configureTestingModule({
      imports: [PaymentDetailDialogComponent],
      providers: [
        MessageService,
        { provide: PaymentsService, useValue: paymentsSpy },
        { provide: CashStatusService, useValue: cashStatusSpy },
      ],
    }).overrideComponent(PaymentDetailDialogComponent, {
      set: { template: '' },
    });
    msg = TestBed.inject(MessageService);
  });

  /** Crea el diálogo con un cobro seleccionado y motivo de rechazo válido. */
  function create(): PaymentDetailDialogComponent {
    const c = TestBed.createComponent(PaymentDetailDialogComponent).componentInstance;
    c.selectedPayment = { id: 'p1' } as never;
    c.rejectReason = 'motivo largo';
    return c;
  }

  it('bloquea aprobar cobro y avisa si falla la consulta de caja', () => {
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(of(unknown));
    const c = create();
    c.confirmApprove();
    expect(paymentsSpy.approve).not.toHaveBeenCalled();
    expect(c.processingApprove).toBeFalse();
    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({ summary: unknown.summary }));
  });

  it('bloquea rechazar cobro si falla la consulta de caja', () => {
    cashStatusSpy.checkAction.and.returnValue(of(unknown));
    const c = create();
    c.confirmReject();
    expect(paymentsSpy.reject).not.toHaveBeenCalled();
    expect(c.processingReject).toBeFalse();
  });

  it('aprueba con caja abierta', () => {
    cashStatusSpy.checkAction.and.returnValue(of(null));
    create().confirmApprove();
    expect(paymentsSpy.approve).toHaveBeenCalled();
  });
});
