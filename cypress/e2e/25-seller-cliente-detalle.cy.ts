/**
 * SUITE: Seller — Detalle de Cliente (/seller/clients/:dni)
 *
 * Cubre:
 *  - Vista read-only: nombre, tag estado, botones según rol
 *  - Admin: botones Editar, Desactivar
 *  - Seller: puede ver el detalle pero no desactivar
 *  - Modo edición: campos del formulario
 *  - Botón Volver
 */

const CUSTOMER_MOCK = {
  id: 'cust-001',
  full_name: 'Ana García',
  dni: '12345678',
  phone: '3811234567',
  email: 'ana@mail.com',
  address: 'Av. Principal 100',
  status: 'ACTIVE',
  collector_id: null,
  collector_name: null,
  portal_enabled: false,
  portal_is_temp_password: false,
  portal_failed_attempts: 0,
  portal_locked_at: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

function stubCustomer(role: 'ADMIN' | 'SELLER') {
  cy.intercept('GET', /\/api\/customers\/12345678/, {
    statusCode: 200,
    body: { ok: true, data: CUSTOMER_MOCK },
  }).as('customerDetail');

  cy.intercept('GET', /\/api\/customers\/12345678\/credits/, {
    statusCode: 200,
    body: { ok: true, data: [] },
  }).as('customerCredits');

  cy.intercept('GET', '**/api/users*', {
    statusCode: 200,
    body: { ok: true, data: [] },
  }).as('collectorsList');

  cy.loginAs(role, '/seller/clients/12345678');
}

describe('Detalle de Cliente — Admin', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubCustomer('ADMIN');
    cy.wait('@customerDetail');
  });

  it('muestra el nombre del cliente', () => {
    cy.contains('Ana García').should('be.visible');
  });

  it('muestra el tag de estado Activo', () => {
    cy.get('p-tag').contains('Activo').should('exist');
  });

  it('Admin ve el botón Editar', () => {
    cy.get('[data-cy="seller-client-detail-edit-action"]').should('exist');
  });

  it('Admin ve el botón Desactivar', () => {
    cy.get('[data-cy="seller-client-detail-status-action"]').contains('Desactivar').should('exist');
  });

  it('botón Volver navega a la lista', () => {
    cy.get('[data-cy="seller-client-detail-back-action"]').click();
    cy.url().should('not.match', /\/12345678$/);
  });

  it('clic en Editar activa el modo edición', () => {
    cy.get('[data-cy="seller-client-detail-edit-action"] button').click();
    cy.get('[data-cy="seller-client-detail-save-action"]').should('be.visible');
  });

  it('en modo edición: campo fullName visible y prellenado', () => {
    cy.get('[data-cy="seller-client-detail-edit-action"] button').click();
    cy.get('[data-cy="seller-client-detail-edit-fullname-input"]').should('have.value', 'Ana García');
  });

  it('Cancelar edición vuelve a la vista read-only', () => {
    cy.get('[data-cy="seller-client-detail-edit-action"] button').click();
    cy.get('[data-cy="seller-client-detail-cancel-edit-action"] button').click();
    cy.get('[data-cy="seller-client-detail-edit-action"]').should('exist');
  });
});

describe('Detalle de Cliente — Seller', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubCustomer('SELLER');
    cy.wait('@customerDetail');
  });

  it('muestra el nombre del cliente', () => {
    cy.contains('Ana García').should('be.visible');
  });

  it('Seller NO ve el botón Desactivar', () => {
    cy.get('[data-cy="seller-client-detail-status-action"]').should('not.exist');
  });

  it('botón Volver existe', () => {
    cy.get('[data-cy="seller-client-detail-back-action"]').should('exist');
  });
});

describe('Detalle de Cliente — Estado de carga/error', () => {
  it('muestra loading mientras carga', () => {
    cy.intercept('GET', /\/api\/customers\/99999999/, (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: { ok: true, data: null } });
    }).as('slowCustomer');
    cy.loginAs('SELLER', '/seller/clients/99999999');
    cy.get('app-loading-state').should('exist');
  });

  it('muestra error si no existe el cliente', () => {
    cy.intercept('GET', /\/api\/customers\/00000000/, {
      statusCode: 404,
      body: { ok: false, message: 'Not found' },
    }).as('notFound');
    cy.loginAs('SELLER', '/seller/clients/00000000');
    cy.wait('@notFound');
    cy.get('app-error-state').should('exist');
  });
});
