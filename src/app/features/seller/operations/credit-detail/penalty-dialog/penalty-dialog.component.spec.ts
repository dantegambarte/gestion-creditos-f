import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { CreditDetail } from '../../../models/credit.model';
import { InstallmentsService } from '../../installments.service';
import { PenaltyDialogComponent } from './penalty-dialog.component';

describe('PenaltyDialogComponent', () => {
  let installmentsSpy: jasmine.SpyObj<InstallmentsService>;

  beforeEach(() => {
    installmentsSpy = jasmine.createSpyObj('InstallmentsService', ['applyPenalty']);
    installmentsSpy.applyPenalty.and.returnValue(of({ penaltyAmount: 100 }) as never);
    TestBed.configureTestingModule({
      imports: [PenaltyDialogComponent],
      providers: [MessageService, { provide: InstallmentsService, useValue: installmentsSpy }],
    }).overrideComponent(PenaltyDialogComponent, { set: { template: '' } });
  });

  it('no arrastra monto ni motivo al abrir para otra cuota', () => {
    const c = TestBed.createComponent(PenaltyDialogComponent).componentInstance;
    c.installment = { id: 'i1' } as CreditDetail['installments'][number];
    c.amount = 300;
    c.reason = 'atraso';
    const next = { id: 'i2' } as CreditDetail['installments'][number];
    c.installment = next;
    c.ngOnChanges({ installment: new SimpleChange({ id: 'i1' }, next, false) });
    expect(c.amount).toBeNull();
    expect(c.reason).toBe('');
  });

  it('aplica mora con el monto cargado', () => {
    const c = TestBed.createComponent(PenaltyDialogComponent).componentInstance;
    c.installment = { id: 'i1' } as CreditDetail['installments'][number];
    c.amount = 300;
    c.confirm();
    expect(installmentsSpy.applyPenalty).toHaveBeenCalledWith('i1', { penaltyAmount: 300 });
  });
});
