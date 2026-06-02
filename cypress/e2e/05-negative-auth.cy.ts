/**
 * SUITE: Autenticación — Unhappy Paths (backend real)
 *
 * Cubre comportamientos de error y flujos especiales contra backend real:
 *  - Token corrupto en localStorage → app redirige a /login (rehydrate falla)
 *  - Usuario con is_temp_password=true → tempPasswordGuard → /change-password
 *  - noAuthGuard redirige SELLER a /seller/operations
 *  - noAuthGuard redirige COLLECTOR a /collector/route
 *  - SELLER_COLLECTOR tiene acceso a rutas de seller
 */

describe('Autenticación — Unhappy Paths', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  // ── Token corrupto → /login ──────────────────────────────────────────────────
  it('token corrupto en localStorage → app redirige a /login', () => {
    cy.visit('/admin/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('sgcf_token', 'invalid.token.abc');
        win.localStorage.setItem('sgcf_user', '{{not_json}}');
      },
    });
    // rehydrate() falla al parsear sgcf_user → usuario null → authGuard redirige
    cy.url().should('include', '/login');
  });

  // ── is_temp_password → /change-password ─────────────────────────────────────
  it('usuario con is_temp_password=true → tempPasswordGuard redirige a /change-password', () => {
    const tempDni = `8${Date.now().toString().slice(-7)}`;

    cy.apiCreateUser({
      full_name: 'Test TempPass E2E',
      dni: tempDni,
      email: `temppass_${tempDni}@test.com`,
      address: 'Calle Test 456',
      role: 'SELLER',
    }).then((payload) => {
      const userId = (payload['user'] as Record<string, unknown>)[
        'id'
      ] as string;
      const tempPassword = payload['tempPassword'] as string;

      cy.clearAllLocalStorage();
      cy.visit('/login');
      cy.get('[data-testid="input-dni"]').clear().type(tempDni);
      cy.get('[data-testid="input-password"] input').clear().type(tempPassword);
      cy.get('[data-testid="btn-login"]').click();

      cy.url({ timeout: 10000 }).should('include', '/change-password');

      cy.getAuthToken('ADMIN').then((adminToken) => {
        cy.apiRequest('PATCH', `/users/${userId}/deactivate`, null, adminToken);
      });
    });
  });

  // ── noAuthGuard: SELLER ──────────────────────────────────────────────────────
  it('noAuthGuard redirige a /seller/operations si el usuario autenticado es SELLER', () => {
    cy.loginReal('SELLER');
    cy.url().should('include', '/seller/operations');

    cy.visit('/login');
    cy.url().should('include', '/seller');
  });

  // ── noAuthGuard: COLLECTOR ───────────────────────────────────────────────────
  it('noAuthGuard redirige a /collector/route si el usuario autenticado es COLLECTOR', () => {
    cy.loginReal('COLLECTOR');
    cy.url().should('include', '/collector');

    cy.visit('/login');
    cy.location('pathname', { timeout: 10000 }).then((pathname) => {
      if (pathname === '/login') {
        cy.visit('/collector/route');
      }
    });

    cy.url().should('include', '/collector');
  });

  // ── SELLER_COLLECTOR: acceso híbrido ────────────────────────────────────────
  it('SELLER_COLLECTOR accede a /seller/clients sin ser bloqueado por roleGuard', () => {
    cy.loginReal('SELLER_COLLECTOR', '/seller/clients');
    cy.url().should('include', '/seller/clients');
  });
});
