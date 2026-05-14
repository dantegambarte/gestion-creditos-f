/**
 * SUITE: Cambio obligatorio de contraseña
 *
 * Alineado a CU01 y CU11:
 *  - Si el usuario entra con contraseña temporal, no puede operar hasta cambiarla.
 *  - El portal cliente también debe forzar cambio de contraseña en primer acceso.
 *  - No se valida aquí recuperación automática por email porque los casos de uso la prohíben.
 */

describe('Cambio de contraseña interno (/change-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('muestra banner obligatorio y oculta Cancelar cuando la contraseña es temporal', () => {
    const tempUser = {
      id: 'usr-temp-002',
      full_name: 'Vendedor Temporal',
      name: 'Vendedor Temporal',
      dni: '44556688',
      avatar: 'VT',
      roles: ['SELLER'],
      is_temp_password: true,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItdGVtcC0wMDIiLCJyb2xlIjoiU0VMTEVSIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_temp_2',
    };

    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: tempUser.id,
          full_name: tempUser.full_name,
          dni: tempUser.dni,
          role: 'SELLER',
          status: 'ACTIVE',
          is_temp_password: true,
          force_relogin_at: null,
        },
      },
    }).as('authMeTemp');

    cy.visit('/change-password', {
      onBeforeLoad(win) {
        win.localStorage.setItem('sgcf_token', tempUser.token);
        win.localStorage.setItem('sgcf_user', JSON.stringify(tempUser));
      },
    });

    cy.wait('@authMeTemp');
    cy.contains('Tu contraseña es temporal').should('be.visible');
    cy.contains('button', 'Cancelar').should('not.exist');
  });

  it('permite cambiar la contraseña temporal y redirige al home del rol', () => {
    const tempUser = {
      id: 'usr-temp-003',
      full_name: 'Vendedor Temporal',
      name: 'Vendedor Temporal',
      dni: '44556699',
      avatar: 'VT',
      roles: ['SELLER'],
      is_temp_password: true,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItdGVtcC0wMDMiLCJyb2xlIjoiU0VMTEVSIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_temp_3',
    };

    let firstMe = true;
    cy.intercept('GET', '**/auth/me', (req) => {
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: {
            id: tempUser.id,
            full_name: tempUser.full_name,
            dni: tempUser.dni,
            role: 'SELLER',
            status: 'ACTIVE',
            is_temp_password: firstMe,
            force_relogin_at: null,
          },
        },
      });
      firstMe = false;
    }).as('authMeFlow');

    cy.intercept('PATCH', '**/users/me/change-password', {
      statusCode: 200,
      body: { ok: true, data: null },
    }).as('changePassword');

    cy.visit('/change-password', {
      onBeforeLoad(win) {
        win.localStorage.setItem('sgcf_token', tempUser.token);
        win.localStorage.setItem('sgcf_user', JSON.stringify(tempUser));
      },
    });

    cy.wait('@authMeFlow');

    cy.get('p-password').eq(0).find('input').type('temp1234');
    cy.get('p-password').eq(1).find('input').type('Nueva1234');
    cy.get('p-password').eq(2).find('input').type('Nueva1234');
    cy.contains('button', 'Cambiar contraseña').click();

    cy.wait('@changePassword');
    cy.wait('@authMeFlow');
    cy.url().should('include', '/seller/operations');
  });
});

describe('Cambio de contraseña portal (/portal/change-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('redirige al cambio obligatorio cuando el login portal devuelve contraseña temporal', () => {
    cy.intercept('POST', '**/auth/portal/login', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          token:
            'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LXRlbXAtMDAxIiwiZnVsbF9uYW1lIjoiQ2xpZW50ZSBUZW1wb3JhbCIsImRuaSI6IjEyMzQ1Njc4IiwicG9ydGFsX2lzX3RlbXBfcGFzc3dvcmQiOnRydWV9.sig',
          customer: {
            id: 'cust-temp-001',
            full_name: 'Cliente Temporal',
            dni: '12345678',
            portal_is_temp_password: true,
          },
        },
      },
    }).as('portalLoginTemp');

    cy.visit('/portal/login');
    cy.get('#dni').type('12345678');
    cy.get('p-password input').type('Temp1234');
    cy.contains('button', 'Iniciar sesión').click();

    cy.wait('@portalLoginTemp');
    cy.url().should('include', '/portal/change-password');
    cy.contains('Tenés una contraseña temporal').should('be.visible');
  });

  it('permite cambiar la contraseña temporal del portal y redirige al dashboard', () => {
    cy.clock();

    cy.intercept('POST', '**/auth/portal/change-password', {
      statusCode: 200,
      body: { ok: true, data: null },
    }).as('portalChangePassword');

    cy.intercept('GET', '**/api/portal/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          total_owed: 150000,
          paid_count: 2,
          pending_count: 3,
          overdue_count: 0,
          status_indicator: 'GREEN',
          total_paid_amount: 50000,
          pending_penalty_amount: 0,
          active_credits: 1,
          settled_credits: 0,
          total_installments_count: 5,
          upcoming_installments: [],
        },
      },
    }).as('portalAccountSummary');

    cy.loginPortalAs('/portal/change-password', {
      customer: {
        id: 'cust-temp-002',
        fullName: 'Cliente Temporal',
        dni: '12345678',
        portalIsTempPassword: true,
      },
    });

    cy.get('#current-password').type('Temp1234');
    cy.get('#new-password').type('Nueva1234');
    cy.get('#confirm-password').type('Nueva1234');
    cy.contains('button', 'Cambiar contraseña').click();

    cy.wait('@portalChangePassword');
    cy.tick(1600);
    cy.wait('@portalAccountSummary');
    cy.url().should('include', '/portal/dashboard');
  });
});
