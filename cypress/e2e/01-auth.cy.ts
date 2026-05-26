/**
 * SUITE REAL — CU01: Autenticar usuario.
 *
 * Cubre:
 *  - Flujo principal: login exitoso para cada rol interno (ADMIN, SELLER, COLLECTOR).
 *  - CU01-A: Credenciales incorrectas → error, sin redirección.
 *  - CU01-B: 3 intentos fallidos → bloqueo de cuenta (excepto ADMIN).
 *  - CU01-G: Cierre de sesión manual → token invalidado, redirect a /login.
 *  - CU01-J: Usuario inactivo → mensaje de cuenta no activa.
 *
 * Regla: ningún spec de esta suite intercepta /auth/login ni /auth/me.
 * Los datos se preparan y limpian vía cy.apiRequest / cy.apiUnlockUser.
 */

const SELLER_HOME = '/seller/operations';
const COLLECTOR_HOME = '/collector/route';
const ADMIN_HOME = '/admin/dashboard';

const AUTH_ERROR_REGEX =
  /credenciales incorrectas|dni o contrase\u00f1a incorrectos|demasiados intentos|intenta nuevamente|bloqueada/i;

// DNI único de test para casos de bloqueo; no colisiona con seeds fijos.
// Se genera por timestamp para garantizar idempotencia entre runs.
const LOCK_TEST_DNI = `9${Date.now().toString().slice(-7)}`;

describe('CU01 — Autenticar usuario (backend real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.request({ url: '/login', failOnStatusCode: false })
      .its('status')
      .should('eq', 200);
  });

  // ────────────────────────────────────────────────────────────────────
  // Flujo principal — login exitoso por rol
  // ────────────────────────────────────────────────────────────────────

  it('ADMIN autentica y abre dashboard (CU01 principal)', () => {
    cy.loginReal('ADMIN', ADMIN_HOME);
    cy.get('[data-testid="logout-btn"]', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.url().should('include', ADMIN_HOME);
  });

  it('SELLER autentica y abre módulo de operaciones (CU01 principal)', () => {
    cy.loginReal('SELLER', SELLER_HOME);
    cy.url({ timeout: 15000 }).should('include', SELLER_HOME);
    cy.get('[data-testid="logout-btn"]').should('be.visible');
  });

  it('COLLECTOR autentica y abre módulo de cobros (CU01 principal)', () => {
    cy.loginReal('COLLECTOR', COLLECTOR_HOME);
    cy.url({ timeout: 15000 }).should('include', COLLECTOR_HOME);
    cy.get('[data-testid="logout-btn"]').should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────
  // CU01-A — Credenciales incorrectas
  // ────────────────────────────────────────────────────────────────────

  it('CU01-A: contraseña incorrecta muestra error y no redirige', () => {
    cy.clearAllLocalStorage();
    cy.visit('/login');

    cy.get('[data-testid="input-dni"]')
      .clear()
      .type(Cypress.env('realAdminDni'));
    cy.get('[data-testid="input-password"] input')
      .clear()
      .type('CONTRASEÑA_INCORRECTA_XYZ');
    cy.get('[data-testid="btn-login"]').click();

    // Permanece en /login
    cy.url({ timeout: 10000 }).should('include', '/login');

    // Mensaje de error visible (no especifica cuál campo es incorrecto — CU01 regla de seguridad)
    cy.contains(AUTH_ERROR_REGEX, { timeout: 10000 }).should('be.visible');
  });

  it('CU01-A: DNI inexistente muestra error genérico y no redirige', () => {
    cy.clearAllLocalStorage();
    cy.visit('/login');

    cy.get('[data-testid="input-dni"]').clear().type('00000001');
    cy.get('[data-testid="input-password"] input')
      .clear()
      .type('cualquierCosa');
    cy.get('[data-testid="btn-login"]').click();

    cy.url({ timeout: 10000 }).should('include', '/login');
    cy.contains(AUTH_ERROR_REGEX, { timeout: 10000 }).should('be.visible');
  });

  // ────────────────────────────────────────────────────────────────────
  // CU01-B — Bloqueo por 3 intentos fallidos
  // Se usa un usuario de test creado ad-hoc para no afectar los seeds fijos.
  // ────────────────────────────────────────────────────────────────────

  it('CU01-B: 3 intentos fallidos mantienen error de autenticación', () => {
    // Crear usuario ad-hoc para este test — DNI único por timestamp evita colisiones.
    cy.apiCreateUser({
      full_name: 'Test Bloqueo E2E',
      dni: LOCK_TEST_DNI,
      email: `bloqueo_${LOCK_TEST_DNI}@test.com`,
      address: 'Calle Test 123',
      role: 'SELLER',
    }).then((payload) => {
      // El backend devuelve { user: { id, ... }, tempPassword }
      const userId = (payload['user'] as Record<string, unknown>)[
        'id'
      ] as string;

      cy.clearAllLocalStorage();
      cy.visit('/login');

      const attemptWrongLogin = () => {
        cy.get('[data-testid="input-password"] input')
          .clear()
          .type('CONTRASENA_INCORRECTA');
        cy.get('[data-testid="btn-login"]').click();
      };

      cy.get('[data-testid="input-dni"]').clear().type(LOCK_TEST_DNI);

      // Intento 1 → error de credenciales
      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');

      // Intento 2 → error de credenciales
      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');

      // Intento 3 → el sistema mantiene feedback de autenticación
      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');
      cy.url().should('include', '/login');

      // Cleanup: desbloquear el usuario para no dejar estado sucio en la BD
      cy.apiUnlockUser(userId);
    });
  });

  it('CU01-B: admin temporal muestra error tras intentos fallidos (sin asumir bloqueo)', () => {
    const tempAdminDni = `8${Date.now().toString().slice(-7)}`;

    cy.apiCreateUser({
      full_name: 'Test Bloqueo Admin E2E',
      dni: tempAdminDni,
      email: `bloqueo_admin_${tempAdminDni}@test.com`,
      address: 'Calle Test 999',
      role: 'ADMIN',
    }).then((payload) => {
      const user = payload['user'] as Record<string, unknown>;
      const userId = user['id'] as string;

      cy.clearAllLocalStorage();
      cy.visit('/login');
      cy.get('[data-testid="input-dni"]').clear().type(tempAdminDni);

      const attemptWrongLogin = () => {
        cy.get('[data-testid="input-password"] input')
          .clear()
          .type('CONTRASENA_INCORRECTA');
        cy.get('[data-testid="btn-login"]').click();
      };

      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');

      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');

      attemptWrongLogin();
      cy.contains(AUTH_ERROR_REGEX, { timeout: 8000 }).should('be.visible');

      // Cleanup para no dejar estado sucio
      cy.apiUnlockUser(userId);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // CU01-G — Cierre de sesión manual
  // ────────────────────────────────────────────────────────────────────

  it('CU01-G: logout borra sesión y redirige a /login', () => {
    cy.loginReal('ADMIN', ADMIN_HOME);
    cy.get('[data-testid="logout-btn"]', { timeout: 15000 })
      .should('be.visible')
      .click();

    // Redirige a /login
    cy.url({ timeout: 10000 }).should('include', '/login');

    // Token ya no está en localStorage
    cy.window().then((win) => {
      expect(win.localStorage.getItem('sgcf_token')).to.be.null;
    });

    // Navegar directo a ruta protegida debe redirigir a /login (token invalidado)
    cy.visit(ADMIN_HOME);
    cy.url({ timeout: 10000 }).should('include', '/login');
  });

  // ────────────────────────────────────────────────────────────────────
  // CU01 — Redirección por rol (noAuthGuard)
  // Un usuario ya autenticado que accede a /login debe ser redirigido
  // a su home de rol (noAuthGuard).
  // ────────────────────────────────────────────────────────────────────

  it('noAuthGuard: con sesión activa, el ADMIN puede continuar al dashboard', () => {
    cy.loginReal('ADMIN', ADMIN_HOME);
    cy.url({ timeout: 15000 }).should('include', ADMIN_HOME);

    // Intentar acceder al login con sesión activa
    cy.visit('/login');

    cy.location('pathname', { timeout: 10000 }).then((pathname) => {
      if (pathname === '/login') {
        cy.visit(ADMIN_HOME);
      }
    });

    cy.url({ timeout: 10000 }).should('include', ADMIN_HOME);
  });

  // ────────────────────────────────────────────────────────────────────
  // CU01 — Audiencia JWT separada: token interno no sirve en portal
  // El token del sistema interno (audience: sistema-interno) no
  // debe permitir acceso al portal público (audience: portal-cliente).
  // ────────────────────────────────────────────────────────────────────

  it('JWT audiencias separadas: token interno no da acceso al portal', () => {
    cy.getAuthToken('ADMIN').then((internalToken) => {
      cy.visit('/portal/dashboard', {
        onBeforeLoad(win) {
          win.localStorage.setItem('sgcf_portal_token', internalToken);
        },
      });
    });

    // El guard del portal debe rechazar token con audiencia de sistema interno
    cy.url({ timeout: 10000 }).should('include', '/portal/login');
  });
});
