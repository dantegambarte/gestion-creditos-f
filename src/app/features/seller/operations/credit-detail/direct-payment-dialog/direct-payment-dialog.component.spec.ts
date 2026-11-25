import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CashStatusService } from '../../../../admin/cash-register/cash-status.service';
import { PaymentCreateResult } from '../../../../collector/models/payment.model';
import { PaymentsService } from '../../../../collector/payments.service';
import { DirectPaymentDialogComponent } from './direct-payment-dialog.component';

describe('DirectPaymentDialogComponent', () => {
  let cashStatusSpy: jasmine.SpyObj<CashStatusService>;
  let msg: MessageService;

  beforeEach(() => {
    cashStatusSpy = jasmine.createSpyObj('CashStatusService', ['checkAction']);
    TestBed.configureTestingModule({
      imports: [DirectPaymentDialogComponent],
      providers: [
        MessageService,
        {
          provide: PaymentsService,
          useValue: jasmine.createSpyObj('PaymentsService', ['create']),
        },
        { provide: CashStatusService, useValue: cashStatusSpy },
      ],
    }).overrideComponent(DirectPaymentDialogComponent, {
      set: { template: '' },
    });
    msg = TestBed.inject(MessageService);
  });

  /** Crea el diálogo con formulario válido y el envío real espiado. */
  function create(): {
    c: DirectPaymentDialogComponent;
    processSpy: jasmine.Spy;
  } {
    const c = TestBed.createComponent(DirectPaymentDialogComponent).componentInstance;
    Object.defineProperty(c, 'formValid', { get: () => true });
    const processSpy = spyOn(c as never, 'processPayment');
    return { c, processSpy };
  }

  it('bloquea el cobro directo y avisa si falla la consulta de caja', () => {
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(
      of({
        severity: 'error',
        summary: 'Estado de caja desconocido',
        detail: 'x',
        life: 6000,
      }),
    );
    const { c, processSpy } = create();
    c.registerMode = 'DIRECT';

    c.confirm();

    expect(processSpy).not.toHaveBeenCalled();
    expect(c.processing).toBeFalse();
    expect(addSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ summary: 'Estado de caja desconocido' }),
    );
  });

  /** Crea el diálogo real (sin espiar formValid) con una cuota de 1000. */
  function createReal(): DirectPaymentDialogComponent {
    const c = TestBed.createComponent(DirectPaymentDialogComponent).componentInstance;
    c.installment = { id: 'i1', amountDue: 1000, amountPaid: 0 } as never;
    c.ngOnChanges();
    return c;
  }

  it('MIXED sin referencia de transferencia no es válido', () => {
    const c = createReal();
    c.method = 'MIXED';
    c.amountCash = 400;
    c.amountTransfer = 600;
    c.transferRef = '   ';
    expect(c.formValid).toBeFalse();
    c.transferRef = 'OP-123';
    expect(c.formValid).toBeTrue();
  });

  it('efectivo y transferencia simples siguen sin exigir referencia', () => {
    const c = createReal();
    c.method = 'CASH';
    expect(c.formValid).toBeTrue();
    c.method = 'TRANSFER';
    expect(c.formValid).toBeTrue();
  });

  it('el reintento de una pre-carga fallida reusa el client_request_id y un cobro nuevo usa otro', () => {
    const paymentsSpy = TestBed.inject(PaymentsService) as jasmine.SpyObj<PaymentsService>;
    paymentsSpy.create.and.returnValue(throwError(() => ({ status: 0, message: 'timeout' })));
    const c = createReal();
    c.confirm();
    c.confirm();
    const [first, second] = paymentsSpy.create.calls.allArgs().map((a) => a[0].clientRequestId);
    expect(first).toBeTruthy();
    expect(second).toBe(first);

    paymentsSpy.create.and.returnValue(
      of({ installmentId: 'i1' } as unknown as PaymentCreateResult),
    );
    c.confirm();
    c.ngOnChanges();
    c.confirm();
    const third = paymentsSpy.create.calls.mostRecent().args[0].clientRequestId;
    expect(third).not.toBe(first);
  });

  it('la pre-carga no consulta caja', () => {
    const { c, processSpy } = create();
    c.registerMode = 'PRE_CARGA';
    c.confirm();
    expect(cashStatusSpy.checkAction).not.toHaveBeenCalled();
    expect(processSpy).toHaveBeenCalled();
  });
});
