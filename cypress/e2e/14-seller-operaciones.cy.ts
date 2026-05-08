/**
 * SUITE: Seller — Lista de Operaciones (Créditos)
 *
 * Cubre:
 *  - Render de la lista con filtros de Estado y Tipo
 *  - Botón "Nueva operación" visible para SELLER
 *  - Estado vacío / tabla con datos
 *  - Navegación al wizard de creación
 */

describe('Seller — Lista de Operaciones', () => {
  const creditsMock = [
    {
      id: 'crd-001',
      type: 'SALE',
      total_amount: 120000,
      installments_count: 12,
      payment_frequency: 'WEEKLY',
      interest_rate: 10,
      status: 'ACTIVE',
      created_at: '2026-02-01T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-001',
      customer_name: 'Juan Perez Garcia',
      customer_dni: '22334455',
      created_by_id: 'usr-002',
      created_by_name: 'Maria Sanchez',
    },
    {
      id: 'crd-002',
      type: 'LOAN',
      total_amount: 90000,
      installments_count: 6,
      payment_frequency: 'MONTHLY',
      interest_rate: 15,
      status: 'PENDING_APPROVAL',
      created_at: '2026-02-10T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-002',
      customer_name: 'Laura Gomez',
      customer_dni: '11223344',
      created_by_id: 'usr-002',
      created_by_name: 'Maria Sanchez',
    },
  ];

  function stubCreditsList(): void {
    cy.intercept('GET', /\/api\/credits(\?.*)?$/, (req) => {
      const status = req.query['status'];
      const type = req.query['type'];

      const filtered = creditsMock.filter((credit) => {
        if (status && credit.status !== status) return false;
        if (type && credit.type !== type) return false;
        return true;
      });

      req.reply({ statusCode: 200, body: { ok: true, data: filtered } });
    }).as('creditsList');
  }

  beforeEach(() => {
    cy.viewport(1280, 720);
    stubCreditsList();
    cy.loginAs('SELLER', '/seller/operations');
    cy.wait('@creditsList');
  });

  it('renderiza la página sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el dropdown de filtro por Estado', () => {
    cy.get('p-dropdown').first().should('exist');
  });

  it('muestra el dropdown de filtro por Tipo', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
  });

  it('el botón "Nueva operación" es visible para SELLER', () => {
    cy.contains('button', 'Nueva operación').should('exist');
  });

  it('clic en "Nueva operación" navega al wizard', () => {
    cy.contains('button', 'Nueva operación').should('be.visible').click();
    cy.url().should('include', '/seller/operations/new');
  });

  it('muestra tabla o estado vacío (no error)', () => {
    cy.get('p-table, app-empty-state, app-loading-state').should('exist');
  });
});

describe('Admin — Lista de Operaciones (misma vista vía /admin)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/operations');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('botón "Nueva operación" existe para ADMIN', () => {
    cy.contains('button', 'Nueva Operación').should('exist');
  });

  it('CR-07: filtra operaciones por estado Activo', () => {
    cy.get('p-dropdown').first().click();
    cy.contains('.p-dropdown-item', 'Activo').click();

    cy.get('p-table tbody tr').should('have.length', 1);
    cy.get('p-table tbody tr').first().should('contain.text', 'ACTIVO');
  });

  it('CR-08: filtra por cliente al buscar "Perez"', () => {
    cy.get('input[placeholder="Buscar..."]')
      .clear()
      .type('Perez');

    cy.get('p-table tbody tr').should('have.length', 1);
    cy.get('p-table tbody tr').first().should('contain.text', 'Juan Pérez García');
  });
});
