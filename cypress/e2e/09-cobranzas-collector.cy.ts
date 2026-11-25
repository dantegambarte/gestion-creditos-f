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
    cy.location('pathname', { timeout: 15000 }).should('eq', '/collector/route');
    cy.contains(/Mi Ruta|Planillas|Ruta/i, { timeout: 15000 }).should('exist');
    cy.get('p-table').should('exist');
    cy.get('app-error-state').should('not.exist');
  });

  it('mantiene acceso a /collector/route luego de recargar', () => {
    cy.reload();
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/collector/route',
    );
    cy.contains(/Mi Ruta|Planillas|Ruta/i).should('exist');
  });

  it('si hay planillas permite navegar al detalle y volver', () => {
    // Esperar a que la ruta termine de cargar antes de decidir el camino:
    // o hay planillas (botón "Ver planilla") o el estado vacío.
    cy.contains('h1', 'Mi Ruta', { timeout: 15000 }).should('be.visible');
    cy.contains(/Ver planilla|No tenés una planilla generada\./, {
      timeout: 15000,
    }).should('be.visible');

    cy.get('body').then(($body) => {
      const hasSheetButton =
        $body.find('button:contains("Ver planilla")').length > 0;

      if (!hasSheetButton) {
        cy.contains('No tenés una planilla generada.').should('be.visible');
        return;
      }

      cy.contains('button:visible', 'Ver planilla').first().click();
      cy.location('pathname', { timeout: 15000 }).should(
        'match',
        /\/collector\/route\/.+/,
      );
      cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

      cy.contains('button', 'Volver').click();
      cy.location('pathname', { timeout: 15000 }).should(
        'eq',
        '/collector/route',
      );
    });
  });
});
