/**
 * SUITE REAL: Autenticación interna contra backend real.
 *
 * Este archivo NO usa intercept de /auth/login ni /auth/me.
 * Requiere credenciales reales en variables Cypress env.
 */

describe('Autenticación real', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('autentica ADMIN con backend real y abre dashboard', () => {
    cy.loginReal('ADMIN', '/admin/dashboard');
    cy.get('[data-testid="logout-btn"]', { timeout: 15000 }).should('be.visible');
  });
});
