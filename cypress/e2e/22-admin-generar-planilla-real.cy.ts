/**
 * SUITE REAL: Admin — Generar Planilla de Cobro (/admin/collections/new)
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints
 * - Verifica estructura de UI contra backend real
 */

describe('Admin — Generar Planilla de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/collections/new');
    cy.contains('Generar planilla de cobro', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Generar planilla de cobro"', () => {
    cy.contains('h1', 'Generar planilla de cobro').should('be.visible');
  });

  it('muestra aviso de advertencia sobre reemplazo', () => {
    cy.get('p-message[severity="warn"]').should('exist');
    cy.contains('reemplazada automáticamente').should('exist');
  });

  it('tiene dropdown de cobrador', () => {
    cy.get('p-dropdown').should('have.length.gte', 1);
  });

  it('tiene selector de fecha', () => {
    cy.get('p-calendar').should('exist');
  });

  it('tiene dropdown de filtro de cuotas', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
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
