import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CashStatusService, useValue: cashStatusSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DelinquencyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('enMoraCount cuenta solo cuotas con mora aplicada', () => {
    const rows = [
      { id: 'a', amount: 100, delinquencyAmount: 50, status: 'EN_MORA' },
      { id: 'b', amount: 200, delinquencyAmount: 0, status: 'SIN_APLICAR' },
    ] as DelinquencyRow[];
    const stats = (component as any).calcStats(rows);
    expect(stats.enMoraCount).toBe(1);
    expect(stats.aplicada).toBe(50);
    expect(stats.sinAplicar).toBe(200);
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

  it('onNotify no simula éxito: avisa que el envío no está disponible', () => {
    const msgSpy = spyOn((component as any).msg, 'add');
    component.onNotify({ id: 'a', clientName: 'Ana' } as DelinquencyRow);
    expect(msgSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ severity: 'warn', summary: 'Aviso no enviado' }),
    );
    expect(msgSpy).not.toHaveBeenCalledWith(jasmine.objectContaining({ summary: 'Aviso enviado' }));
    expect(component.processingId).toBeNull();
  });

  describe('reglas de mora sobre cuotas vencidas', () => {
    const NOW = new Date(2026, 2, 15, 12, 0, 0);
    const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
    const inst = (id: string, dueDate: Date, penaltyAmount: number, amountDue: number) =>
      ({
        id,
        dueDate: dueDate.toISOString(),
        penaltyAmount,
        amountDue,
        customerName: 'Cliente ' + id,
        customerDni: '30' + id,
        installmentNumber: 1,
        collectorName: 'Cobrador',
      }) as any;

    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(NOW);
      const installments = TestBed.inject(InstallmentsService);
      spyOn(installments, 'list').and.returnValue(
        of([
          inst('a', daysAgo(1), 0, 1000),
          inst('b', daysAgo(15), 300, 2000),
          inst('c', daysAgo(16), 0, 4000),
          inst('d', daysAgo(30), 500, 8000),
          inst('e', daysAgo(31), 0, 16000),
        ]),
      );
      component.ngOnInit();
    });

    afterEach(() => jasmine.clock().uninstall());

    it('calcula los días de atraso desde el vencimiento y el estado según la mora aplicada', () => {
      const byId = Object.fromEntries(component.clients.map((c) => [c.id, c]));
      expect(byId['a'].daysOverdue).toBe(1);
      expect(byId['e'].daysOverdue).toBe(31);
      expect(byId['a'].status).toBe('SIN_APLICAR');
      expect(byId['b'].status).toBe('EN_MORA');
    });

    it('pide las cuotas vencidas por fecha, no por status OVERDUE persistido', () => {
      const installments = TestBed.inject(InstallmentsService);
      expect(installments.list).toHaveBeenCalledWith({ overdue: true });
    });

    it('resume la mora aplicada y el monto sin aplicar', () => {
      expect(component.stats.enMoraCount).toBe(2);
      expect(component.stats.aplicada).toBe(800);
      expect(component.stats.sinAplicar).toBe(1000 + 4000 + 16000);
    });

    it('filtra por tramos de días con límites inclusivos 1-15, 16-30 y más de 30', () => {
      const ids = () => component.filteredClients.map((c) => c.id);
      component.filterDias = '1-15';
      component.applyFilters();
      expect(ids()).toEqual(['a', 'b']);
      component.filterDias = '16-30';
      component.applyFilters();
      expect(ids()).toEqual(['c', 'd']);
      component.filterDias = '30+';
      component.applyFilters();
      expect(ids()).toEqual(['e']);
    });

    it('al aplicar o condonar mora recalcula el estado y los totales', () => {
      component.onPenaltyApplied({ id: 'a', amount: 200 });
      expect(component.clients.find((c) => c.id === 'a')!.status).toBe('EN_MORA');
      expect(component.stats.aplicada).toBe(1000);
      expect(component.stats.sinAplicar).toBe(20000);

      component.onPenaltyApplied({ id: 'b', amount: 0 });
      expect(component.clients.find((c) => c.id === 'b')!.status).toBe('SIN_APLICAR');
      expect(component.stats.enMoraCount).toBe(2);
      expect(component.stats.sinAplicar).toBe(22000);
    });
  });
});
