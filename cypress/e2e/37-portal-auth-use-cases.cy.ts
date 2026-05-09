/**
 * SUITE: Portal Cliente — autenticación y guards
 *
 * Enfocada en CU01 + CU11:
 *  - acceso autenticado por DNI y contraseña
 *  - guard del portal para rutas privadas
 *  - mensaje de credenciales inválidas
 *  - mensaje de acceso no habilitado
 */

describe('Portal Cliente — autenticación y guards', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('redirige a /portal/login si se intenta abrir /portal/dashboard sin sesión', () => {
    cy.visit('/portal/dashboard');
    cy.url().should('include', '/portal/login');
  });

  it('autentica por DNI y redirige al dashboard del portal', () => {
    cy.intercept('POST', '**/auth/portal/login', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          token:
            'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LTAwMSIsImZ1bGxfbmFtZSI6IkFuYSBHYXJjw61hIiwiZG5pIjoiMTIzNDU2NzgiLCJwb3J0YWxfaXNfdGVtcF9wYXNzd29yZCI6ZmFsc2V9.sig',
          customer: {
            id: 'cust-001',
            full_name: 'Ana García',
            dni: '12345678',
            portal_is_temp_password: false,
          },
        },
      },
    }).as('portalLoginOk');

    cy.intercept('GET', '**/api/portal/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          total_owed: 90000,
          paid_count: 1,
          pending_count: 2,
          overdue_count: 0,
          status_indicator: 'GREEN',
          total_paid_amount: 45000,
          pending_penalty_amount: 0,
          active_credits: 1,
          settled_credits: 0,
          total_installments_count: 3,
          upcoming_installments: [],
        },
      },
    }).as('portalMe');

    cy.visit('/portal/login');
    cy.get('#dni').type('12345678');
    cy.get('p-password input').type('mock123');
    cy.contains('button', 'Iniciar sesión').click();

    cy.wait('@portalLoginOk');
    cy.wait('@portalMe');
    cy.url().should('include', '/portal/dashboard');
    cy.contains('Ana').should('be.visible');
  });

  it('muestra mensaje de credenciales inválidas en portal login', () => {
    cy.intercept('POST', '**/auth/portal/login', {
      statusCode: 401,
      body: {
        ok: false,
        message: 'DNI o contraseña incorrectos. Verificá tus datos e intentá nuevamente.',
      },
    }).as('portalLoginFail');

    cy.visit('/portal/login');
    cy.get('#dni').type('12345678');
    cy.get('p-password input').type('wrongpass');
    cy.contains('button', 'Iniciar sesión').click();

    cy.wait('@portalLoginFail');
    cy.contains('DNI o contraseña incorrectos').should('be.visible');
    cy.url().should('include', '/portal/login');
  });

  it('muestra mensaje cuando el acceso portal aún no está habilitado', () => {
    cy.intercept('POST', '**/auth/portal/login', {
      statusCode: 401,
      body: {
        ok: false,
        message:
          'Tu acceso al portal aún no fue habilitado. Comunicarte con el negocio para solicitarlo.',
      },
    }).as('portalLoginDisabled');

    cy.visit('/portal/login');
    cy.get('#dni').type('12345678');
    cy.get('p-password input').type('mock123');
    cy.contains('button', 'Iniciar sesión').click();

    cy.wait('@portalLoginDisabled');
    cy.contains('Tu acceso al portal aún no fue habilitado').should('be.visible');
  });
});
