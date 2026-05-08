/**
 * SUITE: Admin — Edición y categoría en productos (/admin/products)
 *
 * Cubre:
 *  - La tabla muestra categoría
 *  - La acción Editar navega al formulario de edición
 */

describe('Admin — Edición y categoría en productos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/product-categories*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [{ id: 'cat-36', name: 'Electrónica', active: true }],
      },
    }).as('categories');

    cy.intercept('GET', '**/api/products*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'prod-36',
            title: 'Moto G84',
            description: 'Smartphone demo',
            model: null,
            status: 'ACTIVE',
            category_id: 'cat-36',
            category_name: 'Electrónica',
            brand_id: null,
            brand_name: null,
            available_count: 1,
            reserved_count: 0,
            sold_count: 0,
            variants: [
              {
                id: 'var-36',
                color: null,
                size: null,
                capacity: null,
                current_price: 3200,
                status: 'ACTIVE',
              },
            ],
          },
        ],
      },
    }).as('products');

    cy.loginAs('ADMIN', '/admin/products');
  });

  it('muestra la categoría y permite navegar a editar', () => {
    cy.wait('@categories');
    cy.wait('@products');

    cy.contains('td', 'Electrónica').should('be.visible');
    cy.contains('a', 'Editar').should('be.visible').click();
    cy.url().should('include', '/admin/products/prod-36/edit');
  });
});
