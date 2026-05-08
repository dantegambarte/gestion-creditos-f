/**
 * SUITE: Autenticación (Login)
 *
 * Cubre:
 *  - Renderizado del formulario de login
 *  - Validaciones de campos vacíos y formato inválido
 *  - Login exitoso como Admin → redirige a /admin/dashboard
 *  - Login exitoso como Seller → redirige a /seller/operations
 *  - Login exitoso como Collector → redirige a /collector/route
 *  - Login fallido (DNI no registrado) → muestra mensaje de error
 *  - noAuthGuard: usuario autenticado no puede acceder a /login
 *  - Logout desde sidebar → redirige a /login
 */

describe('Autenticación', () => {
  beforeEach(() => {
    cy.logout(); // clearLocalStorage + visit('/login')
    cy.viewport(1280, 720);
  });

  // ── Renderizado ──────────────────────────────────────────────────────────────
  it('muestra el formulario de login correctamente', () => {
    cy.get('[data-testid="input-dni"]').should('be.visible');
    // p-password renderiza un <input> interno; el data-testid está en el wrapper
    cy.get('[data-testid="input-password"] input').should('be.visible');
    cy.get('[data-testid="btn-login"]').should('be.visible').and('contain.text', 'Iniciar Sesión');
    cy.contains('Ingresá tus credenciales para continuar').should('be.visible');
  });

  // ── Validaciones de formulario ───────────────────────────────────────────────
  it('muestra error al enviar formulario vacío', () => {
    cy.get('[data-testid="btn-login"]').click();
    cy.contains('El DNI es obligatorio').should('be.visible');
    cy.contains('La contraseña es obligatoria').should('be.visible');
  });

  it('muestra error de formato cuando el DNI tiene menos de 7 dígitos', () => {
    cy.get('[data-testid="input-dni"]').type('123');
    cy.get('[data-testid="btn-login"]').click();
    cy.contains('DNI inválido (7-9 dígitos)').should('be.visible');
  });

  it('muestra error de formato cuando el DNI contiene letras', () => {
    cy.get('[data-testid="input-dni"]').type('ABCD123');
    cy.get('[data-testid="btn-login"]').click();
    cy.contains('DNI inválido (7-9 dígitos)').should('be.visible');
  });

  // ── Login exitoso — Admin ────────────────────────────────────────────────────
  // cy.intercept de POST /auth/login porque la app usa AuthService (useMocks=false)
  // y el backend rechazaría los tokens mock con 401.
  it('autentica a un Admin y redirige a /admin/dashboard', () => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: { ok: true, data: { user: { id: 'usr-001', full_name: 'Carlos López', dni: '12345678', role: 'ADMIN', is_temp_password: false }, token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwicm9sZSI6IkFETUlOIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_admin' } },
    }).as('loginAdmin');

    cy.get('[data-testid="input-dni"]').type('12345678');
    cy.get('[data-testid="input-password"] input').type('mock123');
    cy.get('[data-testid="btn-login"]').click();

    cy.wait('@loginAdmin');
    cy.url().should('include', '/admin/dashboard');
    cy.contains('Carlos López').should('be.visible');
  });

  // ── Login exitoso — Seller ───────────────────────────────────────────────────
  it('autentica a un Seller y redirige a /seller/operations', () => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: { ok: true, data: { user: { id: 'usr-002', full_name: 'María Sánchez', dni: '87654321', role: 'SELLER', is_temp_password: false }, token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAyIiwicm9sZSI6IlNFTExFUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_seller' } },
    }).as('loginSeller');

    cy.get('[data-testid="input-dni"]').type('87654321');
    cy.get('[data-testid="input-password"] input').type('mock123');
    cy.get('[data-testid="btn-login"]').click();

    cy.wait('@loginSeller');
    cy.url().should('include', '/seller/operations');
    cy.contains('María Sánchez').should('be.visible');
  });

  // ── Login exitoso — Collector ────────────────────────────────────────────────
  it('autentica a un Collector y redirige a /collector/route', () => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 200,
      body: { ok: true, data: { user: { id: 'usr-003', full_name: 'Juan Pedraza', dni: '11223344', role: 'COLLECTOR', is_temp_password: false }, token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAzIiwicm9sZSI6IkNPTExFQ1RPUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_collector' } },
    }).as('loginCollector');

    cy.get('[data-testid="input-dni"]').type('11223344');
    cy.get('[data-testid="input-password"] input').type('mock123');
    cy.get('[data-testid="btn-login"]').click();

    cy.wait('@loginCollector');
    cy.url().should('include', '/collector/route');
    cy.contains('Juan Pedraza').should('be.visible');
  });

  // ── Login fallido ────────────────────────────────────────────────────────────
  it('muestra mensaje de error con credenciales incorrectas', () => {
    cy.intercept('POST', '**/auth/login', {
      statusCode: 401,
      body: { ok: false, message: 'Credenciales incorrectas.' },
    }).as('loginFailed');

    cy.get('[data-testid="input-dni"]').type('99999999');
    cy.get('[data-testid="input-password"] input').type('wrongpass');
    cy.get('[data-testid="btn-login"]').click();
    cy.wait('@loginFailed');

    cy.get('[data-testid="login-error"]')
      .should('be.visible')
      .and('contain.text', 'Credenciales incorrectas');
    cy.url().should('include', '/login');
  });

  // ── noAuthGuard ──────────────────────────────────────────────────────────────
  it('redirige a /admin/dashboard si el usuario ya está autenticado como Admin', () => {
    cy.loginAs('ADMIN');
    cy.visit('/login');
    cy.url().should('include', '/admin');
  });

  // ── Logout ───────────────────────────────────────────────────────────────────
  it('cierra sesión y redirige al login', () => {
    cy.loginAs('ADMIN');
    cy.url().should('include', '/admin');
    cy.get('[data-testid="logout-btn"]').click();
    cy.url().should('include', '/login');
    // localStorage limpio
    cy.window().then((win) => {
      expect(win.localStorage.getItem('sgcf_user')).to.be.null;
    });
  });
});
