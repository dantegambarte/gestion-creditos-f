/**
 * SUITE: Admin — Detalle de Planilla de Cobro (real)
 *
 * Cubre:
 *  - Navegacion real desde /admin/collections al detalle de planilla
 *  - Render base del detalle
 *  - Regreso al listado mediante boton Volver
 */

describe('Admin — Detalle de Planilla de Cobro (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/collections');
  });

  /**
   * Abre el detalle de la primera planilla si existe en el listado.
   * Devuelve false cuando no hay planillas para mantener el flujo idempotente.
   */
  function openFirstSheetIfExists(): Cypress.Chainable<boolean> {
    return cy.get('body').then(($body) => {
      const hasSheetButton = $body.find('button:contains("Ver planilla")').length > 0;

      if (!hasSheetButton) {
        cy.contains('Planillas de cobro').should('be.visible');
        return false;
      }

      cy.contains('button', 'Ver planilla').first().click();
      cy.location('pathname', { timeout: 15000 }).should('match', /\/admin\/collections\/.+/);
      return true;
    });
  }

  it('abre detalle de planilla desde el listado cuando hay datos', () => {
    openFirstSheetIfExists().then((opened) => {
      if (!opened) {
        return;
      }

      cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');
      cy.get('app-error-state').should('not.exist');
    });
  });

  it('en detalle muestra informacion base sin romper', () => {
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

  it('boton Volver regresa a /admin/collections', () => {
    openFirstSheetIfExists().then((opened) => {
      if (!opened) {
        return;
      }

      cy.contains('button', 'Volver').click();
      cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/collections');
    });
  });
});
