/**
 * SUITE: Admin — Detalle de Usuario (/admin/users/:id)
 *
 * Cubre:
 *  - Vista read-only: nombre, tags de rol y estado
 *  - Botones de acción: Editar, Desactivar, Resetear contraseña
 *  - Modo edición: campos prellenados
 *  - Cancelar edición vuelve a vista read-only
 *  - Botón Volver
 *  - Estado de carga / error
 */

const USER_MOCK = {
  id: 'usr-002',
  full_name: 'María Sánchez',
  dni: '87654321',
  email: 'vendedor@siscreditos.com',
  address: 'Calle Falsa 456',
  role: 'SELLER',
  status: 'ACTIVE',
  is_temp_password: false,
  failed_attempts: 0,
  locked_at: null,
  last_login_at: null,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

function stubUser() {
  cy.intercept('GET', /\/api\/users\/usr-002/, {
    statusCode: 200,
    body: { ok: true, data: USER_MOCK },
  }).as('userDetail');
}

describe('Admin — Detalle de Usuario', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubUser();
    cy.loginAs('ADMIN', '/admin/users/usr-002');
    cy.wait('@userDetail');
  });

  it('muestra el nombre completo del usuario', () => {
    cy.contains('María Sánchez').should('be.visible');
  });

  it('muestra el tag de rol', () => {
    cy.get('p-tag').should('have.length.gte', 1);
  });

  it('muestra el tag de estado Activo', () => {
    cy.contains('.ff-badge', 'Activo').should('be.visible');
  });

  it('muestra el botón Editar', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').should('exist');
  });

  it('muestra el botón Desactivar (usuario activo)', () => {
    cy.get('[data-cy="admin-user-detail-status-action"]').contains('Desactivar').should('exist');
  });

  it('muestra el botón "Resetear contraseña"', () => {
    cy.get('[data-cy="admin-user-detail-reset-password-action"]').should('exist');
  });

  it('botón Volver navega al listado', () => {
    cy.get('[data-cy="admin-user-detail-back-action"]').click();
    cy.url().should('include', '/admin/users');
    cy.url().should('not.match', /\/usr-002$/);
  });

  it('clic en Editar activa el modo edición', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-save-action"]').should('exist');
  });

  it('modo edición: campo fullName prellenado', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-edit-fullname-input"]').should('have.value', 'María Sánchez');
  });

  it('modo edición: campo email prellenado', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-edit-email-input"]').should('have.value', 'vendedor@siscreditos.com');
  });

  it('Cancelar en modo edición vuelve a la vista read-only', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-cancel-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-edit-action"]').should('exist');
    cy.get('[data-cy="admin-user-detail-save-action"]').should('not.exist');
  });

  it('clic en Desactivar abre diálogo de confirmación', () => {
    cy.get('[data-cy="admin-user-detail-status-action"]').contains('Desactivar').click();
    cy.get('.p-confirm-dialog').should('be.visible');
  });

  it('clic en "Resetear contraseña" abre diálogo de confirmación', () => {
    cy.get('[data-cy="admin-user-detail-reset-password-action"]').click();
    cy.get('.p-confirm-dialog').should('be.visible');
  });
});

describe('Admin — Detalle de Usuario — Estado carga/error', () => {
  it('muestra loading state mientras carga', () => {
    cy.intercept('GET', /\/api\/users\/usr-slow/, (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: { ok: true, data: null } });
    }).as('slowUser');
    cy.loginAs('ADMIN', '/admin/users/usr-slow');
    cy.get('app-loading-state').should('exist');
  });

  it('muestra error state si el usuario no existe', () => {
    cy.intercept('GET', /\/api\/users\/usr-404/, {
      statusCode: 404,
      body: { ok: false, message: 'Not found' },
    }).as('notFound');
    cy.loginAs('ADMIN', '/admin/users/usr-404');
    cy.wait('@notFound');
    cy.get('app-error-state').should('exist');
  });
});
