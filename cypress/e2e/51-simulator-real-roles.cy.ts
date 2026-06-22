/**
 * SUITE: Simulador — roles con backend real
 *
 * Valida que cada contexto con acceso al simulador cargue opciones reales
 * y pueda ejecutar una simulación contra el backend sin mocks.
 */

type InternalSimulatorCase = {
  role: 'ADMIN' | 'SELLER' | 'SELLER_COLLECTOR' | 'COLLECTOR';
  path: string;
};

const INTERNAL_CASES: InternalSimulatorCase[] = [
  { role: 'ADMIN', path: '/admin/simulator' },
  { role: 'SELLER', path: '/seller/simulator' },
  { role: 'SELLER_COLLECTOR', path: '/seller/simulator' },
  { role: 'COLLECTOR', path: '/collector/simulator' },
];

const LOAN_AMOUNT = '100000';

/**
 * Registra aliases de red para confirmar que el simulador usa backend real.
 */
function spySimulatorRequests(): void {
  cy.intercept('GET', '**/api/credits/simulate/options').as('simulateOptions');
  cy.intercept('POST', '**/api/credits/simulate/all').as('simulateAll');
}

/**
 * Verifica la carga visual base del simulador y que las opciones vienen del backend.
 */
function assertSimulatorLoaded(path: string): void {
  cy.location('pathname', { timeout: 15000 }).should('eq', path);
  cy.wait('@simulateOptions', { timeout: 15000 })
    .its('response.statusCode')
    .should('be.oneOf', [200, 304]);

  cy.get('.sim-shell', { timeout: 15000 }).should('be.visible');
  cy.get('.sim-card--entry').should('be.visible');
  cy.contains('Simular financiamiento').should('be.visible');
  cy.contains('Los valores son orientativos').should('be.visible');
  cy.get('app-error-state').should('not.exist');
}

/**
 * Ejecuta una simulación de préstamo y valida respuesta real del backend.
 */
function simulateLoan(): void {
  cy.contains('button', 'Préstamo').should(
    'have.class',
    'sim-toggle__button--active',
  );
  cy.get('p-inputnumber input, .p-inputnumber-input')
    .first()
    .clear()
    .type(LOAN_AMOUNT);
  cy.contains('button', 'Ver opciones de financiamiento')
    .should('not.be.disabled')
    .click();

  cy.wait('@simulateAll', { timeout: 15000 }).then((interception) => {
    expect(interception.request.body).to.deep.equal({
      type: 'LOAN',
      total_amount: Number(LOAN_AMOUNT),
    });
    expect(interception.response?.statusCode, 'simulate/all status').to.eq(200);
    expect(interception.response?.body?.ok, 'simulate/all ok').to.eq(true);
    expect(interception.response?.body?.data, 'simulate/all data').to.be.an(
      'array',
    );
  });

  cy.get('.sim-card--results', { timeout: 15000 }).should('be.visible');
  cy.contains(/Mensual|Semanal|Quincenal/i).should('exist');
  cy.contains('Total a devolver').should('exist');
}

describe('Simulador — roles internos con backend real', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  INTERNAL_CASES.forEach(({ role, path }) => {
    it(`${role} carga y simula préstamo real`, () => {
      spySimulatorRequests();

      cy.loginReal(role, path);

      assertSimulatorLoaded(path);
      simulateLoan();
    });
  });
});

describe('Simulador — portal cliente con backend real', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('CLIENT carga y simula préstamo real desde portal', () => {
    spySimulatorRequests();

    cy.loginPortalReal('/portal/simulator');

    assertSimulatorLoaded('/portal/simulator');
    simulateLoan();
  });
});
