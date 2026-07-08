// ── Helpers ──────────────────────────────────────────────────────────────────

const makePayments = (count: number) => ({
  ok: true,
  data: Array.from({ length: count }, (_, i) => ({
    id: `pay-fab-${i}`,
    installment_id: `inst-fab-${i}`,
    amount_received: 10000,
    amount_cash: 10000,
    amount_transfer: 0,
    payment_method: 'CASH',
    transfer_reference: null,
    status: 'PENDING',
    rejection_reason: null,
    notes: null,
    created_at: '2026-06-23T10:00:00.000Z',
    approved_at: null,
    approved_by: null,
    installment_number: i + 1,
    amount_due: 10000,
    due_date: '2026-06-20',
    credit_id: `credit-fab-${i}`,
    credit_type: 'LOAN',
    customer_name: `Cliente FAB ${i + 1}`,
    customer_dni: `4000000${i}`,
    collector_name: 'Cobrador FAB',
    is_reversal: false,
    admin_direct: false,
    parent_payment_id: null,
    reversal_payment_id: null,
  })),
});

const makeCredits = (count: number) => ({
  ok: true,
  data: Array.from({ length: count }, (_, i) => ({
    id: `cred-fab-${i}`,
    customer_name: `Cliente Crédito FAB ${i + 1}`,
    customer_dni: `4100000${i}`,
    type: 'LOAN',
    total_amount: 50000,
    installments_count: 12,
    payment_frequency: 'MONTHLY',
    status: 'ACTIVE',
    approved_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
  })),
});

const makeSheets = (count: number) => ({
  ok: true,
  data: Array.from({ length: count }, (_, i) => ({
    id: `sheet-fab-${i}`,
    sheet_date: '2026-06-23',
    filter_used: 'ALL',
    status: 'ACTIVE',
    created_at: '2026-06-23T06:00:00.000Z',
    sent_at: null,
    collector_id: 'collector-fab-1',
    collector_name: 'Cobrador FAB',
    total_items: 5,
  })),
});

const FAB_SCROLL_THRESHOLD = 600; // > 520px component threshold

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Back-to-Top FAB — comportamiento de scroll mobile', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  // ── Admin Payments — cobertura completa del comportamiento ─────────────────
  describe('Admin Payments (admin-payments-back-top-action)', () => {
    const setup = (count: number) => {
      cy.intercept('GET', '**/api/payments*', makePayments(count)).as('payments');
      cy.intercept('GET', '**/api/users*', { ok: true, data: [] }).as('users');
      cy.loginAs('ADMIN', '/admin/payments');
      cy.wait('@payments');
    };

    it('FAB no existe cuando hay ≤5 ítems', () => {
      setup(3);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('not.exist');
    });

    it('FAB no es visible antes de scrollear, aunque haya >5 ítems', () => {
      setup(6);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('not.exist');
    });

    it('FAB aparece al scrollear más de 520px con >5 ítems', () => {
      setup(6);
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('be.visible');
    });

    it('FAB desaparece al volver al tope de la pantalla', () => {
      setup(6);
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('be.visible');
      cy.get('.ff-shell__main').scrollTo(0, 0);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('not.exist');
    });

    it('click en FAB vuelve el scroll al tope', () => {
      setup(6);
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="admin-payments-back-top-action"]').should('be.visible').click();
      cy.get('.ff-shell__main').then(($el) => {
        expect($el[0].scrollTop).to.equal(0);
      });
      cy.get('[data-cy="admin-payments-back-top-action"]').should('not.exist');
    });
  });

  // ── Seller Credits List — smoke del rol Seller ────────────────────────────
  describe('Seller Créditos (credits-list-back-top-action)', () => {
    it('FAB aparece con >5 créditos y scrollea al tope al hacer click', () => {
      cy.intercept('GET', '**/api/credits*', makeCredits(6)).as('credits');
      cy.loginAs('SELLER', '/seller/operations');
      cy.wait('@credits');

      cy.get('[data-cy="credits-list-back-top-action"]').should('not.exist');
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="credits-list-back-top-action"]').should('be.visible').click();
      cy.get('.ff-shell__main').then(($el) => {
        expect($el[0].scrollTop).to.equal(0);
      });
    });

    it('FAB no existe con ≤5 créditos', () => {
      cy.intercept('GET', '**/api/credits*', makeCredits(2)).as('credits');
      cy.loginAs('SELLER', '/seller/operations');
      cy.wait('@credits');
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="credits-list-back-top-action"]').should('not.exist');
    });
  });

  // ── Collector Route — smoke del rol Collector ─────────────────────────────
  describe('Collector Mi Ruta (collector-route-back-top-action)', () => {
    it('FAB aparece con >5 planillas y scrollea al tope al hacer click', () => {
      cy.intercept('GET', '**/api/collections*', makeSheets(6)).as('sheets');
      cy.intercept('GET', '**/api/payments*', { ok: true, data: [] }).as('recentPayments');
      cy.loginAs('COLLECTOR', '/collector/route');
      cy.wait('@sheets');

      cy.get('[data-cy="collector-route-back-top-action"]').should('not.exist');
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="collector-route-back-top-action"]').should('be.visible').click();
      cy.get('.ff-shell__main').then(($el) => {
        expect($el[0].scrollTop).to.equal(0);
      });
    });

    it('FAB no existe con ≤5 planillas', () => {
      cy.intercept('GET', '**/api/collections*', makeSheets(4)).as('sheets');
      cy.intercept('GET', '**/api/payments*', { ok: true, data: [] }).as('recentPayments');
      cy.loginAs('COLLECTOR', '/collector/route');
      cy.wait('@sheets');
      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="collector-route-back-top-action"]').should('not.exist');
    });
  });

  // ── Admin Clients (shared component) — verifica que la ruta compartida tiene FAB
  describe('Admin Clientes (admin-clients-back-top-action)', () => {
    it('FAB aparece con >5 clientes luego de scrollear', () => {
      cy.intercept('GET', '**/api/customers*', {
        ok: true,
        data: Array.from({ length: 6 }, (_, i) => ({
          id: `cust-fab-${i}`,
          full_name: `Cliente Shared FAB ${i + 1}`,
          dni: `4200000${i}`,
          phone: '11-0000-0000',
          address: 'Calle Falsa 123',
          city: 'Buenos Aires',
          status: 'ACTIVE',
          collector_id: null,
          collector_name: null,
          created_at: '2026-06-01T00:00:00.000Z',
        })),
      }).as('customers');
      cy.intercept('GET', '**/api/users*', { ok: true, data: [] }).as('users');

      cy.loginAs('ADMIN', '/admin/clients');
      cy.wait('@customers');

      cy.get('.ff-shell__main').scrollTo(0, FAB_SCROLL_THRESHOLD);
      cy.get('[data-cy="admin-clients-back-top-action"]').should('be.visible');
    });
  });
});
