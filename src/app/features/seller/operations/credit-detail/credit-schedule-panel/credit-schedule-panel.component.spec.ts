import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { PaymentsService } from '../../../../collector/payments.service';
import { CreditDetail } from '../../../models/credit.model';
import { CreditSchedulePanelComponent } from './credit-schedule-panel.component';

describe('CreditSchedulePanelComponent', () => {
  let fixture: ComponentFixture<CreditSchedulePanelComponent>;
  let component: CreditSchedulePanelComponent;

  const credit: CreditDetail = {
    id: 'credit-1',
    type: 'LOAN',
    totalAmount: 30000,
    totalToReturn: 57000,
    installmentsCount: 1,
    paymentFrequency: 'MONTHLY',
    interestRate: 0.89,
    effectiveRate: 0.89,
    status: 'ACTIVE',
    createdAt: '2026-07-07T00:00:00.000Z',
    approvedAt: '2026-07-07T00:00:00.000Z',
    customerId: 'customer-1',
    customerName: 'Cliente Demo',
    customerDni: '12345678',
    createdById: 'seller-1',
    createdByName: 'Vendedor Demo',
    collectorName: 'Cobrador Demo',
    rejectionReason: null,
    notes: null,
    approvedBy: 'Admin Demo',
    customerPhone: null,
    installments: [
      {
        id: 'installment-1',
        installmentNumber: 1,
        dueDate: '2026-08-07',
        amountDue: 57000,
        amountPaid: 0,
        penaltyAmount: 0,
        status: 'PENDING',
        paidAt: null,
        generationType: null,
        paidMethod: null,
        paidByName: null,
        nextVisitDate: null,
        nextVisitScheduledByName: null,
      },
    ],
    downPayment: 0,
    financedAmount: 30000,
    downPaymentMethod: null,
    downPaymentTransferReference: null,
    prepaidInstallments: 0,
    prepaidInstallmentsMethod: null,
    prepaidInstallmentsCash: 0,
    prepaidInstallmentsTransfer: 0,
    prepaidInstallmentsTransferReference: null,
    settledAt: null,
    settlementAmount: null,
    settlementType: null,
    refinancedFromCreditId: null,
    refinancingChain: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditSchedulePanelComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        { provide: PaymentsService, useValue: { listByCredit: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreditSchedulePanelComponent);
    component = fixture.componentInstance;
    component.credit = credit;
    component.canActOnInstallments = true;
    component.canScheduleVisits = true;
    fixture.detectChanges();
  });

  it('muestra el botón calendario en la card mobile de una cuota programable', () => {
    const scheduleButtons: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll(
        '[data-cy="installment-schedule-visit"]',
      );

    expect(scheduleButtons.length).toBeGreaterThan(0);
  });

  it('muestra acciones mobile con texto para distinguir cobro y visita', () => {
    const mobileCard: HTMLElement = fixture.nativeElement.querySelector(
      '[data-cy="credit-schedule-mobile-card"]',
    );
    const text = mobileCard.textContent ?? '';

    expect(text).toContain('Cobrar');
    expect(text).toContain('Visita');
  });

  it('abre el diálogo de programación desde la acción mobile', () => {
    const mobileCard: HTMLElement = fixture.nativeElement.querySelector(
      '[data-cy="credit-schedule-mobile-card"]',
    );
    const scheduleButton: HTMLElement = mobileCard.querySelector(
      '[data-cy="installment-schedule-visit"]',
    )!;

    scheduleButton.click();
    fixture.detectChanges();

    expect(component.showScheduleVisitDialog).toBeTrue();
    expect(component.scheduleVisitInstallment?.id).toBe('installment-1');
  });

  it('rol vendedor: ve "Programar visita" pero no las acciones admin (cobro/mora)', () => {
    // Vendedor/mixto: puede agendar visitas pero el crédito es solo lectura para él.
    component.canActOnInstallments = false;
    component.canScheduleVisits = true;
    fixture.detectChanges();

    const mobileCard: HTMLElement = fixture.nativeElement.querySelector(
      '[data-cy="credit-schedule-mobile-card"]',
    );
    const text = mobileCard.textContent ?? '';

    expect(
      mobileCard.querySelector('[data-cy="installment-schedule-visit"]'),
    ).toBeTruthy();
    expect(text).toContain('Visita');
    expect(text).not.toContain('Cobrar');
    expect(
      mobileCard.querySelector('[data-cy="installment-direct-payment"]'),
    ).toBeNull();
  });
});
