/**
 * SUITE: Admin — Crear Producto (real backend)
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

    cy.loginReal('ADMIN', '/seller/products/new');
  });

  it('muestra el título "Nuevo producto"', () => {
    cy.contains('h1, h2', 'Nuevo producto').should('be.visible');
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
    cy.url().should('include', '/seller/products');
    cy.url().should('not.include', '/new');
  });

  it('completar el título habilita el botón Crear producto', () => {
    cy.get('input[formcontrolname="title"]').type('Producto E2E Test');
    cy.contains('button', 'Crear producto').should('not.be.disabled');
  });
});
