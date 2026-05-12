import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MockAuthService } from '../../../core/auth/mock-auth.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { DateService } from '../../../core/services/date.service';
import { ReportsService } from '../reports/reports.service';
import { CreditsService } from '../../seller/operations/credits.service';
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
  overdueCount: 87,
  overdueAmount: 435000,
  upcoming7dCount: 20,
  upcoming7dAmount: 100000,
};

const mockCredits = [
  {
    id: 'c1',
    type: 'LOAN',
    totalAmount: 5000,
    installmentsCount: 12,
    paymentFrequency: 'MONTHLY',
    interestRate: 0.08,
    status: 'ACTIVE',
    createdAt: '2024-04-15T10:00:00Z',
    approvedAt: null,
    customerId: 'u1',
    customerName: 'Test User',
    customerDni: '12345678',
    createdById: null,
    createdByName: null,
  },
];

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let reportsSpy: jasmine.SpyObj<ReportsService>;
  let creditsSpy: jasmine.SpyObj<CreditsService>;
  let authSpy: jasmine.SpyObj<MockAuthService>;

  beforeEach(async () => {
    reportsSpy = jasmine.createSpyObj('ReportsService', ['getSummaryReport']);
    creditsSpy = jasmine.createSpyObj('CreditsService', ['list']);
    authSpy = jasmine.createSpyObj('MockAuthService', [], { snapshot: { name: 'Carlos López', full_name: 'Carlos López' } });

    reportsSpy.getSummaryReport.and.returnValue(of(mockSummary));
    creditsSpy.list.and.returnValue(of(mockCredits as any));

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: MockAuthService, useValue: authSpy },
        { provide: AuthServiceBase, useExisting: MockAuthService },
        { provide: ReportsService, useValue: reportsSpy },
        { provide: CreditsService, useValue: creditsSpy },
        { provide: DateService, useValue: { display: () => 'sábado 26 de abril, 2025' } },
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
    expect(component.kpis.length).toBe(4);
    const cobrado = component.kpis.find((k) => k.label === 'Cobrado Hoy');
    expect(cobrado?.value).toContain('48.920');
  });

  it('recentOps mapped from credits list', () => {
    expect(component.loadingOps).toBeFalse();
    expect(component.recentOps.length).toBe(1);
    expect(component.recentOps[0].client).toBe('Test User');
    expect(component.recentOps[0].type).toBe('PRÉSTAMO');
  });
});
