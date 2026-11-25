import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { DelinquencyComponent } from './delinquency.component';
import { CashStatusService } from '../cash-register/cash-status.service';
import { InstallmentsService } from '../../../features/seller/operations/installments.service';
import { DelinquencyRow } from '../models/interface/delinquency';

describe('DelinquencyComponent', () => {
  let component: DelinquencyComponent;
  let fixture: ComponentFixture<DelinquencyComponent>;
  let cashStatusSpy: jasmine.SpyObj<CashStatusService>;

  beforeEach(async () => {
    cashStatusSpy = jasmine.createSpyObj('CashStatusService', ['resolve', 'checkAction']);
    cashStatusSpy.resolve.and.returnValue(of('OPEN'));
    cashStatusSpy.checkAction.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [DelinquencyComponent],
      providers: [provideHttpClient(), { provide: CashStatusService, useValue: cashStatusSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(DelinquencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('onCondone bloquea y avisa si falla la consulta de caja', () => {
    const installments = TestBed.inject(InstallmentsService);
    const waiveSpy = spyOn(installments, 'waivePenalty');
    const msg = fixture.debugElement.injector.get(MessageService);
    const addSpy = spyOn(msg, 'add');
    cashStatusSpy.checkAction.and.returnValue(
      of({
        severity: 'error',
        summary: 'Estado de caja desconocido',
        detail: 'No se pudo verificar el estado de la caja.',
        life: 6000,
      }),
    );

    component.onCondone({ id: 'i1', clientName: 'Ana' } as DelinquencyRow);

    expect(waiveSpy).not.toHaveBeenCalled();
    expect(component.processingId).toBeNull();
    expect(addSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ summary: 'Estado de caja desconocido' }),
    );
  });
});
