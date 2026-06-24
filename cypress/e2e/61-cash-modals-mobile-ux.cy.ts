/**
 * Intercepta Caja Central con jornada/caja activa para probar modales en viewport chico.
 */
const interceptCashCentral = (): void => {
  cy.intercept('GET', '**/api/expense-categories*', {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'cat-mobile-modal-1',
          name: 'Operativo',
          color: '#ef4444',
          is_active: true,
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
    },
  }).as('cashModalExpenseCategories');

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
        pending_count: 1,
        net_balance: 175000,
        pending_amount: 15000,
        down_payments_total: 20000,
        down_payments_count: 1,
      },
    },
  }).as('cashModalDashboard');

  cy.intercept('GET', '**/api/business-days/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'business-day-cash-modal',
        business_date: '2026-06-23',
        status: 'OPEN',
        session_counts: {
          total_count: 1,
          open_count: 1,
          pending_count: 0,
          closed_count: 0,
        },
      },
    },
  }).as('cashModalBusinessDay');

  cy.intercept('GET', '**/api/cash-sessions/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'cash-session-modal-1',
        business_day_id: 'business-day-cash-modal',
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
  }).as('cashModalActiveSession');

  cy.intercept('GET', '**/api/cash-sessions/cash-session-modal-1/snapshot', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        session_id: 'cash-session-modal-1',
        status: 'OPEN',
        owner_user_id: 'admin-001',
        opened_at: '2026-06-23T09:00:00.000Z',
        opening: { cash: 10000, transfer: 0 },
        expected: { cash: 132000, transfer: 93000 },
        collections: {
          payments: { cash: 90000, transfer: 65000 },
          down_payments: { cash: 20000, transfer: 12000 },
          manual_incomes: { cash: 22000, transfer: 16000 },
        },
        outflows: {
          expenses: { cash: 8000, transfer: 4000 },
          commissions: { cash: 2000, transfer: 1000 },
        },
        conversions: { cash_delta: 0, transfer_delta: 0 },
        drops: { cash: 0, transfer: 0, items: [] },
      },
    },
  }).as('cashModalSnapshot');

  cy.intercept(
    'GET',
    '**/api/cash-register/sessions/cash-session-modal-1/movements',
    {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'mov-modal-1',
            concepto: 'Cobro cuota #4',
            fecha_hora: '2026-06-23T10:30:00.000Z',
            responsable: 'Cobrador Modal',
            tipo: 'INGRESO',
            monto: 57000,
            metodo_pago: 'EFECTIVO',
          },
          {
            id: 'mov-modal-2',
            concepto: 'Gasto operativo largo',
            fecha_hora: '2026-06-23T11:30:00.000Z',
            responsable: 'QA Admin',
            tipo: 'EGRESO',
            monto: 12000,
            metodo_pago: 'TRANSFERENCIA',
          },
        ],
      },
    },
  ).as('cashModalMovements');

  cy.intercept('GET', '**/api/cash-accounts*', {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'general-cash-modal',
          name: 'Caja General',
          type: 'GENERAL_CASH',
          is_active: true,
          current_balance: 450000,
          created_at: '2026-06-01T00:00:00.000Z',
        },
      ],
    },
  }).as('cashModalAccounts');

  cy.intercept('POST', '**/api/expenses', {
    statusCode: 200,
    body: { ok: true, data: { id: 'expense-modal-1' } },
  }).as('createExpenseModal');
};

describe('Caja Central — Modales Mobile iPhone SE', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
    interceptCashCentral();
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait([
      '@cashModalDashboard',
      '@cashModalBusinessDay',
      '@cashModalActiveSession',
    ]);
  });

  it('Movimientos de la Jornada usa cards mobile y oculta tabla en modal', () => {
    cy.contains('button', 'Ver todos los movimientos').scrollIntoView().click();

    cy.get('[data-cy="cash-movements-dialog"]').should('be.visible');
    cy.get('[data-cy="cash-movements-dialog-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-movements-dialog-mobile-list"]').contains(
      'Cobro cuota #4',
    );
  });

  it('Snapshot X report usa cards mobile y oculta tabla en iPhone SE', () => {
    cy.contains('Control de caja')
      .parents('aside')
      .find('button')
      .first()
      .click();
    cy.wait('@cashModalSnapshot');

    cy.get('[data-cy="cash-snapshot-dialog"]').should('be.visible');
    cy.get('[data-cy="cash-snapshot-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-snapshot-mobile-list"]')
      .contains('Cobros · pagos aprobados');
    cy.get('[data-cy="cash-snapshot-dialog-body"]').scrollTo('bottom');
    cy.get('[data-cy="cash-snapshot-mobile-list"]').contains('Esperado en caja');
  });

  it('Registrar Gasto mantiene referencia y acción principal accesibles al usar transferencia', () => {
    cy.contains('button', 'Registrar Gasto').scrollIntoView().click();

    cy.get('[data-cy="expense-side-panel"]').should('be.visible');
    cy.get('[data-cy="expense-side-panel"] input').first().clear().type('1500');
    cy.get(
      '[data-cy="expense-side-panel"] input[placeholder="Descripción del gasto..."]',
    )
      .clear()
      .type('Gasto QA mobile');
    cy.get('[data-cy="expense-payment-transfer-option"]').click();
    cy.get('[data-cy="expense-side-panel-body"]').scrollTo('bottom');
    cy.get('[data-cy="expense-transfer-reference-input"]')
      .should('be.visible')
      .type('TRX-IPHONE-SE');
    cy.get('[data-cy="expense-submit-action"] button')
      .should('be.visible')
      .and('not.be.disabled');
  });

  it('Convertir Dinero mantiene footer visible y body scrolleable', () => {
    cy.contains('button', 'Convertir Dinero').scrollIntoView().click();

    cy.get('[data-cy="cash-conversion-dialog"]').should('be.visible');
    cy.get('[data-cy="cash-conversion-dialog-body"]').scrollTo('bottom', {
      ensureScrollable: false,
    });
    cy.get('[data-cy="cash-conversion-dialog"]')
      .find('footer button')
      .last()
      .should('be.visible');
    cy.get('#conversion-notes').should('be.visible');
  });

  it('Cierre de Caja usa cards mobile y mantiene acción inferior visible', () => {
    cy.get('[data-cy="admin-cash-register-close-day-cta"]')
      .scrollIntoView()
      .click();
    cy.wait('@cashModalSnapshot');

    cy.get('[data-cy="cash-close-dialog"]').should('be.visible');
    cy.get('[data-cy="cash-close-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-close-mobile-list"]').contains('Efectivo');
    cy.get('[data-cy="cash-close-dialog-body"]').scrollTo('bottom');
    cy.get('[data-cy="cash-close-submit-action"]')
      .should('be.visible')
      .and('be.disabled');
  });
});
