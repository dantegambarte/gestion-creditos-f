/// <reference types="cypress" />

/**
 * P22 (#56, #57): aterrizaje por rol tras el login y diálogos de confirmación
 * que muestran datos del servidor como texto. Todo stubbeado, sin backend real.
 */

type Role = 'ADMIN' | 'SELLER' | 'COLLECTOR' | 'SELLER_COLLECTOR' | 'CASHIER';

const LANDING: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  SELLER: '/seller/operations',
  COLLECTOR: '/collector/route',
  SELLER_COLLECTOR: '/collector/route',
  CASHIER: '/login',
};

const XSS_NAME = '<img src=x onerror=alert(1)>';

/** Usuario crudo del backend para el rol indicado. */
const rawUser = (role: Role) => ({
  id: `usr-${role.toLowerCase()}`,
  full_name: `Usuario ${role}`,
  dni: '30111222',
  email: null,
  phone: null,
  address: null,
  role,
  status: 'ACTIVE',
  is_temp_password: false,
  force_relogin_at: null,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
});

/** Responde vacío a cualquier llamada de API no stubbeada explícitamente. */
const stubApiFallback = () => {
  cy.intercept({ url: /\/api\// }, { statusCode: 200, body: { ok: true, data: [] } });
};

const viewports: Array<[string, () => void]> = [
  ['desktop', () => cy.viewport(1280, 800)],
  ['mobile', () => cy.viewport(375, 667)],
];

viewports.forEach(([label, setViewport]) => {
  describe(`P22 aterrizaje por rol (${label})`, () => {
    beforeEach(() => {
      setViewport();
      stubApiFallback();
    });

    (Object.keys(LANDING) as Role[]).forEach((role) => {
      it(`login con ${role} aterriza en ${LANDING[role]}`, () => {
        cy.intercept('POST', '**/api/auth/login', {
          statusCode: 200,
          body: { ok: true, data: { token: 'e2e-token', user: rawUser(role) } },
        }).as('login');
        cy.intercept('GET', '**/api/auth/me', {
          statusCode: 200,
          body: { ok: true, data: rawUser(role) },
        });

        cy.visit('/login', { onBeforeLoad: (win) => win.localStorage.clear() });
        cy.get('[data-testid="input-dni"]').type('30111222');
        cy.get('[data-testid="input-password"] input').type('Secreta123');
        cy.get('[data-testid="btn-login"]').click();
        cy.wait('@login');

        cy.location('pathname', { timeout: 10000 }).should('eq', LANDING[role]);
        if (role === 'CASHIER') {
          // Sin bucle: la URL se mantiene estable y el formulario sigue visible.
          cy.wait(1000);
          cy.location('pathname').should('eq', '/login');
          cy.get('[data-testid="btn-login"]').should('be.visible');
        }
      });
    });
  });

  describe(`P22 diálogo de confirmación seguro (${label})`, () => {
    beforeEach(() => {
      setViewport();
      stubApiFallback();
    });

    it('muestra un nombre con <img onerror> como texto literal', () => {
      cy.intercept('GET', '**/api/users/usr-xss', {
        statusCode: 200,
        body: { ok: true, data: { ...rawUser('SELLER'), id: 'usr-xss', full_name: XSS_NAME, failed_attempts: 0, locked_at: null } },
      }).as('user');
      cy.loginAs('ADMIN', '/admin/users/usr-xss');
      cy.wait('@user');

      cy.on('window:alert', () => {
        throw new Error('Se ejecutó un alert inyectado');
      });
      cy.get('[data-cy="admin-user-detail-status-action"]').filter(':visible').first().click();

      cy.get('.p-confirm-dialog:visible, .p-dialog:visible')
        .first()
        .within(() => {
          cy.get('img').should('not.exist');
          cy.contains(XSS_NAME).should('be.visible');
        });
    });
  });
});
