import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { MockAuthService } from '../../../core/auth/mock-auth.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import { InstallmentsService } from '../../seller/operations/installments.service';
import { ReportsService } from '../reports/reports.service';
import { DashboardComponent } from './dashboard.component';

const mockSummary = {
  reportDate: '2026-04-28',
  todayCollected: 48920,
  todayCash: 30000,
  todayTransfer: 18920,
  todayPaymentsCount: 12,
  todayDownPayments: 5000,
  todayDownPaymentsCount: 2,
  todayTotal: 53920,
  pendingPaymentsCount: 5,
  pendingCreditsCount: 3,
  activePortfolioBalance: 2847320,
  activeCreditsCount: 120,
  overdueCount: 87,
  overdueAmount: 435000,
  upcoming7dCount: 20,
  upcoming7dAmount: 100000,
  refinancedMonthCount: 4,
  refinancedMonthAmount: 80000,
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let reportsSpy: jasmine.SpyObj<ReportsService>;
  let authSpy: jasmine.SpyObj<MockAuthService>;
  let formatSpy: jasmine.SpyObj<FormatService>;

  beforeEach(async () => {
    reportsSpy = jasmine.createSpyObj('ReportsService', [
      'getSummaryReport',
      'getCollectionReport',
      'getCollectorsReport',
      'getSellersReport',
    ]);
    authSpy = jasmine.createSpyObj('MockAuthService', [], {
      snapshot: { name: 'Carlos López', full_name: 'Carlos López' },
    });
    formatSpy = jasmine.createSpyObj('FormatService', ['currency', 'number']);
    const installmentsSpy = jasmine.createSpyObj('InstallmentsService', ['list']);
    const cashRegisterSpy = jasmine.createSpyObj('CashRegisterService', ['getDashboard']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    reportsSpy.getSummaryReport.and.returnValue(of(mockSummary));
    reportsSpy.getCollectionReport.and.returnValue(of(null as any));
    reportsSpy.getCollectorsReport.and.returnValue(of([]));
    reportsSpy.getSellersReport.and.returnValue(of([]));
    installmentsSpy.list.and.returnValue(of([]));
    cashRegisterSpy.getDashboard.and.returnValue(of({ isClosed: false }));
    formatSpy.currency.and.callFake((v: number) =>
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v),
    );
    formatSpy.number.and.callFake((v: number) => String(v));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: MockAuthService, useValue: authSpy },
        { provide: AuthServiceBase, useExisting: MockAuthService },
        { provide: ReportsService, useValue: reportsSpy },
        { provide: InstallmentsService, useValue: installmentsSpy },
        { provide: CashRegisterService, useValue: cashRegisterSpy },
        { provide: FormatService, useValue: formatSpy },
        { provide: Router, useValue: routerSpy },
        { provide: DateService, useValue: { display: () => 'sábado 26 de abril, 2025' } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('userName comes from authService.snapshot.name', () => {
    expect(component.userName).toBe('Carlos López');
  });

  it('uses single getSummaryReport call (not forkJoin of 3)', () => {
    expect(reportsSpy.getSummaryReport).toHaveBeenCalledTimes(1);
  });

  it('KPIs populated from summaryReport after load', () => {
    expect(component.loadingKpis).toBeFalse();
    expect(component.kpis.length).toBeGreaterThan(0);
    const recaudado = component.kpis.find((k) => k.label === 'Recaudado hoy');
    expect(recaudado).toBeTruthy();
    expect(recaudado?.value).toContain('53.920');
  });
});
