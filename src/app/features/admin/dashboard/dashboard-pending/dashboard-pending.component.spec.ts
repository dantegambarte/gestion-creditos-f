import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { PaymentsService } from '../../../collector/payments.service';
import { CreditsService } from '../../../seller/operations/credits.service';
import { DashboardPendingComponent } from './dashboard-pending.component';

describe('DashboardPendingComponent', () => {
  let component: DashboardPendingComponent;
  let fixture: ComponentFixture<DashboardPendingComponent>;
  let paymentsSpy: jasmine.SpyObj<PaymentsService>;
  let messageSpy: jasmine.SpyObj<MessageService>;

  beforeEach(async () => {
    const creditsSpy = jasmine.createSpyObj('CreditsService', ['list']);
    paymentsSpy = jasmine.createSpyObj('PaymentsService', ['list', 'approve']);
    messageSpy = jasmine.createSpyObj('MessageService', ['add']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    creditsSpy.list.and.returnValue(of([]));
    paymentsSpy.list.and.returnValue(of([]));
    paymentsSpy.approve.and.returnValue(of({} as any));

    await TestBed.configureTestingModule({
      imports: [DashboardPendingComponent],
      providers: [
        { provide: CreditsService, useValue: creditsSpy },
        { provide: PaymentsService, useValue: paymentsSpy },
        { provide: MessageService, useValue: messageSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPendingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra toast de éxito al aprobar un precobro desde dashboard — CO-05', () => {
    component.selectedPaymentToApprove = {
      id: 'pay-001',
      installmentId: 'inst-001',
      amountReceived: 1000,
      paymentMethod: 'CASH',
      status: 'PENDING',
      createdAt: '2026-06-01T10:00:00Z',
      installmentNumber: 1,
      amountDue: 1000,
      dueDate: '2026-06-01',
      creditId: 'cred-001',
      creditType: 'SALE',
      customerName: 'Juan Cliente',
      customerDni: '12345678',
      collectorName: 'María Cobradora',
    } as any;

    component.confirmApprovePayment();

    expect(paymentsSpy.approve).toHaveBeenCalledWith('pay-001');
    expect(messageSpy.add).toHaveBeenCalledWith(
      jasmine.objectContaining({
        severity: 'success',
        summary: 'Cobro aprobado',
      }),
    );
  });
});
