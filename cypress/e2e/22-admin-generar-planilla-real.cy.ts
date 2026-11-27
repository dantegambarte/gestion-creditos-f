/**
 * SUITE REAL: Admin — Generar Planilla de Cobro (modal en /admin/collections)
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints
 * - Verifica estructura de UI contra backend real
 */

describe('Admin — Generar Planilla de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    // Desde #39 la sesión no se restaura desde localStorage: login real.
    cy.loginReal('ADMIN', '/admin/collections');
    cy.location('pathname', { timeout: 20000 }).should('eq', '/admin/collections');
    cy.contains('button', 'Generar nueva planilla', { timeout: 20000 }).should('be.visible');
    cy.contains('button', 'Generar nueva planilla', { timeout: 15000 }).click();
    cy.contains('h2', 'Generar planilla de cobro', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Generar planilla de cobro"', () => {
    cy.contains('h2', 'Generar planilla de cobro').should('be.visible');
  });

  it('muestra bloque de impacto de generación', () => {
    // El bloque queda bajo el footer fijo del diálogo en 720px de alto: scrollear primero.
    cy.contains('Se van a generar').scrollIntoView().should('be.visible');
    cy.contains('Estado del día').scrollIntoView().should('be.visible');
  });

  it('tiene dropdown de cobrador', () => {
    cy.get('p-dropdown').should('have.length.gte', 1);
  });

  it('tiene selector de fecha', () => {
    cy.get('p-calendar').should('exist');
  });

  it('tiene filtro de cuotas', () => {
    cy.get('input[name="generateFilter"]').should('have.length.gte', 2);
  });

  it('muestra botón "Generar"', () => {
    cy.contains('button', 'Generar').should('exist');
  });

  it('botón Cancelar navega a /admin/collections', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('include', '/admin/collections');
    cy.url().should('not.include', '/new');
  });
});
