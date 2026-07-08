import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ApprovalsComponent } from './approvals.component';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { CreditsService } from '../../seller/operations/credits.service';
import { DateService } from '../../../core/services/date.service';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Credit } from '../../seller/models/credit.model';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';

const MOCK_CREDITS: Credit[] = [
  {
    id: 'CR001',
    type: 'SALE',
    totalAmount: 35000,
    installmentsCount: 12,
    paymentFrequency: 'MONTHLY',
    interestRate: 5,
    effectiveRate: 5,
    totalToReturn: null,
    collectorName: null,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-04-15T10:00:00Z',
    approvedAt: null,
    customerId: 'cust-1',
    customerName: 'Juan Pérez',
    customerDni: '12345678',
    createdById: 'seller-1',
    createdByName: 'María S.',
  },
  {
    id: 'CR002',
    type: 'LOAN',
    totalAmount: 15000,
    installmentsCount: 6,
    paymentFrequency: 'MONTHLY',
    interestRate: 5,
    effectiveRate: 5,
    totalToReturn: null,
    collectorName: null,
    status: 'PENDING_APPROVAL',
    createdAt: '2026-04-13T10:00:00Z',
    approvedAt: null,
    customerId: 'cust-2',
    customerName: 'María López',
    customerDni: '87654321',
    createdById: 'seller-2',
    createdByName: 'Carlos L.',
  },
];

describe('ApprovalsComponent', () => {
  let component: ApprovalsComponent;
  let fixture: ComponentFixture<ApprovalsComponent>;
  let creditsSvc: jasmine.SpyObj<CreditsService>;
  let authSpy: jasmine.SpyObj<AuthServiceBase>;

  beforeEach(async () => {
    creditsSvc = jasmine.createSpyObj('CreditsService', [
      'list',
      'getById',
      'approve',
      'reject',
    ]);
    authSpy = jasmine.createSpyObj('AuthServiceBase', ['patchCurrentUser'], {
      snapshot: { pending_approvals_count: 2 },
    });
    const cashRegisterSpy = jasmine.createSpyObj('CashRegisterService', ['getDashboard']);
    creditsSvc.list.and.returnValue(of([...MOCK_CREDITS]));
    creditsSvc.getById.and.callFake((id: string) =>
      of((MOCK_CREDITS.find((credit) => credit.id === id) ?? MOCK_CREDITS[0]) as any),
    );
    creditsSvc.approve.and.returnValue(of({} as any));
    creditsSvc.reject.and.returnValue(of(undefined as any));
    cashRegisterSpy.getDashboard.and.returnValue(of({ isClosed: false } as any));

    await TestBed.configureTestingModule({
      imports: [ApprovalsComponent, RouterTestingModule, NoopAnimationsModule],
      providers: [
        { provide: CreditsService, useValue: creditsSvc },
        { provide: CashRegisterService, useValue: cashRegisterSpy },
        { provide: AuthServiceBase, useValue: authSpy },
        MessageService,
        DateService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    })
      .overrideComponent(ApprovalsComponent, { set: { providers: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(ApprovalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga aprobaciones en ngOnInit', () => {
    expect(creditsSvc.list).toHaveBeenCalledWith({ status: 'PENDING_APPROVAL' });
    expect(component.approvals.length).toBe(2);
    expect(component.loading).toBeFalse();
  });

  it('loading=true antes de que lleguen datos', () => {
    const f = TestBed.createComponent(ApprovalsComponent);
    expect(f.componentInstance.loading).toBeTrue();
  });

  it('maneja error en carga y desactiva loading', () => {
    creditsSvc.list.and.returnValue(throwError(() => new Error('500')));
    const f = TestBed.createComponent(ApprovalsComponent);
    f.detectChanges();
    expect(f.componentInstance.loading).toBeFalse();
    expect(f.componentInstance.approvals.length).toBe(0);
  });

  it('processingId null al inicio', () => {
    expect(component.processingId).toBeNull();
  });

  it('limpia la búsqueda desde el botón del input', () => {
    component.searchTerm = 'Juan';
    fixture.detectChanges();

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-cy="admin-approvals-search-clear"]',
    );
    clearButton.click();
    fixture.detectChanges();

    expect(component.searchTerm).toBe('');
    expect(
      fixture.nativeElement.querySelector('[data-cy="admin-approvals-search-clear"]'),
    ).toBeNull();
  });

  it('onApprove ignora clic si processingId activo', () => {
    component.processingId = 'CR001';
    component.onApprove(MOCK_CREDITS[0]);
    expect(component.showApproveDialog).toBeFalse();
  });

  it('onReject ignora clic si processingId activo', () => {
    component.processingId = 'CR001';
    component.onReject(MOCK_CREDITS[0]);
    expect(component.showRejectDialog).toBeFalse();
  });

  it('confirmApprove quita la fila aprobada del array', () => {
    component.approvingRow = MOCK_CREDITS[0];
    component.confirmApprove();
    expect(creditsSvc.approve).toHaveBeenCalledWith('CR001', {});
    expect(component.approvals.find((a) => a.id === 'CR001')).toBeUndefined();
  });

  it('confirmApprove muestra toast de éxito al aprobar', () => {
    const addSpy = spyOn(TestBed.inject(MessageService), 'add');
    component.approvingRow = MOCK_CREDITS[0];

    component.confirmApprove();

    expect(addSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'success',
        summary: 'Aprobado',
      }),
    );
  });

  it('confirmReject no envía si rejectReason menor a 5 chars', () => {
    component.rejectingRow = MOCK_CREDITS[1];
    component.rejectReason = 'abc';
    component.confirmReject();
    expect(creditsSvc.reject).not.toHaveBeenCalled();
  });

  it('desuscribe en ngOnDestroy', () => {
    const spy = spyOn(component['destroy$'], 'next').and.callThrough();
    fixture.destroy();
    expect(spy).toHaveBeenCalled();
  });
});
