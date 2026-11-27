/**
 * P20 (#39, #55): el access token vive sólo en memoria y la sesión se
 * restaura con el refresh token (cookie HttpOnly); el portal muestra las
 * cuotas vencidas como próxima cuota y el bloqueo lo decide el backend.
 * Specs stubbeados (sin backend real), desktop y mobile.
 * Correr con CYPRESS_realAuthEnabled=false.
 */

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

const ADMIN_USER = {
  id: 'usr-001',
  full_name: 'Carlos López',
  dni: '12345678',
  email: 'admin@siscreditos.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  is_temp_password: false,
  force_relogin_at: null,
};

/**
 * Devuelve la fecha local desplazada `offset` días en formato yyyy-mm-dd.
 * @param offset - días respecto de hoy (negativo = pasado)
 */
function localIso(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Verifica que ningún storage del navegador guarde tokens.
 * @param win - ventana de la app
 */
function expectNoTokensInStorage(win: Cypress.AUTWindow): void {
  expect(win.localStorage.getItem('sgcf_token'), 'sgcf_token').to.be.null;
  expect(win.localStorage.getItem('sgcf_portal_token'), 'sgcf_portal_token').to.be.null;
  expect(win.sessionStorage.length, 'sessionStorage').to.eq(0);
  for (let i = 0; i < win.localStorage.length; i++) {
    const key = win.localStorage.key(i)!;
    expect(win.localStorage.getItem(key), key).not.to.contain('jwt.');
  }
}

describe('P20 — sesión sin tokens en storage y portal', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    context(name, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        // Respuesta genérica para el resto de la app: no hay backend real.
        cy.intercept('GET', '**/api/**', { ok: true, data: [] });
        cy.intercept('GET', '**/api/auth/me', { ok: true, data: ADMIN_USER }).as('me');
      });

      it('#39: tras el login no queda token en storage y recargar mantiene la sesión vía refresh', () => {
        cy.intercept('POST', '**/api/auth/login', {
          ok: true,
          data: { token: 'jwt.login.token', user: ADMIN_USER },
        }).as('login');

        cy.visit('/login');
        cy.get('input[formControlName="dni"]').type('12345678');
        cy.get('p-password input').type('secreta');
        cy.contains('button', 'Iniciar Sesión').click();
        cy.wait('@login');
        cy.location('pathname').should('eq', '/admin/dashboard');
        cy.window().then(expectNoTokensInStorage);

        cy.intercept('POST', '**/api/auth/refresh', {
          ok: true,
          data: { token: 'jwt.refreshed.token' },
        }).as('refresh');
        // cy.intercept no expone withCredentials: se prueba su efecto, que la
        // cookie de refresh viaja en el POST (el API corre en otro puerto/origen).
        cy.setCookie('e2e_rt_probe', 'refresh-cookie');
        cy.reload();
        cy.wait('@refresh').its('request.headers.cookie').should('include', 'e2e_rt_probe=refresh-cookie');
        cy.wait('@me').its('request.headers.authorization').should('eq', 'Bearer jwt.refreshed.token');
        cy.location('pathname').should('eq', '/admin/dashboard');
        cy.window().then(expectNoTokensInStorage);
      });

      it('#39: un corte de red al iniciar no cierra la sesión', () => {
        cy.intercept('POST', '**/api/auth/refresh', { forceNetworkError: true }).as('refresh');

        cy.visit('/admin/dashboard', {
          onBeforeLoad(win) {
            win.localStorage.setItem('sgcf_user', JSON.stringify({ ...ADMIN_USER, roles: ['ADMIN'], name: ADMIN_USER.full_name, avatar: 'CL' }));
          },
        });
        cy.wait('@refresh');
        cy.location('pathname').should('eq', '/admin/dashboard');
        cy.window().its('localStorage').invoke('getItem', 'sgcf_user').should('not.be.null');
      });

      it('#39: si el backend revoca la sesión al iniciar, vuelve al login', () => {
        cy.intercept('POST', '**/api/auth/refresh', {
          statusCode: 401,
          body: { ok: false, code: 'SESSION_REVOKED', message: 'Sesión revocada.' },
        }).as('refresh');

        cy.visit('/admin/dashboard', {
          onBeforeLoad(win) {
            win.localStorage.setItem('sgcf_user', JSON.stringify({ ...ADMIN_USER, roles: ['ADMIN'], name: ADMIN_USER.full_name, avatar: 'CL' }));
            win.localStorage.setItem('sgcf_token', 'jwt.legacy.token');
          },
        });
        cy.wait('@refresh');
        cy.location('pathname').should('eq', '/login');
        cy.window().then(expectNoTokensInStorage);
      });

      it('#55: el portal muestra la cuota vencida como próxima cuota', () => {
        cy.intercept('GET', '**/api/portal/me', {
          ok: true,
          data: {
            total_owed: 3000,
            paid_count: 1,
            pending_count: 0,
            overdue_count: 1,
            status_indicator: 'RED',
            total_paid_amount: 1000,
            pending_penalty_amount: 0,
            active_credits: 1,
            settled_credits: 0,
            total_installments_count: 3,
            upcoming_installments: [
              {
                id: 'i-2',
                installment_number: 2,
                due_date: localIso(-4),
                amount_due: 1500,
                amount_paid: 0,
                penalty_amount: 0,
                status: 'OVERDUE',
                credit_id: 'cr-1',
                credit_type: 'LOAN',
                credit_installments_count: 3,
                credit_name: null,
              },
            ],
          },
        }).as('summary');

        cy.loginPortalAs('/portal/dashboard');
        cy.wait('@portalRefresh');
        cy.wait('@summary');
        cy.get('[data-cy="portal-dashboard-next-installment-card"]')
          .should('be.visible')
          .and('not.contain.text', 'Sin vencimientos próximos')
          .find('[data-cy="portal-dashboard-next-overdue"]')
          .should('contain.text', 'Vencida');
        cy.window().then(expectNoTokensInStorage);
      });

      it('#55: el login del portal muestra el bloqueo del backend y no cuenta intentos locales', () => {
        cy.intercept('POST', '**/api/auth/portal/login', {
          statusCode: 401,
          body: { ok: false, message: 'DNI o contraseña incorrectos.' },
        }).as('bad');

        cy.visit('/portal/login');
        cy.get('#dni').type('12345678');
        cy.get('p-password input').type('mala');
        for (let i = 0; i < 6; i++) {
          cy.contains('button', 'Iniciar sesión').click();
          cy.wait('@bad');
        }
        cy.get('[data-cy="portal-login-error"]').should('contain.text', 'Credenciales incorrectas.');
        cy.contains('button', 'Iniciar sesión').should('not.be.disabled');

        cy.intercept('POST', '**/api/auth/portal/login', {
          statusCode: 401,
          body: { ok: false, code: 'ACCOUNT_LOCKED', message: 'Tu cuenta fue bloqueada por seguridad.' },
        }).as('locked');
        cy.contains('button', 'Iniciar sesión').click();
        cy.wait('@locked');
        cy.get('[data-cy="portal-login-locked"]')
          .should('be.visible')
          .and('contain.text', 'Tu cuenta fue bloqueada por seguridad.');
        cy.location('pathname').should('eq', '/portal/login');
      });
    });
  });
});
