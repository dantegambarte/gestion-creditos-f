/**
 * SUITE: Admin — Crear producto (/admin/products/new)
 *
 * Cubre:
 *  - Navegación desde listado a pantalla de alta
 *  - Botón "Crear producto" deshabilitado con formulario incompleto
 *  - Botón habilitado al completar el campo requerido (título)
 */

describe('Admin — Crear producto', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/product-brands/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'b-033', name: 'Samsung', active: true }] },
    }).as('brands');

    cy.intercept('GET', /\/api\/product-categories/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'c-033', name: 'Electrónica', active: true }] },
    }).as('categories');

    cy.loginAs('ADMIN', '/admin/products/new');
    cy.wait('@brands');
    cy.wait('@categories');
  });

  it('mantiene Crear producto deshabilitado hasta completar los campos requeridos', () => {
    cy.contains('button', 'Crear producto').should('be.disabled');

    cy.get('input[formcontrolname="title"]').type('PRD-006 Samsung A16');

    cy.contains('button', 'Crear producto').should('not.be.disabled');
  });
});
