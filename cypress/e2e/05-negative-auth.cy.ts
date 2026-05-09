/**
 * SUITE: Autenticación — Unhappy Paths
 *
 * Cubre comportamientos testables con MockAuthService (sin backend real):
 *  - Logout limpia localStorage y redirige a /login
 *  - Token corrupto en localStorage → app redirige a /login (rehydrate falla)
 *  - Usuario con is_temp_password=true → tempPasswordGuard → /change-password
 *  - noAuthGuard redirige SELLER a /seller/operations
 *  - noAuthGuard redirige COLLECTOR a /collector/route
 *  - SELLER_COLLECTOR tiene acceso a rutas de seller
 *
 * NOTA: Tests de 401/403 HTTP mid-session requieren backend real o reemplazo
 * del MockAuthService por uno con soporte de inyección de errores.
 * Ver sección BACKEND REQUIREMENTS en el TEST_PLAN.md.
 */

describe('Autenticación — Unhappy Paths', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  // ── Logout limpia estado ─────────────────────────────────────────────────────
  it('logout limpia localStorage y redirige a /login', () => {
    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.url().should('include', '/admin/dashboard');
    cy.get('[data-testid="logout-btn"]', { timeout: 12000 })
      .should('be.visible')
      .click();

    cy.url().should('include', '/login');
    cy.window().then((win) => {
      expect(win.localStorage.getItem('sgcf_token')).to.be.null;
      expect(win.localStorage.getItem('sgcf_user')).to.be.null;
    });
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
    const tempUser = {
      id: 'usr-099',
      full_name: 'Temp Usuario',
      name: 'Temp Usuario',
      dni: '00000099',
      email: 'temp@siscreditos.com',
      avatar: 'TU',
      roles: ['SELLER'],
      is_temp_password: true,
      force_relogin_at: null,
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDk5Iiwicm9sZSI6IlNFTExFUiJ9.mock_temp',
    };

    // Interceptar /auth/me para que APP_INITIALIZER restaure el usuario con is_temp_password=true
    // sin que el backend real lo rechace con 401 (lo que llamaría clear() y borraría la sesión).
    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: tempUser.id,
          full_name: tempUser.full_name,
          dni: tempUser.dni,
          role: 'SELLER',
          is_temp_password: true,
          force_relogin_at: null,
        },
      },
    }).as('authMe');

    cy.visit('/seller/clients', {
      onBeforeLoad(win) {
        win.localStorage.setItem('sgcf_token', tempUser.token);
        win.localStorage.setItem('sgcf_user', JSON.stringify(tempUser));
      },
    });

    cy.url().should('include', '/change-password');
  });

  // ── noAuthGuard: SELLER ──────────────────────────────────────────────────────
  it('noAuthGuard redirige a /seller/operations si el usuario autenticado es SELLER', () => {
    cy.loginAs('SELLER'); // visita /login con auth → noAuthGuard redirige a /seller/operations
    cy.url().should('include', '/seller/operations');

    // Intento directo a /login → noAuthGuard vuelve a redirigir
    cy.visit('/login');
    cy.url().should('include', '/seller');
  });

  // ── noAuthGuard: COLLECTOR ───────────────────────────────────────────────────
  it('noAuthGuard redirige a /collector/route si el usuario autenticado es COLLECTOR', () => {
    cy.loginAs('COLLECTOR');
    cy.url().should('include', '/collector');

    cy.visit('/login');
    cy.url().should('include', '/collector');
  });

  // ── SELLER_COLLECTOR: acceso híbrido ────────────────────────────────────────
  it('SELLER_COLLECTOR accede a /seller/clients sin ser bloqueado por roleGuard', () => {
    const hybridUser = {
      id: 'usr-055',
      full_name: 'Ana Híbrida',
      name: 'Ana Híbrida',
      dni: '55667788',
      email: 'hibrido@siscreditos.com',
      avatar: 'AH',
      roles: ['SELLER_COLLECTOR'],
      is_temp_password: false,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDU1Iiwicm9sZSI6IlNFTExFUl9DT0xMRUNUT1IifQ.mock_hybrid',
    };

    cy.visit('/seller/clients', {
      onBeforeLoad(win) {
        win.localStorage.setItem('sgcf_token', hybridUser.token);
        win.localStorage.setItem('sgcf_user', JSON.stringify(hybridUser));
      },
    });

    cy.url().should('include', '/seller/clients');
  });
});
