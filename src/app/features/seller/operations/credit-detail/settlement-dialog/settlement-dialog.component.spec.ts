import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CashStatusService } from '../../../../admin/cash-register/cash-status.service';
import { CreditsService } from '../../credits.service';
import { SettlementDialogComponent } from './settlement-dialog.component';

describe('SettlementDialogComponent', () => {
  let cashStatusSpy: jasmine.SpyObj<CashStatusService>;
  let msg: MessageService;

  beforeEach(() => {
    cashStatusSpy = jasmine.createSpyObj('CashStatusService', ['checkAction']);
    TestBed.configureTestingModule({
      imports: [SettlementDialogComponent],
      providers: [
        MessageService,
        {
          provide: CreditsService,
          useValue: jasmine.createSpyObj('CreditsService', ['settle']),
        },
        { provide: CashStatusService, useValue: cashStatusSpy },
      ],
    }).overrideComponent(SettlementDialogComponent, { set: { template: '' } });
    msg = TestBed.inject(MessageService);
  });

  it('MIXED sin referencia de transferencia no es válido', () => {
    const c = TestBed.createComponent(SettlementDialogComponent).componentInstance;
    c.settlementTotalAmount = 1000;
    c.paymentMethod = 'MIXED';
    c.amountCash = 400;
    c.amountTransfer = 600;
    c.transferRef = '';
    expect(c.formValid).toBeFalse();
    c.transferRef = 'OP-1';
    expect(c.formValid).toBeTrue();
  });

  it('bloquea la cancelación y avisa si falla la consulta de caja', () => {
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(
      of({
        severity: 'error',
        summary: 'Estado de caja desconocido',
        detail: 'x',
        life: 6000,
      }),
    );
    const c = TestBed.createComponent(SettlementDialogComponent).componentInstance;
    c.credit = { id: 'c1' } as never;
    const processSpy = spyOn(c as never, 'processSettlement');

    c.confirm();

    expect(processSpy).not.toHaveBeenCalled();
    expect(c.processing).toBeFalse();
    expect(addSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ summary: 'Estado de caja desconocido' }),
    );
  });
});
