import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CashStatusService } from '../../../../admin/cash-register/cash-status.service';
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

  it('la pre-carga no consulta caja', () => {
    const { c, processSpy } = create();
    c.registerMode = 'PRE_CARGA';
    c.confirm();
    expect(cashStatusSpy.checkAction).not.toHaveBeenCalled();
    expect(processSpy).toHaveBeenCalled();
  });
});
