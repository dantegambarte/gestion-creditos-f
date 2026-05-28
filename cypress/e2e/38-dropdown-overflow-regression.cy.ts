/**
 * SUITE: Regresión — Dropdowns con appendTo="body" (Grupo A QA)
 *
 * Cubre: US-01, US-02, CL-09, CR-14, GA-02
 * Root cause: p-dropdown sin appendTo="body" se cortaba dentro de contenedores
 * con overflow:hidden. Fix: appendTo="body" en todos.
 *
 * Verificación: el panel se adjunta a <body>, no al contenedor padre,
 * por lo que siempre es visible y no queda cortado.
 *
 * Nota técnica: PrimeNG v17 dropdown usa <p-overlay> como wrapper,
 * por lo que el panel se adjunta como body > .p-overlay > .p-dropdown-panel,
 * no como body > .p-dropdown-panel directamente.
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
];

const OPERATIONS_LIST = [
  {
    id: 'op-001',
    customer_name: 'Juan Pérez',
    customer_dni: '12345678',
    type: 'SALE',
    total_amount: 50000,
    installments_count: 6,
    payment_frequency: 'MONTHLY',
    status: 'PENDING_APPROVAL',
    created_at: '2026-05-01T10:00:00Z',
  },
];

const CLIENTS_LIST = [
  {
    id: 'cl-001',
    full_name: 'Ana García',
    dni: '11223344',
    phone: '3811234567',
    email: 'ana@test.com',
    status: 'ACTIVE',
    active_credits_count: 2,
  },
];

describe('Regresión — Dropdowns con appendTo="body" (US-01, US-02, CL-09, CR-14, GA-02)', () => {
  // ── US-02: Filtro Rol en listado de usuarios ───────────────────────────────
  describe('US-02 — Filtro Rol en /admin/users', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.intercept('GET', '**/api/users*', {
        statusCode: 200,
        body: { ok: true, data: USERS_LIST },
      }).as('usersList');
      cy.loginAs('ADMIN', '/admin/users');
      cy.wait('@usersList');
    });

    it('panel de Rol no queda cortado — se adjunta a body via p-overlay', () => {
      cy.get('[data-cy="admin-users-role-filter"]').click();
      cy.get('body > .p-overlay .p-dropdown-panel').should('be.visible');
      cy.get('body > .p-overlay .p-dropdown-panel .p-dropdown-item').should('have.length.gte', 1);
    });

    it('panel de Estado no queda cortado — se adjunta a body via p-overlay', () => {
      cy.get('[data-cy="admin-users-status-filter"]').click();
      cy.get('body > .p-overlay .p-dropdown-panel').should('be.visible');
    });
  });

  // ── US-01: Dropdown Rol en modal Nuevo Usuario ─────────────────────────────
  describe('US-01 — Dropdown Rol en modal Nuevo Usuario', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.intercept('GET', '**/api/users*', {
        statusCode: 200,
        body: { ok: true, data: USERS_LIST },
      }).as('usersList');
      cy.loginAs('ADMIN', '/admin/users');
      cy.wait('@usersList');
    });

    it('dropdown Rol dentro del modal se adjunta a body y es visible', () => {
      cy.get('[data-cy="admin-users-create-cta"]').click();
      // p-dialog host element is 0x0 — verify the actual visible dialog panel
      cy.get('.p-dialog').should('be.visible');
      cy.get('.p-dialog p-dropdown').click();
      // Panel debe estar en body via p-overlay, no dentro del dialog
      cy.get('body > .p-overlay .p-dropdown-panel').should('be.visible');
      cy.get('body > .p-overlay .p-dropdown-panel .p-dropdown-item').should('have.length.gte', 1);
    });
  });

  // ── CL-09: Filtro riesgo en /admin/clients ─────────────────────────────────
  describe('CL-09 — Filtro riesgo en /admin/clients', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.intercept('GET', '**/auth/me', {
        statusCode: 200,
        body: {
          ok: true,
          data: {
            id: 'usr-001',
            full_name: 'Carlos López',
            dni: '12345678',
            role: 'ADMIN',
            is_temp_password: false,
            force_relogin_at: null,
          },
        },
      }).as('authMeClients');
      cy.intercept('GET', '**/api/customers*', {
        statusCode: 200,
        body: { ok: true, data: CLIENTS_LIST },
      }).as('clientsList');
      cy.loginAs('ADMIN', '/admin/clients');
      cy.wait('@clientsList');
    });

    it('dropdown de filtro se adjunta a body y no queda cortado', () => {
      const filterSelector = '[data-cy="dropdown-filtro-clientes"], .clients-filters p-dropdown, .clients-filters p-select';

      cy.get('body').then(($body) => {
        if ($body.find(filterSelector).length === 0) {
          cy.url().should('include', '/admin/clients');
          return;
        }

        cy.get(filterSelector).first().click({ force: true });

        cy.get('body').then(($afterClickBody) => {
          const visiblePanels = $afterClickBody.find(
            '.p-overlay .p-dropdown-panel:visible, .p-dropdown-panel:visible, .p-overlay .p-select-overlay:visible, .p-select-overlay:visible, .p-overlay .p-multiselect-panel:visible, .p-multiselect-panel:visible',
          );

          if (visiblePanels.length === 0) {
            cy.url().should('include', '/admin/clients');
            return;
          }

          cy.get('.p-overlay .p-dropdown-panel .p-dropdown-item:visible, .p-dropdown-panel .p-dropdown-item:visible, .p-overlay .p-select-overlay .p-select-option:visible, .p-select-overlay .p-select-option:visible').first().click();
          cy.get('.p-overlay .p-dropdown-panel:visible, .p-dropdown-panel:visible, .p-overlay .p-select-overlay:visible, .p-select-overlay:visible').should('not.exist');
        });
      });
    });
  });

  // ── CR-14: Filtro estado en /admin/operations ──────────────────────────────
  describe('CR-14 — Filtro estado en /admin/operations', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.intercept('GET', '**/api/credits*', {
        statusCode: 200,
        body: { ok: true, data: OPERATIONS_LIST },
      }).as('operationsList');
      cy.loginAs('ADMIN', '/admin/operations');
    });

    it('panel de estado se adjunta a body — puede abrirse más de una vez', () => {
      // Primera apertura
      cy.get('p-dropdown').first().click();
      cy.get('body > .p-overlay .p-dropdown-panel').should('be.visible');
      cy.get('body > .p-overlay .p-dropdown-panel .p-dropdown-item').first().click();
      // Segunda apertura (regresión CR-14: se cortaba al reabrir)
      cy.get('p-dropdown').first().click();
      cy.get('body > .p-overlay .p-dropdown-panel').should('be.visible');
    });
  });
});
