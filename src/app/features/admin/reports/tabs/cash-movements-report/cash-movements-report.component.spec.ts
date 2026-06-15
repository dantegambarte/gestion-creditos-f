import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CashRegisterService } from '../../../cash-register/cash-register.service';
import { BusinessDayListItem } from '../../../models/business-day.model';
import { CashSessionListItem } from '../../../models/cash-session.model';
import { CashMovementReport } from '../../report.models';
import { ReportsService } from '../../reports.service';
import { CashMovementsReportComponent } from './cash-movements-report.component';

const mockBusinessDay: BusinessDayListItem = {
  id: 'bd-1',
  business_date: '2026-06-10',
  branch_id: 'branch-1',
  branch_name: 'Sucursal Centro',
  status: 'CLOSED',
  opened_at: '2026-06-10T08:00:00.000Z',
};

const mockSession: CashSessionListItem = {
  id: 'cs-1',
  business_day_id: 'bd-1',
  owner_user_id: 'user-1',
  opened_at: '2026-06-10T08:00:00.000Z',
  opened_by: 'user-1',
  opening_amount: 1000,
  status: 'CLOSED',
  summary: null,
};

const mockReport: CashMovementReport = {
  summary: {
    totalMovements: 2,
    totalCollections: 5000,
    totalDownPayments: 1000,
    totalExpenses: 300,
    totalDrops: 2000,
  },
  rows: [
    {
      id: 'm1',
      type: 'COBRO',
      occurredAt: '2026-06-10T10:00:00.000Z',
      cashSessionId: 'cs-1',
      businessDate: '2026-06-10',
      branchName: 'Sucursal Centro',
      shiftLabel: null,
      amount: 5000,
      paymentMethod: 'CASH',
      description: 'Cobro cuota #1 · Juan Pérez',
      performedByName: 'Admin',
    },
  ],
};

describe('CashMovementsReportComponent', () => {
  let component: CashMovementsReportComponent;
  let fixture: ComponentFixture<CashMovementsReportComponent>;
  let cashRegisterSpy: jasmine.SpyObj<CashRegisterService>;
  let reportsSpy: jasmine.SpyObj<ReportsService>;

  beforeEach(async () => {
    cashRegisterSpy = jasmine.createSpyObj('CashRegisterService', [
      'listBusinessDays',
      'listSessionsByBusinessDay',
    ]);
    reportsSpy = jasmine.createSpyObj('ReportsService', [
      'getCashMovementsReport',
    ]);

    cashRegisterSpy.listBusinessDays.and.returnValue(of([mockBusinessDay]));
    cashRegisterSpy.listSessionsByBusinessDay.and.returnValue(
      of([mockSession]),
    );
    reportsSpy.getCashMovementsReport.and.returnValue(of(mockReport));

    await TestBed.configureTestingModule({
      imports: [CashMovementsReportComponent],
      providers: [
        { provide: CashRegisterService, useValue: cashRegisterSpy },
        { provide: ReportsService, useValue: reportsSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CashMovementsReportComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('rangeValid', () => {
    it('es true cuando dateFrom <= dateTo', () => {
      component.dateFrom = '2026-06-01';
      component.dateTo = '2026-06-10';
      expect(component.rangeValid).toBeTrue();
    });

    it('es false cuando dateFrom > dateTo', () => {
      component.dateFrom = '2026-06-15';
      component.dateTo = '2026-06-01';
      expect(component.rangeValid).toBeFalse();
    });

    it('es false cuando falta alguna fecha', () => {
      component.dateFrom = '';
      component.dateTo = '2026-06-10';
      expect(component.rangeValid).toBeFalse();
    });
  });

  describe('consult', () => {
    it('marca dateError y no consulta jornadas si el rango es inválido', () => {
      component.dateFrom = '2026-06-15';
      component.dateTo = '2026-06-01';
      cashRegisterSpy.listBusinessDays.calls.reset();

      component.consult();

      expect(component.dateError).toBeTruthy();
      expect(cashRegisterSpy.listBusinessDays).not.toHaveBeenCalled();
    });

    it('carga las jornadas del rango cuando es válido', () => {
      component.dateFrom = '2026-06-01';
      component.dateTo = '2026-06-10';

      component.consult();

      expect(cashRegisterSpy.listBusinessDays).toHaveBeenCalledWith({
        dateFrom: '2026-06-01',
        dateTo: '2026-06-10',
      });
      expect(component.businessDays).toEqual([mockBusinessDay]);
      expect(component.dateError).toBe('');
    });

    it('expone el error cuando falla la consulta de jornadas', () => {
      const err = { status: 500, message: 'boom' } as any;
      cashRegisterSpy.listBusinessDays.and.returnValue(throwError(() => err));

      component.consult();

      expect(component.daysError).toBe(err);
    });
  });

  describe('businessDayOptions', () => {
    it('mapea jornadas a opciones con label legible', () => {
      component.businessDays = [mockBusinessDay];
      const options = component.businessDayOptions;
      expect(options.length).toBe(1);
      expect(options[0].value).toBe('bd-1');
      expect(options[0].label).toContain('Sucursal Centro');
    });

    it('usa "Empresa" cuando la jornada no tiene branch_name', () => {
      component.businessDays = [{ ...mockBusinessDay, branch_name: undefined }];
      expect(component.businessDayOptions[0].label).toContain('Empresa');
    });
  });

  describe('onSelectBusinessDay', () => {
    it('resetea el estado cuando se deselecciona la jornada', () => {
      component.sessions = [mockSession];
      component.selectedSessionId = 'cs-1';
      component.report = mockReport;

      component.onSelectBusinessDay(null);

      expect(component.selectedBusinessDayId).toBeNull();
      expect(component.sessions).toEqual([]);
      expect(component.selectedSessionId).toBeNull();
      expect(component.report).toBeNull();
    });

    it('carga la caja de la jornada y dispara el reporte de movimientos', () => {
      component.onSelectBusinessDay('bd-1');

      expect(cashRegisterSpy.listSessionsByBusinessDay).toHaveBeenCalledWith(
        'bd-1',
      );
      expect(component.sessions).toEqual([mockSession]);
      expect(component.selectedSessionId).toBe('cs-1');
      expect(reportsSpy.getCashMovementsReport).toHaveBeenCalledWith('cs-1');
      expect(component.report).toEqual(mockReport);
    });

    it('expone el error cuando falla la consulta del reporte', () => {
      const err = { status: 500, message: 'boom' } as any;
      reportsSpy.getCashMovementsReport.and.returnValue(throwError(() => err));

      component.onSelectBusinessDay('bd-1');

      expect(component.reportError).toBe(err);
    });

    it('no dispara el reporte si la jornada no tiene cajas', () => {
      cashRegisterSpy.listSessionsByBusinessDay.and.returnValue(of([]));

      component.onSelectBusinessDay('bd-1');

      expect(component.sessions).toEqual([]);
      expect(component.selectedSessionId).toBeNull();
      expect(reportsSpy.getCashMovementsReport).not.toHaveBeenCalled();
    });
  });

  describe('etiquetas y estilos', () => {
    it('typeLabel traduce los tipos conocidos', () => {
      expect(component.typeLabel('COBRO')).toBe('Cobro');
      expect(component.typeLabel('ENGANCHE')).toBe('Enganche');
      expect(component.typeLabel('GASTO')).toBe('Gasto');
      expect(component.typeLabel('DROP')).toBe('Drop');
      expect(component.typeLabel('CONVERSION')).toBe('Conversión');
    });

    it('methodLabel traduce métodos conocidos y combinaciones de conversión', () => {
      expect(component.methodLabel('CASH')).toBe('Efectivo');
      expect(component.methodLabel('TRANSFER')).toBe('Transferencia');
      expect(component.methodLabel('CASH_TRANSFER')).toBe(
        'Efectivo → Transferencia',
      );
      expect(component.methodLabel('TRANSFER_CASH')).toBe(
        'Transferencia → Efectivo',
      );
    });

    it('methodLabel devuelve el valor crudo si no hay traducción', () => {
      expect(component.methodLabel('OTRO')).toBe('OTRO');
    });

    it('typeBadgeClasses asigna colores según el tipo', () => {
      expect(component.typeBadgeClasses('COBRO')).toContain('emerald');
      expect(component.typeBadgeClasses('ENGANCHE')).toContain('emerald');
      expect(component.typeBadgeClasses('GASTO')).toContain('red');
      expect(component.typeBadgeClasses('DROP')).toContain('amber');
      expect(component.typeBadgeClasses('CONVERSION')).toContain('gray');
    });
  });

  describe('formateo', () => {
    it('formatCurrency delega en FormatService', () => {
      expect(component.formatCurrency(1000)).toBe(
        component.format.currency(1000),
      );
    });

    it('formatDateTime delega en DateService con formato dd/MM/yyyy HH:mm', () => {
      const iso = '2026-06-10T10:00:00.000Z';
      expect(component.formatDateTime(iso)).toContain('10/06/2026');
    });
  });

  describe('ngOnInit', () => {
    it('dispara consult() al inicializar el componente', () => {
      fixture.detectChanges();
      expect(cashRegisterSpy.listBusinessDays).toHaveBeenCalled();
    });
  });
});
