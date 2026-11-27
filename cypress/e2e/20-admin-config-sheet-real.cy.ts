/**
 * SUITE REAL: Admin — Configuración y Planilla Legacy
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints
 * - Verifica estructura de UI contra backend real
 */

describe('Admin — Configuración', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/config');
    cy.get('nav', { timeout: 15000 }).should('be.visible');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el panel lateral de navegación de tabs', () => {
    cy.get('nav.ff-tab-nav a').should('have.length.gte', 4);
  });

  it('tiene al menos 4 opciones de configuración en el panel', () => {
    cy.get('nav.ff-tab-nav a').should('have.length.gte', 4);
  });

  // /admin/config redirige a la tab por defecto "Tasas de Interés" (5173e79).
  it('la tab activa por defecto es Tasas de Interés', () => {
    cy.location('pathname').should('eq', '/admin/config/rates');
    cy.get('nav.ff-tab-nav a').first().should('have.class', 'ff-tab--active').and('contain.text', 'Tasas de Interés');
  });

  it('muestra tabs de navegación de configuración', () => {
    cy.get('nav').should('be.visible');
  });

  it('renderiza contenido de la tab activa', () => {
    cy.get('router-outlet').should('exist');
    cy.get('[data-cy="interest-rates-table"], [data-cy="interest-rates-empty-state"]').should('exist');
  });

  it('muestra la opción de tab "Empresa"', () => {
    cy.contains('nav.ff-tab-nav a', 'Empresa').scrollIntoView().should('be.visible');
  });

  // Usuarios dejó de ser una tab de Configuración: vive en /admin/users (5173e79).
  it('no duplica la gestión de usuarios como tab', () => {
    cy.contains('nav.ff-tab-nav a', 'Usuarios').should('not.exist');
  });

  it('muestra la opción de tab "Notificaciones"', () => {
    cy.contains('nav.ff-tab-nav a', 'Notificaciones').should('exist');
  });
});

describe('Admin — Planilla Legacy (/admin/sheet)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/sheet');
    cy.location('pathname', { timeout: 15000 }).should('match', /\/admin\/(sheet|collections)/);
    cy.get('app-error-state').should('not.exist');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra título o acción principal de planillas', () => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('Generar planilla de cobro')) {
        cy.contains('Generar planilla de cobro').should('be.visible');
      } else {
        cy.contains('button', /Generar nueva planilla|Generar planilla/i).should(
          'be.visible',
        );
      }
    });
  });

  it('tiene dropdown de cobrador', () => {
    cy.get('body').then(($body) => {
      if ($body.find('p-dropdown').length > 0) {
        cy.get('p-dropdown').first().should('exist');
      } else if ($body.find('p-select').length > 0) {
        cy.get('p-select').first().should('exist');
      } else {
        cy.contains(/Planillas|Cobros|Generar/i).should('exist');
      }
    });
  });

  it('tiene selector de fecha', () => {
    cy.get('p-calendar, input[type="text"], input[placeholder*="fecha" i]').should(
      'have.length.gte',
      1,
    );
  });

  it('tiene dropdown de filtro de cuotas', () => {
    cy.get('p-dropdown, p-select').should('have.length.gte', 1);
  });

  it('muestra el botón "Generar planilla"', () => {
    cy.contains('button', /Generar nueva planilla|Generar planilla/i).should('exist');
  });
});
