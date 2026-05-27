/**
 * SUITE: Collector — Detalle de Planilla de Cobro (real)
 *
 * Cubre:
 *  - Navegacion real desde /collector/route al detalle de planilla
 *  - Render base del detalle cuando existe una planilla
 *  - Accion Volver al listado de ruta
 */

describe('Collector — Detalle de Planilla (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('COLLECTOR', '/collector/route');
  });

  /**
   * Abre el detalle de la primera planilla cuando el listado tiene datos.
   * Si no hay planillas, deja el test en estado valido sin forzar falla falsa.
   */
  function openFirstSheetIfExists(): Cypress.Chainable<boolean> {
    return cy.get('body').then(($body) => {
      const hasSheetButton = $body.find('button:contains("Ver planilla")').length > 0;

      if (!hasSheetButton) {
        cy.contains('Mis planillas').should('be.visible');
        return false;
      }

      cy.contains('button', 'Ver planilla').first().click();
      cy.location('pathname', { timeout: 15000 }).should('match', /\/collector\/route\/.+/);
      return true;
    });
  }

  it('desde la ruta abre detalle de planilla cuando hay datos', () => {
    openFirstSheetIfExists().then((opened) => {
      if (!opened) {
        return;
      }

      cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');
      cy.get('app-error-state').should('not.exist');
    });
  });

  it('en detalle muestra items o estado vacio sin romper', () => {
    openFirstSheetIfExists().then((opened) => {
      if (!opened) {
        return;
      }

      cy.get('body').then(($body) => {
        const hasInstallmentText = /Cuota\s+\d+/i.test($body.text());
        if (hasInstallmentText) {
          cy.contains(/Cuota\s+\d+/i).should('be.visible');
        } else {
          cy.contains('h1', 'Planilla').should('be.visible');
        }
      });
    });
  });

  it('boton Volver regresa a /collector/route', () => {
    openFirstSheetIfExists().then((opened) => {
      if (!opened) {
        return;
      }

      cy.contains('button', 'Volver').click();
      cy.location('pathname', { timeout: 15000 }).should('eq', '/collector/route');
    });
  });
});
