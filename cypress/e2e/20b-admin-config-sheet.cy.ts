/**
 * SUITE: Admin — Configuracion y Sheet legacy (real)
 *
 * Alcance:
 *  - /admin/config como smoke real de navegacion y render
 *  - /admin/sheet como pantalla legacy real (sin mocks)
 */

describe('Admin — Configuracion (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/config');
  });

  it('renderiza pantalla de configuracion sin estado de error', () => {
    cy.get('nav', { timeout: 15000 }).should('be.visible');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra tabs base de configuracion', () => {
    // Tabs vigentes desde 5173e79: Usuarios se movió a /admin/users.
    cy.contains('nav.ff-tab-nav a', 'Tasas de Interés').should('be.visible');
    cy.contains('nav.ff-tab-nav a', 'Parámetros del Sistema').should('exist');
    cy.contains('nav.ff-tab-nav a', 'Notificaciones').should('exist');
    cy.contains('nav.ff-tab-nav a', 'Usuarios').should('not.exist');
  });
});

describe('Admin — Sheet legacy (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/sheet');
  });

  it('ruta legacy /admin/sheet no rompe la app y redirige a ruta valida', () => {
    cy.location('pathname', { timeout: 15000 }).should('not.eq', '/admin/sheet');
    cy.get('app-error-state').should('not.exist');
  });

  it('el fallback muestra una pantalla admin utilizable', () => {
    cy.get('h1', { timeout: 15000 }).should('exist');
    cy.location('pathname').should('match', /^\/admin\//);
  });
});
