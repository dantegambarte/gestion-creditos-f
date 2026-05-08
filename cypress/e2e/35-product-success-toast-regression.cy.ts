/**
 * SUITE: Admin — Toast de alta producto
 *
 * Cubre:
 *  - Feedback visual de éxito al registrar producto
 */

describe('Admin — Toast de alta producto', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/product-brands/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'b-035', name: 'Motorola', active: true }] },
    }).as('brands');

    cy.intercept('GET', /\/api\/product-categories/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'c-035', name: 'Electrónica', active: true }] },
    }).as('categories');

    cy.loginAs('ADMIN', '/admin/products/new');
    cy.wait('@brands');
    cy.wait('@categories');
  });

  it('muestra el mensaje de éxito luego de guardar el producto', () => {
    cy.intercept('POST', '**/api/products', {
      statusCode: 201,
      body: {
        ok: true,
        data: {
          id: 'prod-35',
          title: 'PRD-005 Motorola Edge',
          description: 'Motorola demo',
          model: 'Edge',
          status: 'ACTIVE',
        },
      },
    }).as('createProduct');

    cy.get('input[formcontrolname="title"]').type('PRD-005 Motorola Edge');

    cy.contains('button', 'Crear producto').click();
    cy.wait('@createProduct');

    cy.contains('.p-toast-message', 'Producto registrado correctamente.').should('be.visible');
  });
});
