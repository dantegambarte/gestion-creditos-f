/**
 * SUITE: Cambio de contraseña (real backend)
 */

describe('Cambio de contraseña interno (/change-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('sin sesión redirige a login', () => {
    cy.clearAllLocalStorage();
    cy.visit('/change-password');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login');
  });

  it('con sesión real interna permite abrir la pantalla', () => {
    cy.loginReal('ADMIN', '/change-password');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/change-password');
    cy.get('app-error-state').should('not.exist');
    cy.get('input[type="password"], p-password input').should('have.length.gte', 1);
  });
});

describe('Cambio de contraseña portal (/portal/change-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('sin sesión redirige a /portal/login', () => {
    cy.clearAllLocalStorage();
    cy.visit('/portal/change-password');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/login');
  });

  it('con sesión portal real permite abrir change-password', () => {
    cy.loginPortalReal('/portal/change-password');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/change-password');
    cy.get('app-error-state').should('not.exist');
    cy.get('input[type="password"]').should('have.length.gte', 2);
  });
});
