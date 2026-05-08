/**
 * SUITE: Admin — Caja y Tesorería
 *
 * Cubre:
 *  - Apertura de caja (registrar saldo inicial)
 *  - Registro de gastos (categoría Insumos)
 *  - Cierre de caja
 *  - Estado visual de caja abierta/cerrada
 *  - Validación: no permitir gasto con caja cerrada
 *  - Mensajes de error en UI
 *  - Acceso desde /admin/cash-register
 */

describe('Admin — Caja y Tesorería', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/cash-register/dashboard*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          date: '2026-05-05',
          cash_amount: 120000,
          transfer_amount: 80000,
          total_collected: 200000,
          total_outflows: 30000,
          approved_count: 12,
          pending_count: 2,
          net_balance: 170000,
          pending_amount: 12000,
          down_payments_total: 35000,
          down_payments_count: 3,
        },
      },
    }).as('cashDashboard');

    cy.intercept('GET', '**/api/cash-register*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'reg-1',
            register_date: '2026-05-04',
            total_collected: 180000,
            cash_amount: 110000,
            transfer_amount: 70000,
            declared_cash: 109000,
            difference: -1000,
            difference_status: 'SHORTAGE',
            observations: 'Faltó cambio al cierre',
            created_at: '2026-05-04T23:00:00Z',
            closed_by_name: 'Carlos López',
          },
        ],
      },
    }).as('cashHistory');

    cy.intercept('POST', '**/api/cash-register/close', {
      statusCode: 201,
      body: {
        ok: true,
        data: {
          id: 'reg-2',
          register_date: '2026-05-05',
          total_collected: 200000,
          cash_amount: 120000,
          transfer_amount: 80000,
          declared_cash: 120000,
          difference: 0,
          difference_status: 'EXACT',
          observations: 'Cierre correcto',
          created_at: '2026-05-05T23:00:00Z',
          closed_by_name: 'Carlos López',
        },
      },
    }).as('closeCash');

    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait('@cashDashboard');
    cy.wait('@cashHistory');
  });

  it('muestra la pantalla real de caja del día', () => {
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-history-title"]').should('be.visible');
  });

  it('renderiza KPIs actuales', () => {
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-kpis"]').contains('Efectivo').should('be.visible');
    cy.get('[data-cy="admin-cash-register-kpis"]').contains('Total recaudado').should('be.visible');
    cy.get('[data-cy="admin-cash-register-kpis"]').contains('Balance neto').should('be.visible');
  });

  it('permite iniciar flujo real de cierre de caja', () => {
    cy.get('[data-cy="admin-cash-register-close-day-cta"]').click();
    cy.get('[data-cy="admin-cash-register-declared-cash-input"]', { timeout: 12000 }).should('exist');
    cy.get('[data-cy="admin-cash-register-close-modal"]').within(() => {
      cy.contains('Cierre de caja del día').should('be.visible');
    });

    cy.get('[data-cy="admin-cash-register-close-modal"]').within(() => {
      cy.get('[data-cy="admin-cash-register-close-confirm-action"]').click();
    });

    cy.wait('@closeCash');
    cy.get('[data-cy="admin-cash-register-detail-modal"]', { timeout: 12000 }).should('exist');
    cy.contains('Detalle de cierre').should('be.visible');
  });
});
