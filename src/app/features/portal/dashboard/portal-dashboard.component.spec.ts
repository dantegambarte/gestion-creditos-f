import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AccountSummary, UpcomingInstallment } from '../models/portal.models';
import { PortalService } from '../portal.service';
import { PortalAuthService } from '../auth/portal-auth.service';
import { PortalDashboardComponent } from './portal-dashboard.component';

/**
 * Devuelve la fecha local desplazada `offset` días en formato yyyy-mm-dd.
 * @param offset - días respecto de hoy (negativo = pasado)
 */
function localIso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Arma una cuota próxima de prueba.
 * @param over - campos a sobreescribir
 */
function inst(over: Partial<UpcomingInstallment>): UpcomingInstallment {
  return {
    id: 'i-1',
    installmentNumber: 1,
    dueDate: localIso(5),
    amountDue: 1000,
    amountPaid: 0,
    penaltyAmount: 0,
    status: 'PENDING',
    creditId: 'cr-1',
    creditType: 'LOAN',
    creditInstallmentsCount: 6,
    creditName: null,
    ...over,
  };
}

/**
 * Arma un resumen de cuenta con las cuotas próximas indicadas.
 * @param upcomingInstallments - cuotas a mostrar
 */
function summary(upcomingInstallments: UpcomingInstallment[]): AccountSummary {
  return {
    totalOwed: 1000,
    paidCount: 0,
    pendingCount: 1,
    overdueCount: upcomingInstallments.filter((i) => i.status === 'OVERDUE').length,
    statusIndicator: 'GREEN',
    totalPaidAmount: 0,
    pendingPenaltyAmount: 0,
    activeCredits: 1,
    settledCredits: 0,
    totalInstallmentsCount: 6,
    upcomingInstallments,
  };
}

describe('PortalDashboardComponent — próxima cuota (#55)', () => {
  let fixture: ComponentFixture<PortalDashboardComponent>;

  /**
   * Renderiza el dashboard con el resumen dado.
   * @param data - resumen que devuelve el PortalService
   */
  function render(data: AccountSummary): HTMLElement {
    TestBed.configureTestingModule({
      imports: [PortalDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: PortalService, useValue: { getAccountSummary: () => of(data) } },
        { provide: PortalAuthService, useValue: { snapshot: { fullName: 'Ana García' } } },
      ],
    });
    fixture = TestBed.createComponent(PortalDashboardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con sólo cuotas OVERDUE muestra la vencida como próxima cuota', () => {
    const el = render(
      summary([inst({ status: 'OVERDUE', dueDate: localIso(-3), amountDue: 2500 })]),
    );

    expect(fixture.componentInstance.nextPendingInstallment?.status).toBe('OVERDUE');
    const card = el.querySelector('[data-cy="portal-dashboard-next-installment-card"]')!;
    expect(card.querySelector('[data-cy="portal-dashboard-next-overdue"]')).not.toBeNull();
    expect(card.textContent).not.toContain('Sin vencimientos próximos');
  });

  it('prioriza la vencida más antigua sobre una pendiente futura', () => {
    render(
      summary([
        inst({ id: 'p', status: 'PENDING', dueDate: localIso(4) }),
        inst({ id: 'o', status: 'OVERDUE', dueDate: localIso(-10) }),
      ]),
    );

    expect(fixture.componentInstance.nextPendingInstallment?.id).toBe('o');
  });

  it('muestra "Vence hoy" cuando la cuota vence hoy', () => {
    const el = render(summary([inst({ dueDate: localIso(0) })]));

    const today = el.querySelector('[data-cy="portal-dashboard-next-due-today"]');
    expect(today?.textContent).toContain('Vence hoy');
  });

  it('muestra los días restantes para una cuota futura', () => {
    const el = render(summary([inst({ dueDate: localIso(3) })]));

    expect(el.textContent).toContain('en 3 días');
  });
});

describe('PortalDashboardComponent — lista de próximos vencimientos (#55)', () => {
  /**
   * Renderiza el dashboard y devuelve las tarjetas de la lista de vencimientos.
   * @param data - resumen que devuelve el PortalService
   */
  function listCards(data: AccountSummary): HTMLElement[] {
    TestBed.configureTestingModule({
      imports: [PortalDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: PortalService, useValue: { getAccountSummary: () => of(data) } },
        { provide: PortalAuthService, useValue: { snapshot: { fullName: 'Ana García' } } },
      ],
    });
    const fixture = TestBed.createComponent(PortalDashboardComponent);
    fixture.detectChanges();
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '[data-cy="portal-dashboard-installment-card"]',
      ),
    );
  }

  it('marca "Hoy" en la cuota de la lista que vence hoy', () => {
    const [card] = listCards(summary([inst({ dueDate: localIso(0) })]));

    expect(card.textContent).toContain('Hoy');
  });

  it('sigue mostrando los días restantes en la lista para una cuota futura', () => {
    const [card] = listCards(summary([inst({ dueDate: localIso(3) })]));

    expect(card.textContent).toContain('en 3 días');
    expect(card.textContent).not.toContain('Hoy');
  });
});
