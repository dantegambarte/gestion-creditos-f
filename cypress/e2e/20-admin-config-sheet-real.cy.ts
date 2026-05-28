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

describe('Admin — Planilla Legacy (/admin/sheet)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/sheet');
    cy.contains('Generar planilla de cobro', { timeout: 15000 }).should('be.visible');
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

  it('tiene selector de fecha', () => {
    cy.get('p-calendar').should('exist');
  });

  it('tiene dropdown de filtro de cuotas', () => {
    cy.get('p-dropdown').should('have.length.gte', 2);
  });

  it('muestra el botón "Generar planilla"', () => {
    cy.contains('button', 'Generar planilla').should('exist');
  });
});
