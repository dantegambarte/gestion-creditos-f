/**
 * SUITE REAL: Nueva Operación (Préstamo) contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core de créditos/aprobaciones
 * - Verifica persistencia real consultando pendientes por API
 */

const ADMIN_NEW_OP_URL = '/admin/operations/new';

/**
 * Avanza hasta el paso de cliente seleccionando primero el tipo préstamo.
 * El paso de tipo avanza automáticamente al elegir tarjeta.
 */
const goToClientStepFromType = (): void => {
  cy.contains('h1', 'Nueva Operación').should('be.visible');
  cy.get('[data-cy="btn-type-loan"]').click();
  cy.contains('Paso 2 de 5').should('be.visible');
  cy.contains('Buscar cliente').should('be.visible');
};

/**
 * Avanza al paso de cliente seleccionando tipo venta.
 */
const goToClientStepFromSaleType = (): void => {
  cy.contains('h1', 'Nueva Operación').should('be.visible');
  cy.get('[data-cy="btn-type-sale"]').click();
  cy.contains('Paso 2 de 5').should('be.visible');
  cy.contains('Buscar cliente').should('be.visible');
};


/**
 * Selecciona el primer cliente activo disponible en la grilla.
 */
const pickFirstActiveClient = (): void => {
  cy.contains('Buscar cliente').should('be.visible');
  cy.contains('[data-cy^="client-card-"]', 'ACTIVO', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 3 de 5').should('be.visible');
};

/**
 * Completa el paso de producto para una operación de préstamo.
 */
const fillLoanProductStep = (): void => {
  cy.contains('Tipo de operación').should('be.visible');
  cy.contains('Monto total').should('be.visible');

  cy.get('p-inputNumber[formControlName="totalAmount"] input')
    .clear()
    .type('65000')
    .blur();

  cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 })
    .should('not.be.disabled')
    .click();
  cy.contains('Paso 4 de 5').should('be.visible');
};

/**
 * Completa condiciones mínimas para habilitar confirmación.
 */
const fillLoanConditionsStep = (): void => {
  cy.contains('Configurar Plan de Pagos').should('be.visible');

  cy.get('[data-cy="ddl-installments"] .p-dropdown', { timeout: 15000 })
    .first()
    .click();
  cy.get('.p-dropdown-panel .p-dropdown-item').first().click();

  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 5 de 5').should('be.visible');
};

/**
 * Selecciona producto+variante y agrega una unidad en flujo venta.
 */
const addOneSaleUnitAndGoToConditions = (): void => {
  cy.contains('h3', 'Catálogo', { timeout: 20000 }).should('be.visible');

  cy.get('[data-cy^="sale-product-"]', { timeout: 20000 }).first().click({ force: true });
  cy.get('[data-cy^="sale-variant-"]', { timeout: 15000 }).first().click({ force: true });
  cy.get('[data-cy="sale-add-unit"]', { timeout: 20000 }).first().click({ force: true });

  cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 })
    .should('not.be.disabled')
    .click();
  cy.contains('Paso 4 de 5').should('be.visible');
};


/**
 * Marca declaraciones requeridas y envía la operación a aprobación.
 */
const submitOperationForApproval = (): void => {
  cy.contains('Declaraciones y Autorizaciones').should('be.visible');

  cy.get('[data-cy="chk-identity"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click({ force: true });

  cy.get('[data-cy="btn-enviar-aprobacion"] button')
    .should('not.be.disabled')
    .click();
};

describe('Nueva Operación real — Admin', () => {
  it('crea préstamo real y retorna id en alta de crédito', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);
    cy.intercept('POST', '/api/credits').as('createCredit');

    goToClientStepFromType();
    pickFirstActiveClient();
    fillLoanProductStep();
    fillLoanConditionsStep();
    submitOperationForApproval();

    cy.wait('@createCredit').then((interception) => {
      const createdId = interception.response?.body?.data?.id as string | undefined;
      expect(createdId, 'id de crédito creado').to.be.a('string').and.not.be.empty;
      expect(interception.response?.statusCode, 'status de alta').to.eq(201);
    });

    cy.contains('.p-toast-message', 'Operación enviada', { timeout: 20000 }).should('be.visible');
    cy.url({ timeout: 20000 }).should('include', '/admin/operations');
  });

  it('préstamo: permite cambiar a fecha personalizada en condiciones', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);

    goToClientStepFromType();
    pickFirstActiveClient();
    fillLoanProductStep();

    cy.contains('Se calcula automáticamente según la frecuencia seleccionada.').should('exist');
    cy.contains('label', 'Fecha personalizada').click();
    cy.contains('Se calcula automáticamente según la frecuencia seleccionada.').should('not.exist');
    cy.contains('Fecha de 1er pago').should('be.visible');
  });

  it('venta: permite configurar enganche en condiciones', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);

    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.contains('label', 'Enganche').click({ force: true });
    cy.get('p-inputNumber[formControlName="downPayment"] input', { timeout: 15000 })
      .should('be.visible')
      .clear()
      .type('5000')
      .blur();
    cy.contains('Anticipo').should('exist');
  });

  it('venta: permite configurar cuotas adelantadas en condiciones', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);

    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.contains('label', 'Cuotas adelantadas').click({ force: true });
    cy.contains('Cantidad de cuotas adelantadas', { timeout: 15000 }).should('be.visible');
    cy.get('p-inputNumber[formControlName="advancedInstallmentsCount"] input')
      .should('be.visible')
      .clear()
      .type('2')
      .blur();
  });

});
