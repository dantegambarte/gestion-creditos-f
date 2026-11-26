/**
 * #60: el snapshot de caja muestra cada drop en la columna de su método real
 * (no siempre efectivo) y con la etiqueta compartida, en desktop y mobile.
 */
const interceptCashWithDrops = (): void => {
  cy.intercept('GET', '**/api/expense-categories*', {
    statusCode: 200,
    body: { ok: true, data: [] },
  });

  cy.intercept('GET', '**/api/cash-register/dashboard*', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        date: '2026-06-23',
        is_closed: false,
        cash_amount: 120000,
        transfer_amount: 85000,
        total_collected: 205000,
        total_outflows: 30000,
        approved_count: 4,
        pending_count: 0,
        net_balance: 175000,
        pending_amount: 0,
        down_payments_total: 0,
        down_payments_count: 0,
      },
    },
  }).as('dashboard');

  cy.intercept('GET', '**/api/business-days/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'bd-drops',
        business_date: '2026-06-23',
        status: 'OPEN',
        session_counts: { total_count: 1, open_count: 1, pending_count: 0, closed_count: 0 },
      },
    },
  }).as('businessDay');

  cy.intercept('GET', '**/api/cash-sessions/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'cs-drops',
        business_day_id: 'bd-drops',
        owner_user_id: 'admin-001',
        status: 'OPEN',
        opening_amount: 10000,
        cash_counted: null,
        opened_at: '2026-06-23T09:00:00.000Z',
        opened_by: 'admin-001',
        owner_name: 'QA Admin',
        shift_label: 'Central',
      },
    },
  }).as('activeSession');

  cy.intercept('GET', '**/api/cash-sessions/cs-drops/snapshot', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        session_id: 'cs-drops',
        status: 'OPEN',
        owner_user_id: 'admin-001',
        opened_at: '2026-06-23T09:00:00.000Z',
        opening: { cash: 10000, transfer: 0 },
        expected: { cash: 100000, transfer: 50000 },
        collections: {
          payments: { cash: 90000, transfer: 65000 },
          down_payments: { cash: 0, transfer: 0 },
          manual_incomes: { cash: 0, transfer: 0 },
        },
        outflows: {
          expenses: { cash: 0, transfer: 0 },
          loans: { cash: 0, transfer: 0 },
          commissions: { cash: 0, transfer: 0 },
        },
        conversions: { cash_delta: 0, transfer_delta: 0 },
        drops: {
          cash: 0,
          transfer: 15000,
          items: [{ id: 'drop-tr-0001', amount: 15000, payment_method: 'TRANSFER' }],
        },
      },
    },
  }).as('snapshot');

  cy.intercept('GET', '**/api/cash-register/sessions/cs-drops/movements', {
    statusCode: 200,
    body: { ok: true, data: [] },
  });

  cy.intercept('GET', '**/api/cash-accounts*', {
    statusCode: 200,
    body: { ok: true, data: [] },
  });
};

/** Abre el diálogo de snapshot desde el panel "Control de caja". */
const openSnapshot = (): void => {
  cy.contains('Control de caja').parents('aside').find('button').first().click();
  cy.wait('@snapshot');
  cy.get('[data-cy="cash-snapshot-dialog"]').should('be.visible');
};

describe('#60 — Snapshot de caja con método real del drop', () => {
  beforeEach(() => {
    interceptCashWithDrops();
  });

  it('desktop: un drop por transferencia va a la columna Transferencia', () => {
    cy.viewport(1280, 800);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait(['@dashboard', '@businessDay', '@activeSession']);
    openSnapshot();

    cy.get('[data-cy="cash-snapshot-drop-row"]')
      .should('have.length', 1)
      .and('contain', 'Transferencia')
      .and('not.contain', 'TRANSFER ');
    cy.get('[data-cy="cash-snapshot-drop-cash"]').should('contain', '—');
    cy.get('[data-cy="cash-snapshot-drop-transfer"]').should('contain', '15.000');
  });

  it('mobile 375x667: el drop muestra la etiqueta del método real', () => {
    cy.viewport(375, 667);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait(['@dashboard', '@businessDay', '@activeSession']);
    openSnapshot();

    cy.get('[data-cy="cash-snapshot-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-snapshot-drop-mobile"]')
      .scrollIntoView()
      .should('be.visible')
      .and('contain', 'Transferencia');
  });
});
