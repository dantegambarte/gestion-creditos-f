/**
 * SUITE: Admin — Detalle de Usuario (real backend)
 */

function openFirstUserDetailIfExists(): void {
  cy.get('body').then(($body) => {
    const rows = $body.find('[data-cy="admin-users-table"] tbody tr, p-table tbody tr');
    if (rows.length > 0) {
      cy.wrap(rows.first()).click();
      cy.location('pathname', { timeout: 15000 }).should('match', /^\/admin\/users\//);
    }
  });
}

describe('Admin — Detalle de Usuario (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/users');
  });

  it('listado de usuarios carga sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/users');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-users-table"], p-table').should('exist');
  });

  it('si hay usuarios, se puede abrir detalle y volver', () => {
    openFirstUserDetailIfExists();

    cy.location('pathname').then((path) => {
      if (path.startsWith('/admin/users/')) {
        cy.get('app-error-state').should('not.exist');
        cy.get('[data-cy="admin-user-detail-back-action"]').click();
        cy.location('pathname').should('eq', '/admin/users');
      }
    });
  });

  it('si abre detalle, muestra acciones principales', () => {
    openFirstUserDetailIfExists();

    cy.location('pathname').then((path) => {
      if (path.startsWith('/admin/users/')) {
        cy.get('[data-cy="admin-user-detail-edit-action"]').should('be.visible');
        cy.get('[data-cy="admin-user-detail-status-action"]').should('be.visible');
        cy.get('[data-cy="admin-user-detail-reset-password-action"]').should('be.visible');
      }
    });
  });

  it('si abre detalle, editar entra y sale de modo edición', () => {
    openFirstUserDetailIfExists();

    cy.location('pathname').then((path) => {
      if (path.startsWith('/admin/users/')) {
        cy.get('[data-cy="admin-user-detail-edit-action"]').click();
        cy.get('[data-cy="admin-user-detail-save-action"]').should('be.visible');
        cy.get('[data-cy="admin-user-detail-cancel-edit-action"]').click();
        cy.get('[data-cy="admin-user-detail-edit-action"]').should('be.visible');
      }
    });
  });
});
