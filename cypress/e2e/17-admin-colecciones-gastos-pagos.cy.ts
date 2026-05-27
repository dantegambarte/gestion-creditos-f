/**
 * SUITE: Admin — Gastos y Cobros (real)
 *
 * Alcance:
 *  - Mantiene en este spec solo Gastos + Cobros.
 *  - Cobertura de Colecciones se migra por separado en specs dedicados:
 *    `22-admin-generar-planilla.cy.ts` y `29-admin-collection-detail.cy.ts`.
 */

describe('Admin — Gastos (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/expenses');
  });

  it('renderiza pantalla de gastos sin estado de error', () => {
    cy.contains('h1', 'Gastos', { timeout: 15000 }).should('be.visible');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra acciones principales de gastos', () => {
    cy.contains('button', 'Registrar gasto').should('be.visible');
    cy.contains('button', 'Gestionar categorías').should('be.visible');
  });

  it('abre panel de categorias desde la accion de gestion', () => {
    cy.contains('button', 'Gestionar categorías').click();
    cy.contains('Categorías de gastos', { timeout: 15000 }).should('be.visible');
  });
});

describe('Admin — Cobros (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/payments');
  });

  it('renderiza pantalla de cobros sin estado de error', () => {
    cy.contains('h1', 'Cobros', { timeout: 15000 }).should('be.visible');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra controles base del listado de cobros', () => {
    cy.get('p-dropdown', { timeout: 15000 }).should('have.length.at.least', 2);
    cy.contains('button', 'Actualizar').should('be.visible');
  });
});
