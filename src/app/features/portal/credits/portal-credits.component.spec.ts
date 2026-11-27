import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PortalCredit } from '../models/portal.models';
import { PortalService } from '../portal.service';
import { PortalCreditsComponent } from './portal-credits.component';

/**
 * Crédito activo de 6 cuotas de 1.000 con 2 pagadas. `remainingAmount` es la deuda
 * restante que calcula el backend (Σ amount_due − amount_paid de las no pagadas),
 * la misma fórmula que usa el detalle del crédito.
 * @param remainingAmount - deuda restante informada por el backend
 */
function credit(remainingAmount: number): PortalCredit {
  return {
    id: 'cr-1',
    type: 'LOAN',
    name: null,
    totalAmount: 5000,
    totalToReturn: 6000,
    installmentsCount: 6,
    installmentAmount: 1000,
    paymentFrequency: 'MONTHLY',
    status: 'ACTIVE',
    createdAt: '2026-01-01',
    approvedAt: '2026-01-01',
    settledAt: null,
    totalInstallments: 6,
    paidInstallments: 2,
    nextDueDate: null,
    nextDueAmount: null,
    pendingPenalty: 0,
    hasOverdue: false,
    overdueInstallmentsCount: 0,
    remainingAmount,
  } as PortalCredit;
}

describe('PortalCreditsComponent — deuda restante (#55)', () => {
  /** Renderiza la lista con un crédito y devuelve el texto de su tarjeta. */
  function cardText(c: PortalCredit): {
    cmp: PortalCreditsComponent;
    text: string;
    debtCell: string | null;
  } {
    TestBed.configureTestingModule({
      imports: [PortalCreditsComponent],
      providers: [
        provideRouter([]),
        { provide: PortalService, useValue: { getCredits: () => of([c]) } },
      ],
    });
    const fixture = TestBed.createComponent(PortalCreditsComponent);
    fixture.detectChanges();
    const card = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-cy="portal-credits-card"]',
    );
    const debt = card?.querySelector('[data-cy="portal-credit-remaining-debt"]');
    return {
      cmp: fixture.componentInstance,
      text: card?.textContent ?? '',
      debtCell: debt ? (debt.textContent ?? '').trim() : null,
    };
  }

  it('usa la deuda restante del backend: descuenta pagos parciales igual que el detalle', () => {
    // 4 cuotas impagas × 1.000 = 4.000, pero una tiene 500 pagados → el backend informa 3.500
    const c = credit(3500);
    const { cmp, text } = cardText(c);

    expect(cmp.remainingDebt(c)).toBe(3500);
    expect(text).toMatch(/3[.,]500/);
    expect(text).not.toMatch(/4[.,]000/);
  });

  it('muestra 0 (no "—") cuando el backend informa deuda restante 0', () => {
    const c = credit(0);
    const { cmp, debtCell } = cardText(c);

    expect(cmp.remainingDebt(c)).toBe(0);
    expect(debtCell).toMatch(/0/);
    expect(debtCell).not.toContain('—');
  });
});
