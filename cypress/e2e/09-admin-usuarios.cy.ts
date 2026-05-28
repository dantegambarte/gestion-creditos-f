/**
 * SUITE: Admin — Gestión de Usuarios (real backend)
 */

describe('Admin — Gestión de Usuarios', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.loginReal('ADMIN', '/admin/users');
  });

  // ── Listado ────────────────────────────────────────────────────────────────────
  it('renderiza listado con buscador y tabla', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/users');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-users-search-input"]').should('be.visible');
    cy.get('[data-cy="admin-users-table"]').should('be.visible');
  });

  it('filtra usando el buscador actual', () => {
    cy.get('[data-cy="admin-users-search-input"]').type('11111111');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-users-table"]').should('be.visible');
  });

  it('el botón "Nuevo usuario" abre modal (no ruta /new)', () => {
    cy.get('[data-cy="admin-users-create-cta"]').should('exist').click();
    cy.contains('.p-dialog .p-dialog-title', 'Nuevo usuario').should('be.visible');
    cy.url().should('include', '/admin/users');
  });

  it('valida email en el formulario modal', () => {
    cy.get('[data-cy="admin-users-create-cta"]').click();
    cy.get('.p-dialog').within(() => {
      cy.get('input[id="email"]').clear().type('email-invalido');
      cy.get('input[id="fullName"]').click();
      cy.contains('small', 'Formato de email inválido.').should('be.visible');
    });
  });

  it('permite completar el formulario base de alta', () => {
    cy.get('[data-cy="admin-users-create-cta"]').click();
    cy.get('[data-cy="admin-users-create-modal"]').within(() => {
      cy.get('input[id="fullName"]').type('Juan Pérez');
      cy.get('input[id="dni"]').type('99887766');
      cy.get('input[id="email"]').type('test-e2e@finflow.com');
      cy.get('input[id="address"]').type('Calle Falsa 123');
      cy.get('p-dropdown').click();
    });
    cy.get('.p-dropdown-panel').contains('.p-dropdown-item', 'Cobrador').click();
    cy.get('[data-cy="admin-users-create-modal"]').within(() => {
      cy.contains('button', 'Crear usuario').should('be.visible');
    });
  });
});
