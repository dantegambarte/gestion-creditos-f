/**
 * SUITE: Admin — Reportes y Morosidad (real backend)
 */

describe('Admin — Reportes', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/reports');
  });

  it('renderiza sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/reports');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra al menos 2 tabs de navegación', () => {
    cy.get('button.border-b-2').should('have.length.gte', 2);
  });

  it('la primera tab está activa con estilo resaltado', () => {
    cy.get('button.border-blue-600').should('exist');
  });

  it('muestra contenido financiero (montos o skeletons)', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('p-card, app-loading-state, p-skeleton, p-table').should('exist');
  });

  it('se puede navegar entre tabs sin error', () => {
    cy.get('button.border-b-2').eq(1).click({ force: true });
    cy.get('app-error-state').should('not.exist');
  });
});

describe('Admin — Morosidad', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/delinquency');
  });

  it('renderiza sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/delinquency');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra KPI cards de mora (skeleton o reales)', () => {
    cy.get('p-card').should('exist');
  });

  it('muestra métricas o estados visuales sin romper', () => {
    cy.get('p-card, app-loading-state, p-skeleton').should('exist');
  });

  it('muestra grilla o estado de carga', () => {
    cy.get('p-table, app-loading-state, p-skeleton').should('exist');
  });
});
