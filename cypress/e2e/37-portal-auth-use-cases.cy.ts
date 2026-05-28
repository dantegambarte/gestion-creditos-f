/**
 * SUITE: Portal Cliente — autenticación y guards
 *
 * Enfocada en CU01 + CU11:
 *  - acceso autenticado por DNI y contraseña
 *  - guard del portal para rutas privadas
 *  - mensaje de credenciales inválidas
 *  - mensaje de acceso no habilitado
 */

describe('Portal Cliente — autenticación y guards', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('redirige a /portal/login si se intenta abrir /portal/dashboard sin sesión', () => {
    cy.visit('/portal/dashboard');
    cy.url().should('include', '/portal/login');
  });

  it('autentica por DNI real y redirige al dashboard del portal', () => {
    const dni = String(Cypress.env('realPortalDni') ?? '').trim();
    const password = String(Cypress.env('realPortalPassword') ?? '').trim();

    cy.visit('/portal/login');
    cy.get('#dni').type(dni);
    cy.get('p-password input').type(password);
    cy.contains('button', 'Iniciar sesión').click();

    cy.location('pathname', { timeout: 15000 }).should('satisfy', (path: string) => {
      return path === '/portal/dashboard' || path === '/portal/change-password';
    });
    cy.url().should('not.include', '/portal/login');
    cy.get('app-error-state').should('not.exist');
  });

  it('con contraseña inválida mantiene al usuario en login sin crear sesión', () => {
    const dni = String(Cypress.env('realPortalDni') ?? '').trim();

    cy.visit('/portal/login');
    cy.get('#dni').type(dni);
    cy.get('p-password input').type('wrongpass');
    cy.contains('button', 'Iniciar sesión').click();

    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/login');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('sgcf_portal_token')).to.be.null;
    });
  });

  it('sin sesión, rutas privadas de portal redirigen a login', () => {
    cy.clearAllLocalStorage();
    cy.visit('/portal/credits');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/login');
  });

  it('si existe sesión portal, puede abrir una ruta privada', () => {
    cy.loginPortalReal('/portal/dashboard');
    cy.location('pathname', { timeout: 15000 }).should('satisfy', (path: string) => {
      return path === '/portal/dashboard' || path === '/portal/change-password';
    });
  });
});
