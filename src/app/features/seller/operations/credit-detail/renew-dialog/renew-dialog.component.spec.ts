import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { throwError } from 'rxjs';
import { PaymentsService } from '../../../../collector/payments.service';
import { CreditsService } from '../../credits.service';
import { RenewDialogComponent } from './renew-dialog.component';

describe('RenewDialogComponent', () => {
  let paymentsSpy: jasmine.SpyObj<PaymentsService>;

  beforeEach(() => {
    paymentsSpy = jasmine.createSpyObj('PaymentsService', ['create']);
    TestBed.configureTestingModule({
      imports: [RenewDialogComponent],
      providers: [
        MessageService,
        { provide: PaymentsService, useValue: paymentsSpy },
        { provide: CreditsService, useValue: jasmine.createSpyObj('CreditsService', ['renew']) },
      ],
    }).overrideComponent(RenewDialogComponent, { set: { template: '' } });
  });

  /** Crea el diálogo con interés de 1000 y cuota asignada. */
  function create(): RenewDialogComponent {
    const c = TestBed.createComponent(RenewDialogComponent).componentInstance;
    c.interest = 1000;
    c.installmentId = 'i1';
    return c;
  }

  it('MIXED sin referencia de transferencia no es válido', () => {
    const c = create();
    c.method = 'MIXED';
    c.amountCash = 400;
    c.amountTransfer = 600;
    c.transferRef = '';
    expect(c.formValid).toBeFalse();
    c.transferRef = 'OP-1';
    expect(c.formValid).toBeTrue();
  });

  it('el reintento de la pre-carga reusa el client_request_id', () => {
    paymentsSpy.create.and.returnValue(throwError(() => ({ status: 0 })));
    const c = create();
    c.confirm();
    c.confirm();
    const [a, b] = paymentsSpy.create.calls.allArgs().map((x) => x[0].clientRequestId);
    expect(a).toBeTruthy();
    expect(b).toBe(a);
  });
});
