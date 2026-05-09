/**
 * SUITE: Admin — Configuración y Planilla Legacy
 *
 * Cubre:
 *  - Config: panel lateral con tabs, contenido de cada tab principal
 *  - Sheet (planilla legacy): formulario de generación
 */

describe('Admin — Configuración', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/config');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el panel lateral de navegación de tabs', () => {
    cy.get('nav.flex.items-end a').should('have.length.gte', 4);
  });

  it('tiene al menos 4 opciones de configuración en el panel', () => {
    cy.get('nav.flex.items-end a').should('have.length.gte', 4);
  });

  it('la tab activa tiene estilo visual de selección', () => {
    cy.get('nav.flex.items-end a').first().should('have.class', 'border-blue-500');
  });

  it('muestra tabs de navegación de configuración', () => {
    cy.get('nav').should('be.visible');
  });

  it('renderiza contenido de la tab activa', () => {
    cy.get('router-outlet').should('exist');
    cy.contains('Datos de la Empresa').should('be.visible');
  });

  it('muestra la opción de tab "General"', () => {
    cy.contains('nav.flex.items-end a', 'General').should('be.visible');
  });

  it('muestra la opción de tab "Usuarios"', () => {
    cy.contains('nav.flex.items-end a', 'Usuarios').scrollIntoView().should('be.visible');
  });

  it('muestra la opción de tab "Notificaciones"', () => {
    cy.contains('nav.flex.items-end a', 'Notificaciones').should('exist');
  });
});

describe('Admin — Planilla (Sheet)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'collector-1',
            full_name: 'Cobrador Demo',
            dni: '30111222',
            email: 'collector@example.com',
            address: 'Calle 123',
            role: 'COLLECTOR',
            status: 'ACTIVE',
            is_temp_password: false,
            failed_attempts: 0,
            locked_at: null,
            last_login_at: null,
            created_at: '2026-05-05T10:00:00.000Z',
          },
        ],
      },
    }).as('sheetUsers');

    cy.intercept('GET', '**/api/collections*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('sheetCollections');

    cy.loginAs('ADMIN', '/admin/sheet');
    cy.wait('@sheetUsers');
    cy.wait('@sheetCollections');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el título "Generar planilla de cobro"', () => {
    cy.contains('Generar planilla de cobro').should('be.visible');
  });

  it('tiene dropdown de cobrador', () => {
    cy.get('p-dropdown').first().should('exist');
  });

  it('tiene input de fecha', () => {
    cy.get('input[type="date"]').should('exist');
  });

  it('tiene dropdown de filtro de cuotas', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
  });

  it('muestra el botón "Generar planilla"', () => {
    cy.contains('button', 'Generar planilla').should('exist');
  });
});
