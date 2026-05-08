/**
 * SUITE: Admin — Alta de producto
 *
 * Cubre:
 *  - Alta desde el flujo nuevo (/admin/products/new)
 *  - Redirección al detalle al registrar correctamente
 */

describe('Admin — Alta de producto', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/product-brands/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'b-034', name: 'Samsung', active: true }] },
    }).as('brands');

    cy.intercept('GET', /\/api\/product-categories/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'c-034', name: 'Electrónica', active: true }] },
    }).as('categories');

    cy.loginAs('ADMIN', '/admin/products/new');
    cy.wait('@brands');
    cy.wait('@categories');
  });

  it('redirige al detalle luego de confirmar la creación', () => {
    cy.intercept('POST', '**/api/products', (req) => {
      expect(req.body).to.include({
        title: 'PRD-004 Samsung Galaxy',
      });
      req.reply({
      statusCode: 201,
      body: {
        ok: true,
        data: {
          id: 'prod-34',
          title: 'PRD-004 Samsung Galaxy',
          description: 'Galaxy demo',
          model: 'Galaxy',
          status: 'ACTIVE',
        },
      },
      });
    }).as('createProduct');

    cy.intercept('GET', '**/api/products/prod-34*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'prod-34',
          title: 'PRD-004 Samsung Galaxy',
          description: 'Galaxy demo',
          model: 'Galaxy',
          status: 'ACTIVE',
          available_count: 0,
          reserved_count: 0,
          sold_count: 0,
          variants: [],
        },
      },
    }).as('detailProduct');

    cy.get('input[formcontrolname="title"]').type('PRD-004 Samsung Galaxy');

    cy.contains('button', 'Crear producto').click();
    cy.wait('@createProduct');
    cy.wait('@detailProduct');

    cy.url().should('include', '/admin/products/prod-34');
  });
});
