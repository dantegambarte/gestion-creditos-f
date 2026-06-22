/**
 * SUITE REAL: Admin — Generar Planilla de Cobro (modal en /admin/collections)
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints
 * - Verifica estructura de UI contra backend real
 */

describe('Admin — Generar Planilla de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.getAuthToken('ADMIN').then((token) => {
      cy.request({
        method: 'GET',
        url: `${String(Cypress.env('apiBaseUrl'))}/auth/me`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((meRes) => {
        const user = meRes.body?.data ?? null;

        cy.visit('/admin/collections', {
          onBeforeLoad(win) {
            win.localStorage.setItem('sgcf_token', token);
            if (user) {
              win.localStorage.setItem('sgcf_user', JSON.stringify(user));
            }
          },
        });
      });
    });
    cy.location('pathname', { timeout: 20000 }).should('eq', '/admin/collections');
    cy.contains('button', 'Generar nueva planilla', { timeout: 20000 }).should('be.visible');
    cy.contains('button', 'Generar nueva planilla', { timeout: 15000 }).click();
    cy.contains('h2', 'Generar planilla de cobro', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Generar planilla de cobro"', () => {
    cy.contains('h2', 'Generar planilla de cobro').should('be.visible');
  });

  it('muestra bloque de impacto de generación', () => {
    cy.contains('Se van a generar').should('be.visible');
    cy.contains('Estado del día').should('be.visible');
  });

  it('tiene dropdown de cobrador', () => {
    cy.get('p-dropdown').should('have.length.gte', 1);
  });

  it('tiene selector de fecha', () => {
    cy.get('p-calendar').should('exist');
  });

  it('tiene filtro de cuotas', () => {
    cy.get('input[name="generateFilter"]').should('have.length.gte', 2);
  });

  it('muestra botón "Generar"', () => {
    cy.contains('button', 'Generar').should('exist');
  });

  it('botón Cancelar navega a /admin/collections', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('include', '/admin/collections');
    cy.url().should('not.include', '/new');
  });
});
