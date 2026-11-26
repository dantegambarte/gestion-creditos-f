import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CreditDetail, PlanChangeResult, PlanChangeSimulation } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';
import { PlanChangeDialogComponent } from './plan-change-dialog.component';

const baseSim: PlanChangeSimulation = {
  currentPlan: { installments: 6, rate: 40 },
  newPlan: { installments: 3, rate: 20 },
  totalPaid: 12000,
  newCreditTotal: 12000,
  newBalance: 0,
  survivingInstallmentId: 'i3',
  cancelledInstallments: [4, 5, 6],
  creditWillBeSettled: false,
  excessAmount: 0,
  requiresExcessDisposition: false,
};

const excessSim: PlanChangeSimulation = {
  ...baseSim,
  survivingInstallmentId: null,
  creditWillBeSettled: true,
  excessAmount: 1500,
  requiresExcessDisposition: true,
};

describe('PlanChangeDialogComponent (excedente #95)', () => {
  let service: jasmine.SpyObj<CreditsService>;
  let msg: MessageService;

  /** Crea el componente y lo abre con la simulación indicada. */
  function open(sim: PlanChangeSimulation): PlanChangeDialogComponent {
    service.simulatePlanChange.and.returnValue(of(sim));
    const fixture = TestBed.createComponent(PlanChangeDialogComponent);
    const c = fixture.componentInstance;
    c.credit = { id: 'credit-1' } as CreditDetail;
    c.visible = true;
    c.ngOnChanges({ visible: new SimpleChange(false, true, true) });
    return c;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<CreditsService>('CreditsService', [
      'simulatePlanChange',
      'changePlan',
    ]);
    TestBed.configureTestingModule({
      imports: [PlanChangeDialogComponent],
      providers: [
        provideNoopAnimations(),
        MessageService,
        { provide: CreditsService, useValue: service },
      ],
    });
    msg = TestBed.inject(MessageService);
  });

  it('sin excedente puede confirmar y no envía excess_disposition', () => {
    const c = open(baseSim);
    service.changePlan.and.returnValue(of({ message: 'ok' } as unknown as PlanChangeResult));
    expect(c.canConfirm).toBeTrue();
    c.confirm();
    expect(service.changePlan).toHaveBeenCalledWith('credit-1', {
      reason: undefined,
    });
  });

  it('con excedente no puede confirmar sin elegir destino', () => {
    const c = open(excessSim);
    expect(c.canConfirm).toBeFalse();
    c.confirm();
    expect(service.changePlan).not.toHaveBeenCalled();
  });

  it('con excedente envía el destino elegido', () => {
    const c = open(excessSim);
    service.changePlan.and.returnValue(of({ message: 'ok' } as unknown as PlanChangeResult));
    c.excessDisposition = 'CREDIT_BALANCE';
    expect(c.canConfirm).toBeTrue();
    c.confirm();
    expect(service.changePlan).toHaveBeenCalledWith('credit-1', {
      reason: undefined,
      excess_disposition: 'CREDIT_BALANCE',
    });
  });

  it('muestra un mensaje claro ante 422 EXCESS_DISPOSITION_REQUIRED', () => {
    const c = open(excessSim);
    const add = spyOn(msg, 'add');
    service.changePlan.and.returnValue(
      throwError(() => ({
        status: 422,
        code: 'EXCESS_DISPOSITION_REQUIRED',
        message: 'Indicá excess_disposition: CREDIT_BALANCE o REFUND',
      })),
    );
    c.excessDisposition = 'REFUND';
    c.confirm();
    const detail = add.calls.mostRecent().args[0].detail as string;
    expect(detail).toContain('saldo a favor o devolución');
    expect(detail).not.toContain('excess_disposition');
  });
});
