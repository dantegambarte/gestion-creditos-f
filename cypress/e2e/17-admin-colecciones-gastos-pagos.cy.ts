/**
 * SUITE: Admin — Planillas de Cobro, Gastos y Cobros (Payments)
 *
 * Cubre:
 *  - Admin Collections: título, filtros, botón generar planilla
 *  - Admin Expenses: título, botones de acción, panel de categorías
 *  - Admin Payments: título, filtros, botón refresh
 */

describe('Admin — Planillas de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'collector-1',
            full_name: 'Cobrador Demo',
            dni: '30111222',
            email: 'collector@example.com',
            address: 'Calle 123',
            role: 'COLLECTOR',
            status: 'ACTIVE',
            is_temp_password: false,
            failed_attempts: 0,
            locked_at: null,
            last_login_at: null,
            created_at: '2026-05-05T10:00:00.000Z',
          },
        ],
      },
    }).as('collectionsUsers');

    cy.intercept('GET', '**/api/collections*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('collectionsList');

    cy.loginAs('ADMIN', '/admin/collections');
    cy.wait('@collectionsUsers');
    cy.wait('@collectionsList');
  });

  it('muestra el título "Planillas de cobro"', () => {
    cy.contains('h1', 'Planillas de cobro').should('be.visible');
  });

  it('muestra el botón "Generar planilla"', () => {
    cy.contains('button', 'Generar planilla').should('exist');
  });

  it('tiene dropdown de filtro por cobrador', () => {
    cy.get('p-dropdown').should('exist');
  });

  it('tiene input de filtro por fecha', () => {
    cy.get('input[type="date"]').should('exist');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('clic en "Generar planilla" navega a /new', () => {
    cy.contains('button', 'Generar planilla').click();
    cy.url().should('include', '/collections/new');
  });
});

describe('Admin — Gastos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/expense-categories*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cat-1',
            name: 'Insumos',
            active: true,
            created_at: '2026-05-05T10:00:00.000Z',
          },
        ],
      },
    }).as('expenseCategories');

    cy.intercept('GET', '**/api/expenses*', {
      statusCode: 200,
      body: { ok: true, data: { rows: [], total: 0 } },
    }).as('expensesList');

    cy.loginAs('ADMIN', '/admin/expenses');
    cy.wait('@expenseCategories');
    cy.wait('@expensesList');
  });

  it('muestra el título "Gastos"', () => {
    cy.contains('h1', 'Gastos').should('be.visible');
  });

  it('muestra botón "Registrar gasto"', () => {
    cy.contains('button', 'Registrar gasto').should('exist');
  });

  it('muestra botón para gestionar categorías', () => {
    cy.contains('button', /categoría/i).should('exist');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('al hacer clic en "Gestionar categorías" muestra el panel', () => {
    cy.contains('button', 'Gestionar categorías').click();
    cy.contains('Categorías de gastos').should('be.visible');
  });

  it('el panel de categorías tiene botón "Nueva categoría"', () => {
    cy.contains('button', 'Gestionar categorías').click();
    cy.contains('button', 'Nueva categoría').should('exist');
  });
});

describe('Admin — Cobros (Payments)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'collector-1',
            full_name: 'Cobrador Demo',
            dni: '30111222',
            email: 'collector@example.com',
            address: 'Calle 123',
            role: 'COLLECTOR',
            status: 'ACTIVE',
            is_temp_password: false,
            failed_attempts: 0,
            locked_at: null,
            last_login_at: null,
            created_at: '2026-05-05T10:00:00.000Z',
          },
        ],
      },
    }).as('paymentsUsers');

    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('paymentsList');

    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait('@paymentsUsers');
    cy.wait('@paymentsList');
  });

  it('muestra el título "Cobros"', () => {
    cy.contains('h1', 'Cobros').should('be.visible');
  });

  it('muestra el botón de refresh', () => {
    cy.get('p-button[icon="pi pi-refresh"]').should('exist');
  });

  it('tiene dropdowns de filtro', () => {
    cy.get('p-dropdown', { timeout: 12000 }).should('have.length.at.least', 2);
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });
});
