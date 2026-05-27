/**
 * SUITE: Admin — Generar Planilla de Cobro (real)
 *
 * Cubre:
 *  - Render base del formulario real en /admin/collections/new
 *  - Controles principales (cobrador, fecha, filtro)
 *  - Navegacion con boton Cancelar
 */

describe('Admin — Generar Planilla de Cobro (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/collections/new');
  });

  it('muestra titulo y descripcion base del formulario', () => {
    cy.contains('Generar planilla de cobro', { timeout: 15000 }).should('be.visible');
    cy.contains('Elegí destinatario, fecha y filtro').should('be.visible');
    cy.get('app-error-state').should('not.exist');
  });

  it('renderiza controles del formulario', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
    cy.get('input').filter(':visible').should('have.length.gte', 1);
    cy.contains('button', 'Generar').should('be.visible');
  });

  it('boton Cancelar vuelve a /admin/collections', () => {
    cy.contains('button', 'Cancelar').click();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/collections');
  });
});
