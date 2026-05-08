/**
 * SUITE: Admin — Crear Producto (/admin/products/new)
 *
 * Cubre:
 *  - Título "Nuevo producto"
 *  - Campos del formulario (título, descripción, modelo, marca, categoría)
 *  - Validación: botón deshabilitado con form vacío
 *  - Validación: error al tocar campo título vacío
 *  - Botón Cancelar navega de vuelta
 *  - Formulario completo habilita Guardar
 */

describe('Admin — Crear Producto', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/product-brands/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'b-001', name: 'EcoMoto' }] },
    }).as('brands');

    cy.intercept('GET', /\/api\/product-categories/, {
      statusCode: 200,
      body: { ok: true, data: [{ id: 'c-001', name: 'Vehículos' }] },
    }).as('categories');

    cy.loginAs('ADMIN', '/admin/products/new');
    cy.wait('@brands');
    cy.wait('@categories');
  });

  it('muestra el título "Nuevo producto"', () => {
    cy.contains('h1', 'Nuevo producto').should('be.visible');
  });

  it('tiene el campo título', () => {
    cy.get('input[formcontrolname="title"]').should('exist');
  });

  it('tiene el campo descripción', () => {
    cy.get('textarea[formcontrolname="description"]').should('exist');
  });

  it('tiene el campo modelo', () => {
    cy.get('input[formcontrolname="model"]').should('exist');
  });

  it('botón Crear producto deshabilitado con formulario vacío', () => {
    cy.contains('button', 'Crear producto').should('be.disabled');
  });

  it('tocar campo título sin completar muestra error', () => {
    cy.get('input[formcontrolname="title"]').click().blur();
    cy.contains('small', 'Este campo es requerido.').should('exist');
  });

  it('botón Cancelar navega a la lista de productos', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('include', '/admin/products');
    cy.url().should('not.include', '/new');
  });

  it('completar el título habilita el botón Crear producto', () => {
    cy.get('input[formcontrolname="title"]').type('Producto E2E Test');
    cy.contains('button', 'Crear producto').should('not.be.disabled');
  });
});
