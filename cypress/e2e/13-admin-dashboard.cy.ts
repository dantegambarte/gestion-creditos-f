/**
 * SUITE: Admin — Dashboard
 *
 * Cubre:
 *  - Banner de bienvenida con nombre de usuario
 *  - KPI Cards (skeleton o cards reales)
 *  - Sección de gráficos
 *  - Tabla de operaciones recientes
 */

describe('Admin — Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/reports/summary', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          active_portfolio_balance: 950000,
          pending_credits_count: 3,
          overdue_count: 2,
          today_collected: 120000,
        },
      },
    }).as('summary');

    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cred-01',
            type: 'SALE',
            total_amount: 100000,
            installments_count: 10,
            payment_frequency: 'WEEKLY',
            interest_rate: 0,
            status: 'ACTIVE',
            created_at: '2026-05-01T00:00:00Z',
            approved_at: '2026-05-01T00:00:00Z',
            customer_id: 'cust-1',
            customer_name: 'Ana García',
            customer_dni: '12345678',
            created_by_id: 'usr-001',
            created_by_name: 'Carlos López',
          },
        ],
      },
    }).as('credits');

    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.wait('@summary');
    cy.wait('@credits');
  });

  it('renderiza la grilla KPI actual', () => {
    cy.contains('Cartera Activa').should('be.visible');
    cy.contains('Pend. Aprobación').should('be.visible');
    cy.contains('En Mora').should('be.visible');
    cy.contains('Cobrado Hoy').should('be.visible');
  });

  it('muestra panel de últimas operaciones con tabla', () => {
    cy.contains('Últimas operaciones').should('be.visible');
    cy.get('p-table').should('be.visible');
    cy.get('p-table tbody tr').should('have.length.gte', 1);
  });

  it('muestra el panel de próximos vencimientos', () => {
    cy.contains('Próximos vencimientos').should('be.visible');
    cy.contains('Sin datos').should('be.visible');
  });
});
