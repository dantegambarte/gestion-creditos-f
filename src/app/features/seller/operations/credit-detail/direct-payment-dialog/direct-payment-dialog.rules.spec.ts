import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CashStatusService } from '../../../../admin/cash-register/cash-status.service';
import { PaymentCreateResult } from '../../../../collector/models/payment.model';
import { PaymentsService } from '../../../../collector/payments.service';
import { CreditDetail } from '../../../models/credit.model';
import { DirectPaymentDialogComponent } from './direct-payment-dialog.component';

/** Reglas monetarias y de envío del cobro desde el detalle de crédito. */
describe('DirectPaymentDialogComponent — reglas de monto y envío', () => {
  let payments: jasmine.SpyObj<PaymentsService>;
  let msg: jasmine.SpyObj<MessageService>;
  let c: DirectPaymentDialogComponent;

  beforeEach(() => {
    payments = jasmine.createSpyObj('PaymentsService', ['create', 'adminDirect']);
    msg = jasmine.createSpyObj('MessageService', ['add']);
    TestBed.configureTestingModule({
      imports: [DirectPaymentDialogComponent],
      providers: [
        { provide: PaymentsService, useValue: payments },
        { provide: MessageService, useValue: msg },
        { provide: CashStatusService, useValue: { checkAction: () => of(null) } },
      ],
    }).overrideComponent(DirectPaymentDialogComponent, { set: { template: '' } });
    c = TestBed.createComponent(DirectPaymentDialogComponent).componentInstance;
    c.installment = {
      id: 'i1',
      amountDue: 10000,
      amountPaid: 4000,
    } as CreditDetail['installments'][number];
    c.ngOnChanges();
  });

  it('precarga el saldo de la cuota como monto', () => {
    expect(c.installmentBalance).toBe(6000);
    expect(c.amount).toBe(6000);
  });

  it('el tope es el saldo del crédito si se informa, o el de la cuota si no', () => {
    expect(c.maxAllowed).toBe(6000);
    c.creditPendingBalance = 20000;
    expect(c.maxAllowed).toBe(20000);
  });

  it('en mixto el monto efectivo es efectivo + transferencia', () => {
    c.method = 'MIXED';
    c.amountCash = 1500;
    c.amountTransfer = 2500;
    expect(c.effectiveAmount).toBe(4000);
  });

  it('no permite cobrar más que el tope ni cero', () => {
    c.amount = 6001;
    expect(c.formValid).toBeFalse();
    c.amount = 0;
    expect(c.formValid).toBeFalse();
    c.amount = 6000;
    expect(c.formValid).toBeTrue();
  });

  it('una pre-carga parcial exige próxima visita; el cobro directo no', () => {
    c.amount = 2000;
    expect(c.isPartial).toBeTrue();
    expect(c.formValid).toBeFalse();
    c.nextVisitDate = '2026-12-01';
    expect(c.formValid).toBeTrue();
    c.nextVisitDate = '';
    c.registerMode = 'DIRECT';
    expect(c.formValid).toBeTrue();
  });

  it('ajustar al máximo en mixto reparte enteros que suman el tope respetando la proporción', () => {
    c.method = 'MIXED';
    c.amountCash = 3000;
    c.amountTransfer = 9000;

    c.adjustToMax();

    expect(c.amountCash).toBe(1500);
    expect(c.amountTransfer).toBe(4500);
  });

  it('ajustar al máximo en un solo medio fija el tope', () => {
    c.amount = 9999;
    c.adjustToMax();
    expect(c.amount).toBe(6000);
  });

  it('la pre-carga parcial envía monto, medio y próxima visita y emite al terminar', () => {
    payments.create.and.returnValue(of({} as PaymentCreateResult));
    let paid = 0;
    c.paid.subscribe(() => paid++);
    c.amount = 2000;
    c.nextVisitDate = '2026-12-01';

    c.confirm();

    const payload = payments.create.calls.mostRecent().args[0];
    expect(payload).toEqual(
      jasmine.objectContaining({
        installmentId: 'i1',
        amountReceived: 2000,
        paymentMethod: 'CASH',
        nextVisitDate: '2026-12-01',
      }),
    );
    expect(paid).toBe(1);
  });

  it('el cobro directo mixto envía efectivo y transferencia por separado', () => {
    payments.adminDirect.and.returnValue(of({}) as never);
    c.registerMode = 'DIRECT';
    c.method = 'MIXED';
    c.amountCash = 1000;
    c.amountTransfer = 5000;
    c.transferRef = 'OP-123';

    c.confirm();

    expect(payments.adminDirect).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        amountReceived: 6000,
        amountCash: 1000,
        amountTransfer: 5000,
        transferReference: 'OP-123',
      }),
    );
    expect(payments.adminDirect.calls.mostRecent().args[0]).not.toEqual(
      jasmine.objectContaining({ paymentMethod: jasmine.anything() }),
    );
  });

  it('un 422 por saldo cambiado se explica como advertencia de concurrencia', () => {
    payments.create.and.returnValue(
      throwError(() => ({ status: 422, message: 'Supera el saldo total pendiente' })),
    );
    const paid = spyOn(c.paid, 'emit');

    c.confirm();

    const toast = msg.add.calls.mostRecent().args[0];
    expect(toast.severity).toBe('warn');
    expect(toast.detail).toContain('El saldo disponible del crédito cambió');
    expect(paid).not.toHaveBeenCalled();
    expect(c.processing).toBeFalse();
  });

  it('un crédito castigado avisa que no admite cobros', () => {
    payments.create.and.returnValue(
      throwError(() => ({ status: 409, message: 'CREDIT_WRITTEN_OFF' })),
    );

    c.confirm();

    expect(msg.add.calls.mostRecent().args[0].detail).toBe(
      'No se pueden registrar cobros: este crédito está castigado (incobrable).',
    );
  });
});
