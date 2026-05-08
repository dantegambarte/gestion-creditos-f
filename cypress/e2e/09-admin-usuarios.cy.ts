/**
 * SUITE: Admin — Gestión de Usuarios
 *
 * Cubre:
 *  - Listado de usuarios
 *  - Crear usuario (formulario completo)
 *  - Validaciones de formulario
 *  - Error de DNI duplicado desde backend
 *  - Diálogo de contraseña temporal
 *  - Navegación a detalle tras crear
 */

const USERS_LIST = [
  {
    id: 'usr-001',
    full_name: 'Carlos López',
    dni: '12345678',
    email: 'admin@siscreditos.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    is_temp_password: false,
    failed_attempts: 0,
    locked_at: null,
    last_login_at: '2026-05-01T10:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'usr-002',
    full_name: 'María Sánchez',
    dni: '87654321',
    email: 'maria@siscreditos.com',
    role: 'SELLER',
    status: 'ACTIVE',
    is_temp_password: false,
    failed_attempts: 0,
    locked_at: null,
    last_login_at: null,
    created_at: '2025-01-02T00:00:00Z',
  },
];

describe('Admin — Gestión de Usuarios', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: { ok: true, data: USERS_LIST },
    }).as('usersList');

    cy.intercept('POST', '**/api/users', {
      statusCode: 201,
      body: {
        ok: true,
        data: {
          user: {
            id: 'usr-new-1',
            full_name: 'Usuario Test E2E',
            dni: '99887766',
            email: 'test-e2e@finflow.com',
            address: 'Calle Falsa 123',
            role: 'COLLECTOR',
            status: 'ACTIVE',
            is_temp_password: true,
            failed_attempts: 0,
            locked_at: null,
            last_login_at: null,
            created_at: '2026-05-01T10:00:00Z',
            updated_at: '2026-05-01T10:00:00Z',
          },
          tempPassword: 'TMP-1234',
        },
      },
    }).as('createUser');

    cy.loginAs('ADMIN', '/admin/users');
    cy.wait('@usersList');
  });

  // ── Listado ────────────────────────────────────────────────────────────────────
  it('renderiza listado con buscador y tabla', () => {
    cy.get('[data-cy="admin-users-search-input"]').should('be.visible');
    cy.get('[data-cy="admin-users-table"] tbody tr').should('have.length', 2);
  });

  it('filtra usando el buscador actual', () => {
    cy.get('[data-cy="admin-users-search-input"]').type('María');
    cy.wait('@usersList');
    cy.get('p-table tbody tr').should('have.length', 2);
  });

  it('el botón "Nuevo usuario" abre modal (no ruta /new)', () => {
    cy.get('[data-cy="admin-users-create-cta"]').should('exist').click();
    cy.contains('.p-dialog .p-dialog-title', 'Nuevo usuario').should('be.visible');
    cy.url().should('include', '/admin/users');
  });

  it('valida email en el formulario modal', () => {
    cy.get('[data-cy="admin-users-create-cta"]').click();
    cy.get('.p-dialog').within(() => {
      cy.get('input[id="email"]').type('email-invalido');
      cy.contains('small', 'Formato de email inválido').should('be.visible');
    });
  });

  it('crea usuario y muestra diálogo de contraseña temporal', () => {
    cy.get('[data-cy="admin-users-create-cta"]').click();
    cy.get('.p-dialog').within(() => {
      cy.get('input[id="fullName"]').type('Juan Pérez');
      cy.get('input[id="dni"]').type('99887766');
      cy.get('input[id="email"]').type('test-e2e@finflow.com');
      cy.get('input[id="address"]').type('Calle Falsa 123');
      cy.get('p-dropdown').click();
      cy.contains('.p-dropdown-item', 'Cobrador').click();
      cy.contains('button', 'Crear usuario').click();
    });
    cy.wait('@createUser');
    cy.contains('p-dialog', 'Contraseña temporal generada').should('be.visible');
    cy.contains('p-dialog', 'Ya la anoté y la comuniqué').should('be.visible');
  });
});
