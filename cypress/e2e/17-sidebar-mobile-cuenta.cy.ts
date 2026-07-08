/**
 * SUITE: Sidebar mobile — sección "Cuenta" (Mi perfil / Cerrar sesión)
 *
 * Cubre:
 *  - El menú mobile abre desde el botón "Más" del bottom nav
 *  - La sección "Cuenta" se muestra agrupada y separada de la navegación
 *  - Mi perfil navega a /profile y cierra el menú
 *  - Cerrar sesión desloguea y redirige a /login
 */

describe('Sidebar mobile — sección Cuenta', () => {
  beforeEach(() => {
    cy.viewport(375, 667);
    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/dashboard');
    cy.get('[aria-label="Abrir menú"]', { timeout: 15000 }).should('be.visible').click();
    cy.get('.mobile-menu-sheet--open', { timeout: 10000 }).should('be.visible');
  });

  it('muestra el grupo "Cuenta" separado de la navegación principal', () => {
    cy.contains('.mobile-menu-sheet__group', 'Cuenta').should('be.visible');
    cy.get('.mobile-menu-sheet__account-panel').should('be.visible');
  });

  it('el panel de cuenta tiene dos botones: Mi perfil y Cerrar sesión', () => {
    cy.get('.mobile-menu-sheet__account-panel')
      .find('.mobile-menu-sheet__account-row')
      .should('have.length', 2);

    cy.get('[data-cy="nav-mi-perfil-mobile"]').should('be.visible').and('contain.text', 'Mi perfil');
    cy.get('[data-testid="logout-btn-mobile"]').should('be.visible').and('contain.text', 'Cerrar sesión');
  });

  it('navega a /profile al tocar "Mi perfil" y cierra el menú', () => {
    cy.get('[data-cy="nav-mi-perfil-mobile"]').click();
    cy.url().should('include', '/profile');
    cy.get('.mobile-menu-sheet--open').should('not.exist');
  });

  it('cierra sesión y redirige a /login al tocar "Cerrar sesión"', () => {
    cy.get('[data-testid="logout-btn-mobile"]').click();
    cy.url().should('include', '/login');
  });
});
