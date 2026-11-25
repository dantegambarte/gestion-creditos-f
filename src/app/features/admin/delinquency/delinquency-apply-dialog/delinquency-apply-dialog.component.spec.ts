import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { InstallmentsService } from '../../../../features/seller/operations/installments.service';
import { CashStatusService } from '../../cash-register/cash-status.service';
import { DelinquencyRow } from '../../models/interface/delinquency';
import { DelinquencyApplyDialogComponent } from './delinquency-apply-dialog.component';

describe('DelinquencyApplyDialogComponent', () => {
  let installmentsSpy: jasmine.SpyObj<InstallmentsService>;
  let cashStatusSpy: jasmine.SpyObj<CashStatusService>;
  let msg: MessageService;

  beforeEach(() => {
    installmentsSpy = jasmine.createSpyObj('InstallmentsService', ['applyPenalty']);
    installmentsSpy.applyPenalty.and.returnValue(of({ penaltyAmount: 100 }) as never);
    cashStatusSpy = jasmine.createSpyObj('CashStatusService', ['checkAction']);
    TestBed.configureTestingModule({
      imports: [DelinquencyApplyDialogComponent],
      providers: [
        MessageService,
        { provide: InstallmentsService, useValue: installmentsSpy },
        { provide: CashStatusService, useValue: cashStatusSpy },
      ],
    }).overrideComponent(DelinquencyApplyDialogComponent, {
      set: { template: '' },
    });
    msg = TestBed.inject(MessageService);
  });

  /** Crea el diálogo con una fila y monto válidos listos para confirmar. */
  function create(): DelinquencyApplyDialogComponent {
    const c = TestBed.createComponent(DelinquencyApplyDialogComponent).componentInstance;
    c.row = { id: 'i1', clientName: 'Ana' } as DelinquencyRow;
    c.applyAmount = 100;
    return c;
  }

  it('bloquea aplicar mora y avisa si falla la consulta de caja', () => {
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(
      of({
        severity: 'error',
        summary: 'Estado de caja desconocido',
        detail: 'x',
        life: 6000,
      }),
    );
    const c = create();
    c.confirmApply();
    expect(installmentsSpy.applyPenalty).not.toHaveBeenCalled();
    expect(c.loading).toBeFalse();
    expect(addSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ summary: 'Estado de caja desconocido' }),
    );
  });

  it('no arrastra el monto al abrir el diálogo para otra cuota', () => {
    const c = create();
    c.ngOnChanges({ visible: new SimpleChange(false, true, false) });
    c.applyAmount = 250;
    c.row = { id: 'i2', clientName: 'Beto' } as DelinquencyRow;
    c.ngOnChanges({ row: new SimpleChange({ id: 'i1' }, c.row, false) });
    expect(c.applyAmount).toBeNull();
  });

  it('usa una severidad de toast válida al aplicar mora', () => {
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(of(null));
    create().confirmApply();
    expect(addSpy).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'warn' }));
  });

  it('aplica mora con caja abierta', () => {
    cashStatusSpy.checkAction.and.returnValue(of(null));
    create().confirmApply();
    expect(installmentsSpy.applyPenalty).toHaveBeenCalledWith('i1', {
      penaltyAmount: 100,
    });
  });
});
