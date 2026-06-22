/**
 * SUITE REAL: Wizard "Nueva Operación" — Unhappy Paths (backend real).
 *
 * Reglas:
 * - Usa login real
 * - No mockea endpoints core
 * - Valida bloqueos funcionales del wizard
 */

const ADMIN_NEW_OP_URL = '/admin/operations/new';

/**
 * Avanza al paso de cliente seleccionando tipo préstamo.
 */
const goToClientStepFromLoanType = (): void => {
  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-loan"]', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.contains('Paso 2 de 5').should('be.visible');
};

/**
 * Avanza al paso de cliente seleccionando tipo venta.
 */
const goToClientStepFromSaleType = (): void => {
  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-sale"]', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.contains('Paso 2 de 5').should('be.visible');
};

/**
 * Selecciona el primer cliente activo y avanza al paso de productos.
 */
const pickFirstActiveClient = (): void => {
  cy.contains('[data-cy^="client-card-"]', 'ACTIVO', { timeout: 20000 })
    .first()
    .click();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 3 de 5').should('be.visible');
};

/**
 * Agrega una unidad en venta y avanza al paso de condiciones.
 */
const addOneSaleUnitAndGoToConditions = (): void => {
  cy.get('[data-cy^="sale-product-"]', { timeout: 20000 })
    .first()
    .click({ force: true });
  cy.get('[data-cy^="sale-variant-"]', { timeout: 15000 })
    .first()
    .click({ force: true });
  cy.get('[data-cy="sale-add-unit"]', { timeout: 20000 })
    .first()
    .click({ force: true });

  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 4 de 5').should('be.visible');
};

describe('Wizard Nueva Operación real — Unhappy Paths', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);
  });

  it('recarga en paso intermedio vuelve al inicio del wizard', () => {
    goToClientStepFromLoanType();
    cy.reload();
    cy.contains('Paso 1 de 5', { timeout: 20000 }).should('be.visible');
  });

  it('cancelar en el paso inicial abandona el wizard', () => {
    cy.get('[data-cy="btn-cancelar"] button').click();
    cy.url().should('not.include', '/operations/new');
  });

  it('paso confirmación: con 3 de 4 checks enviar queda deshabilitado', () => {
    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.get('[data-cy="btn-siguiente"] button')
      .should('not.be.disabled')
      .click();
    cy.contains('Paso 5 de 5').should('be.visible');

    cy.get('[data-cy="chk-identity"] .p-checkbox-box').click({ force: true });
    cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click({ force: true });
    cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click({
      force: true,
    });

    cy.get('[data-cy="btn-enviar-aprobacion"] button').should('be.disabled');
  });

  it('paso confirmación: con 4 checks enviar queda habilitado', () => {
    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.get('[data-cy="btn-siguiente"] button')
      .should('not.be.disabled')
      .click();
    cy.contains('Paso 5 de 5').should('be.visible');

    cy.get('[data-cy="chk-identity"] .p-checkbox-box').click({ force: true });
    cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click({ force: true });
    cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click({
      force: true,
    });
    cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click({ force: true });

    cy.get('[data-cy="btn-enviar-aprobacion"] button').should(
      'not.be.disabled',
    );
  });
});
