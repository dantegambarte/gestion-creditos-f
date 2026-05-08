/**
 * SUITE: Seller — Productos
 *
 * Cubre:
 *  - Lista de productos con filtros (texto, estado, categoría)
 *  - Botón "Nuevo producto" (visible solo para ADMIN)
 *  - Acceso de SELLER sin botón crear
 *  - Tabla o estado vacío
 */

function stubListData(): void {
  cy.intercept('GET', '**/api/product-categories*', {
    statusCode: 200,
    body: { ok: true, data: [{ id: 'cat-15', name: 'Electrónica', active: true }] },
  }).as('categories');

  cy.intercept('GET', '**/api/products*', {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'prod-15',
          title: 'Moto G84',
          description: 'Smartphone demo',
          model: 'G84',
          status: 'ACTIVE',
          category_id: 'cat-15',
          category_name: 'Electrónica',
          brand_id: null,
          brand_name: null,
          available_count: 2,
          reserved_count: 1,
          sold_count: 0,
          variants: [{ id: 'var-15', color: 'Negro', size: null, capacity: '256GB', current_price: 1000, status: 'ACTIVE' }],
        },
      ],
    },
  }).as('products');
}

describe('Admin — Lista de Productos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubListData();
    cy.loginAs('ADMIN', '/seller/products');
    cy.wait('@categories');
    cy.wait('@products');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra campo de búsqueda por título o descripción', () => {
    cy.get('input[placeholder*="Buscar por título o descripción"]').should('exist');
  });

  it('muestra dropdown de filtro por Estado', () => {
    cy.get('p-dropdown').should('have.length.gte', 1);
  });

  it('muestra dropdown de filtro por Categoría', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
  });

  it('el botón "Nuevo producto" es visible para ADMIN', () => {
    cy.contains('button', 'Nuevo producto').should('exist');
  });

  it('clic en "Nuevo producto" navega al formulario', () => {
    cy.contains('button', 'Nuevo producto').should('be.visible').click();
    cy.url().should('include', '/seller/products/new');
  });

  it('muestra tabla o estado vacío (no error)', () => {
    cy.get('p-table, app-empty-state, app-loading-state').should('exist');
  });
});

describe('Seller — Lista de Productos (sin botón crear)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubListData();
    cy.loginAs('SELLER', '/seller/products');
    cy.wait('@categories');
    cy.wait('@products');
  });

  it('SELLER no ve el botón "Nuevo producto"', () => {
    cy.contains('button', 'Nuevo producto').should('not.exist');
  });

  it('muestra campo de búsqueda', () => {
    cy.get('input[placeholder*="Buscar por título o descripción"]').should('exist');
  });
});
