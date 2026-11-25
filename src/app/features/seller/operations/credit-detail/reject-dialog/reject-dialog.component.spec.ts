import { SimpleChange } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Subject, of } from 'rxjs';
import { CreditDetail } from '../../../models/credit.model';
import { CreditsService } from '../../credits.service';
import { RejectDialogComponent } from './reject-dialog.component';

describe('RejectDialogComponent', () => {
  let creditsSpy: jasmine.SpyObj<CreditsService>;

  beforeEach(() => {
    creditsSpy = jasmine.createSpyObj('CreditsService', ['reject']);
    creditsSpy.reject.and.returnValue(of(undefined) as never);
    TestBed.configureTestingModule({
      imports: [RejectDialogComponent],
      providers: [MessageService, { provide: CreditsService, useValue: creditsSpy }],
    }).overrideComponent(RejectDialogComponent, { set: { template: '' } });
  });

  /** Crea el diálogo con un crédito cargado. */
  function create(): RejectDialogComponent {
    const c = TestBed.createComponent(RejectDialogComponent).componentInstance;
    c.credit = { id: 'C1' } as CreditDetail;
    return c;
  }

  it('bloquea un motivo de solo espacios', () => {
    const c = create();
    c.reason = '     ';
    c.confirm();
    expect(creditsSpy.reject).not.toHaveBeenCalled();
    expect(c.charCount()).toBe(0);
  });

  it('rechaza con el motivo recortado', () => {
    const c = create();
    c.reason = '  Sin ingresos  ';
    c.confirm();
    expect(creditsSpy.reject).toHaveBeenCalledWith('C1', { rejectionReason: 'Sin ingresos' });
  });

  it('ignora un segundo confirm mientras el rechazo está en curso', () => {
    creditsSpy.reject.and.returnValue(new Subject<never>().asObservable());
    const c = create();
    c.reason = 'Sin ingresos';
    c.confirm();
    c.confirm();
    expect(creditsSpy.reject).toHaveBeenCalledTimes(1);
  });

  it('limpia el motivo al reabrir el diálogo', () => {
    const c = create();
    c.reason = 'anterior';
    c.ngOnChanges({ visible: new SimpleChange(false, true, false) });
    expect(c.reason).toBe('');
  });
});
