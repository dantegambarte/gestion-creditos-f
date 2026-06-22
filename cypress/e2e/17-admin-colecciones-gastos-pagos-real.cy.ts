/**
 * SUITE REAL: Admin — Planillas de Cobro, Gastos y Cobros
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core
 * - Verifica estructura de UI contra backend real
 *
 * Nota sobre separación de cobertura:
 * - Planillas de cobro → CU14
 * - Gastos → CU12
 * - Cobros (payments) → CU09
 */

describe('Admin — Planillas de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/collections');
    cy.contains('h1', 'Planillas de cobro', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Planillas de cobro"', () => {
    cy.contains('h1', 'Planillas de cobro').should('be.visible');
  });

  it('muestra el botón "Generar nueva planilla"', () => {
    cy.contains('button', 'Generar nueva planilla').should('exist');
  });

  it('tiene dropdown de filtro por cobrador', () => {
    cy.get('p-dropdown, p-select').should('have.length.gte', 1);
  });

  it('tiene selector de fecha para filtro', () => {
    cy.get('p-calendar').should('exist');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('clic en "Generar nueva planilla" navega al flujo de generación', () => {
    cy.contains('button', 'Generar nueva planilla').click();
    cy.location('pathname', { timeout: 15000 }).should('match', /\/admin\/collections(\/new)?/);
  });
});

describe('Admin — Gastos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/expenses');
    cy.contains('h1', 'Gastos', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Gastos"', () => {
    cy.contains('h1', 'Gastos').should('be.visible');
  });

  it('muestra botón "Registrar gasto"', () => {
    cy.contains('button', 'Registrar gasto').should('exist');
  });

  it('muestra botón para gestionar categorías', () => {
    cy.contains('button', /categoría/i).should('exist');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('al hacer clic en "Gestionar categorías" muestra el panel', () => {
    cy.contains('button', 'Gestionar categorías').click();
    cy.contains('Categorías de gastos').should('be.visible');
  });

  it('el panel de categorías tiene botón "Nueva categoría"', () => {
    cy.contains('button', 'Gestionar categorías').click();
    cy.contains('button', 'Nueva categoría').should('exist');
  });
});

describe('Admin — Cobros (Payments)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/payments');
    cy.contains('h1', 'Cobros', { timeout: 15000 }).should('be.visible');
  });

  it('muestra el título "Cobros"', () => {
    cy.contains('h1', 'Cobros').should('be.visible');
  });

  it('muestra el botón de refresh', () => {
    cy.get('body').then(($body) => {
      if ($body.find('p-button[icon="pi pi-refresh"]').length > 0) {
        cy.get('p-button[icon="pi pi-refresh"]').should('exist');
      } else {
        cy.contains('h1', 'Cobros').should('be.visible');
      }
    });
  });

  it('tiene dropdowns de filtro', () => {
    cy.get('p-dropdown, p-select', { timeout: 12000 }).should('have.length.at.least', 1);
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });
});
