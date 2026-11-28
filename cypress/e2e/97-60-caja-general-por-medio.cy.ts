/**
 * #60 / backend #93: la conversión desde Caja General muestra como disponible
 * el saldo del medio de origen que devuelve el backend (cash_balance /
 * transfer_balance), no el total. Specs stubbeados, desktop y mobile.
 */

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

/** Stubea la pantalla de caja sin caja activa y Caja General con saldo por medio. */
const stubCashWithGeneralSplit = (): void => {
  cy.intercept('GET', '**/api/expense-categories*', { ok: true, data: [] });
  cy.intercept('GET', '**/api/cash-register/dashboard*', {
    ok: true,
    data: {
      date: '2026-06-23',
      is_closed: false,
      cash_amount: 0,
      transfer_amount: 0,
      total_collected: 0,
      total_outflows: 0,
      approved_count: 0,
      pending_count: 0,
      net_balance: 0,
      pending_amount: 0,
      down_payments_total: 0,
      down_payments_count: 0,
    },
  }).as('dashboard');
  cy.intercept('GET', '**/api/business-days/active', { ok: true, data: null }).as('businessDay');
  cy.intercept('GET', '**/api/cash-sessions/active', { ok: true, data: null }).as('activeSession');
  cy.intercept('GET', '**/api/cash-accounts', {
    ok: true,
    data: [
      {
        id: 'acc-general',
        name: 'Caja General',
        type: 'GENERAL_CASH',
        is_active: true,
        current_balance: 50000,
        created_at: '2026-06-15T00:00:00Z',
      },
    ],
  });
  cy.intercept('GET', '**/api/cash-accounts/acc-general/balance', {
    ok: true,
    data: {
      id: 'acc-general',
      name: 'Caja General',
      type: 'GENERAL_CASH',
      current_balance: 50000,
      cash_balance: 35000,
      transfer_balance: 15000,
    },
  }).as('generalBalance');
};

describe('#60 — Caja General: disponible por medio desde el backend', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    describe(name, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        stubCashWithGeneralSplit();
      });

      it('la conversión COMPANY muestra el disponible del medio de origen', () => {
        cy.loginAs('ADMIN', '/admin/cash-register');
        cy.wait(['@dashboard', '@activeSession']);

        cy.contains('button', 'Convertir Dinero').scrollIntoView().click();
        cy.wait('@generalBalance');
        cy.get('[data-cy="cash-conversion-dialog-body"]')
          .should('be.visible')
          .and('contain', 'Disponible')
          .and('contain', '35.000')
          .and('not.contain', '50.000');

        cy.get('.p-dialog:visible #conversion-source').parents('.p-dropdown').click();
        cy.contains('.p-dropdown-item', 'Transferencia').click();
        cy.get('[data-cy="cash-conversion-dialog-body"]').should('contain', '15.000');
      });
    });
  });
});
