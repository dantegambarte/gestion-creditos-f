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
 * @param over - campos a sobreescribir
 */
function credit(remainingAmount: number, over: Partial<PortalCredit> = {}): PortalCredit {
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
    ...over,
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

describe('PortalCreditsComponent — orden y filtros de la lista (no romper)', () => {
  /** Crea el componente con los créditos dados. */
  function create(list: PortalCredit[]): PortalCreditsComponent {
    TestBed.configureTestingModule({
      imports: [PortalCreditsComponent],
      providers: [
        provideRouter([]),
        { provide: PortalService, useValue: { getCredits: () => of(list) } },
      ],
    });
    const fixture = TestBed.createComponent(PortalCreditsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  const list = [
    credit(1000, { id: 'futuro', nextDueDate: '2026-12-20' }),
    credit(1000, { id: 'sin-fecha', nextDueDate: null }),
    credit(1000, { id: 'mora', hasOverdue: true, nextDueDate: '2026-11-01' }),
    credit(1000, { id: 'proximo', nextDueDate: '2026-12-01' }),
    credit(0, { id: 'liquidado', status: 'SETTLED' }),
  ];

  it('ordena primero los créditos con mora y después por próximo vencimiento', () => {
    expect(create(list).activeCredits.map((c) => c.id)).toEqual([
      'mora',
      'proximo',
      'futuro',
      'sin-fecha',
    ]);
  });

  it('cada filtro muestra los créditos que corresponden', () => {
    const cmp = create(list);
    const ids = () =>
      [...cmp.filteredActiveCredits, ...cmp.filteredSettledCredits].map((c) => c.id);

    cmp.setFilter('OVERDUE');
    expect(ids()).toEqual(['mora']);
    cmp.setFilter('ON_TIME');
    expect(ids()).toEqual(['proximo', 'futuro', 'sin-fecha']);
    cmp.setFilter('SETTLED');
    expect(ids()).toEqual(['liquidado']);
    cmp.setFilter('ALL');
    expect(ids().length).toBe(5);
    expect(cmp.overdueCreditsCount).toBe(1);
    expect(cmp.nextUrgentDueDate).toBe('2026-12-01');
  });
});
