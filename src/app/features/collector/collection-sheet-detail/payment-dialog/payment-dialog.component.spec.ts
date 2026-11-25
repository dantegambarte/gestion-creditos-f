import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { PaymentCreateResult } from '../../models/payment.model';
import { PaymentsService } from '../../payments.service';
import { PaymentDialogComponent } from './payment-dialog.component';

describe('PaymentDialogComponent (cobrador)', () => {
  let paymentsSpy: jasmine.SpyObj<PaymentsService>;

  beforeEach(() => {
    paymentsSpy = jasmine.createSpyObj('PaymentsService', ['create']);
    TestBed.configureTestingModule({
      imports: [PaymentDialogComponent],
      providers: [MessageService, { provide: PaymentsService, useValue: paymentsSpy }],
    }).overrideComponent(PaymentDialogComponent, { set: { template: '' } });
  });

  /** Abre el diálogo para un ítem cuyo saldo de cuota es 1000. */
  function open(c: PaymentDialogComponent): void {
    c.item = {
      installmentId: 'i1',
      installmentNumber: 1,
      amountDue: 1000,
      amountPaid: 0,
      pendingAmount: 0,
      creditPendingBalance: 1000,
    } as never;
    c.visible = true;
    c.ngOnChanges({ visible: new SimpleChange(false, true, false) });
  }

  /** Crea el diálogo y carga un cobro total en efectivo. */
  function create(): PaymentDialogComponent {
    const c = TestBed.createComponent(PaymentDialogComponent).componentInstance;
    open(c);
    spyOn(c, 'isPartialPayment').and.returnValue(false);
    spyOn(c as never, 'maxAllowed').and.returnValue(1000 as never);
    c.paymentCashAmount = 1000;
    return c;
  }

  it('MIXED sin referencia de transferencia no es válido', () => {
    const c = create();
    c.paymentMethod = 'MIXED';
    c.paymentCashAmount = 400;
    c.paymentTransferAmount = 600;
    c.transferReference = '';
    expect(c.paymentFormInvalid).toBeTrue();
    c.transferReference = 'OP-1';
    expect(c.paymentFormInvalid).toBeFalse();
  });

  it('efectivo simple no exige referencia', () => {
    const c = create();
    c.paymentMethod = 'CASH';
    expect(c.paymentFormInvalid).toBeFalse();
  });

  it('el reintento reusa el client_request_id; un cobro nuevo usa otro', () => {
    paymentsSpy.create.and.returnValue(throwError(() => ({ status: 0 })));
    const c = create();
    c.confirmPayment();
    c.confirmPayment();
    const [a, b] = paymentsSpy.create.calls.allArgs().map((x) => x[0].clientRequestId);
    expect(a).toBeTruthy();
    expect(b).toBe(a);

    paymentsSpy.create.and.returnValue(
      of({ installmentId: 'i1' } as unknown as PaymentCreateResult),
    );
    c.confirmPayment();
    open(c);
    c.paymentCashAmount = 1000;
    c.confirmPayment();
    expect(paymentsSpy.create.calls.mostRecent().args[0].clientRequestId).not.toBe(a);
  });
});
