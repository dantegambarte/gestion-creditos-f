/**
 * SUITE: Comisiones — Seller, Collector y Admin (real backend)
 *
 * Cubre:
 *  - Título "Mis comisiones" en ambos roles
 *  - Dropdown de filtro por estado
 *  - Botón refresh
 *  - Tabla, vacío o estado carga (no error)
 *  - Admin: módulo de liquidaciones (CommissionsComponent)
 */

describe('Seller — Mis Comisiones', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/commissions');
  });

  it('muestra el título "Mis comisiones"', () => {
    cy.contains('h1', 'Mis comisiones').should('be.visible');
  });

  it('muestra el subtítulo de ventas', () => {
    cy.contains('ventas').should('exist');
  });

  it('existe acción de refresh', () => {
    cy.get('p-button[icon*="refresh"], p-button[icon*="sync"], button .pi-refresh, button .pi-sync').should('exist');
  });

  it('muestra dropdown de filtro por estado', () => {
    cy.get('p-dropdown').should('exist');
  });

  it('muestra tabla, vacío o loading (no error)', () => {
    cy.get('p-table, app-empty-state, app-loading-state').should('exist');
    cy.get('app-error-state').should('not.exist');
  });
});

describe('Collector — Mis Comisiones', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('COLLECTOR', '/collector/commissions');
  });

  it('muestra el título "Mis comisiones"', () => {
    cy.contains('h1', 'Mis comisiones').should('be.visible');
  });

  it('muestra el subtítulo de cobros', () => {
    cy.contains('cobros').should('exist');
  });

  it('existe acción de refresh', () => {
    cy.get('p-button[icon*="refresh"], p-button[icon*="sync"], button .pi-refresh, button .pi-sync').should('exist');
  });

  it('muestra tabla, vacío o loading (no error)', () => {
    cy.get('p-table, app-empty-state, app-loading-state').should('exist');
    cy.get('app-error-state').should('not.exist');
  });
});

describe('Admin — Gestión de Comisiones (liquidaciones)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/commissions');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra tabs Liquidaciones / Historial', () => {
    cy.contains('Liquidaciones').should('exist');
    cy.contains('Historial').should('exist');
  });

  it('muestra tabla o skeleton en la tab activa', () => {
    cy.get('p-table, app-loading-state, p-skeleton').should('exist');
  });
});
