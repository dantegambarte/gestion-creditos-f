/**
 * SUITE: Cobranzas — Collector Route (real)
 *
 * Cubre:
 *  - Acceso real de collector a /collector/route
 *  - Render base del listado de planillas
 *  - Navegacion al detalle cuando existe al menos una planilla
 *  - Persistencia de ruta al recargar
 */

describe('Cobranzas — Collector Route (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('COLLECTOR', '/collector/route');
  });

  it('renderiza la pantalla de ruta de cobro sin estado de error', () => {
    cy.contains('h1', 'Mi Ruta de Cobro', { timeout: 15000 }).should('be.visible');
    cy.contains('Mis planillas').should('be.visible');
    cy.get('p-table').should('exist');
    cy.get('app-error-state').should('not.exist');
  });

  it('mantiene acceso a /collector/route luego de recargar', () => {
    cy.reload();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/collector/route');
    cy.contains('h1', 'Mi Ruta de Cobro').should('be.visible');
  });

  it('si hay planillas permite navegar al detalle y volver', () => {
    cy.get('body').then(($body) => {
      const hasSheetButton = $body.find('button:contains("Ver planilla")').length > 0;

      if (!hasSheetButton) {
        cy.contains('Mis planillas').should('be.visible');
        return;
      }

      cy.contains('button', 'Ver planilla').first().click();
      cy.location('pathname', { timeout: 15000 }).should('match', /\/collector\/route\/.+/);
      cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

      cy.contains('button', 'Volver').click();
      cy.location('pathname', { timeout: 15000 }).should('eq', '/collector/route');
    });
  });
});
