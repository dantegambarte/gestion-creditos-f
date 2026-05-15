/**
 * SUITE REAL: Nueva Operación (Préstamo) contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core de créditos/aprobaciones
 * - Verifica persistencia real consultando pendientes por API
 */

const ADMIN_NEW_OP_URL = '/admin/operations/new';

type CreditSummary = {
  id: string;
  status: string;
  type: string;
};

/**
 * Obtiene el token real guardado en localStorage tras login.
 * @returns Token Bearer válido para requests autenticados al backend.
 */
const getAuthToken = (): Cypress.Chainable<string> => {
  return cy.window().then((win) => {
    const token = win.localStorage.getItem('sgcf_token');
    expect(token, 'token sgcf_token').to.be.a('string').and.not.be.empty;
    return token as string;
  });
};

/**
 * Consulta un crédito puntual por id usando autenticación real.
 * @param id ID del crédito a consultar.
 * @returns Resumen mínimo del crédito persistido en backend.
 */
const fetchCreditById = (id: string): Cypress.Chainable<CreditSummary> => {
  return getAuthToken().then((token) =>
    cy
      .request({
        method: 'GET',
        url: `/api/credits/${id}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(({ body }) => body?.data as CreditSummary),
  );
};

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
  it('crea préstamo real y persiste id con estado pendiente', () => {
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

      fetchCreditById(createdId as string).then((credit) => {
        expect(credit.id).to.eq(createdId);
        expect(credit.status).to.eq('PENDING_APPROVAL');
        expect(credit.type).to.eq('LOAN');
      });
    });

    cy.contains('.p-toast-message', 'Operación enviada', { timeout: 20000 }).should('be.visible');
    cy.url({ timeout: 20000 }).should('include', '/admin/operations');
  });
});
