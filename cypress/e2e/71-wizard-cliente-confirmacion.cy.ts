/**
 * SUITE: Wizard "Nueva Operación" — P13 (#46 y #50).
 *
 * Login real. Se stubbean con cy.intercept los clientes del paso 2, su resumen
 * (con demora), la simulación y el alta del crédito. La unidad la crea
 * apiCreateSaleUnit (el alta se stubbea, así que no se vende) y se desactiva al final.
 */

const ADMIN_NEW_OP_URL = '/admin/operations/new';

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

const CLIENT_A = { id: 'p13-client-a', full_name: 'Cliente P13 Alfa', dni: '30111222' };
const CLIENT_B = { id: 'p13-client-b', full_name: 'Cliente P13 Beta', dni: '30333444' };

/**
 * Arma un cliente crudo (formato backend) activo para el listado.
 * @param {{ id: string; full_name: string; dni: string }} c - datos base
 */
const rawCustomer = (c: { id: string; full_name: string; dni: string }) => ({
  ...c,
  address: 'Calle 123',
  phone: '1100000000',
  email: null,
  status: 'ACTIVE',
  portal_enabled: false,
  created_at: '2026-01-01',
  collector_id: null,
  collector_name: null,
  active_credits: 0,
  delinquency: 'sin mora',
  payment_capacity: 0,
});

/**
 * Arma el resumen de wizard crudo de un cliente.
 * @param {{ id: string; full_name: string; dni: string }} c - datos base
 */
const rawSummary = (c: { id: string; full_name: string; dni: string }) => ({
  ...rawCustomer(c),
  paid_installments: 0,
  pending_installments: 0,
  overdue_installments: 0,
  credits: [],
});

/**
 * Stubbea el listado de clientes del wizard con dos clientes activos.
 */
const stubCustomers = (): void => {
  cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: [rawCustomer(CLIENT_A), rawCustomer(CLIENT_B)] },
  }).as('customers');
};

/**
 * Stubbea el alta del crédito para no persistir nada.
 */
const stubCreateCredit = (): void => {
  cy.intercept('POST', '**/api/credits', {
    statusCode: 201,
    body: { ok: true, data: { id: 'p13-stub-credit', status: 'PENDING_APPROVAL' } },
  }).as('createCredit');
};

/**
 * Elige venta, busca los clientes stub y deja visible el paso 2.
 */
const goToClientStep = (): void => {
  cy.get('[data-cy="btn-type-sale"]', { timeout: 20000 }).should('be.visible').click();
  cy.contains('Paso 2 de 5').should('exist');
  cy.get('[data-cy="input-search-client"]', { timeout: 15000 }).clear().type('Cliente P13');
};

/**
 * Avanza del paso 2 al paso 4 agregando la unidad de E2E.
 * @param {Cypress.SaleUnitFixture} unit - unidad creada para el test
 */
const goToConditions = (unit: Parameters<Cypress.Chainable['selectSaleUnit']>[0]): void => {
  cy.contains('button', 'Continuar con este cliente', { timeout: 15000 })
    .should('be.enabled')
    .click();
  cy.contains('h3', 'Catálogo', { timeout: 30000 }).should('exist');
  cy.selectSaleUnit(unit);
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click({ force: true });
  cy.contains('Paso 4 de 5').should('exist');
};

/**
 * Avanza al paso de confirmación.
 */
const goToConfirm = (): void => {
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click({ force: true });
  cy.contains('Paso 5 de 5').should('exist');
};

VIEWPORTS.forEach(({ name, width, height }) => {
  describe(`Wizard P13 — cliente visible y confirmación fiel (${name})`, () => {
    let unit: Parameters<Cypress.Chainable['selectSaleUnit']>[0];

    beforeEach(() => {
      cy.apiCreateSaleUnit().then((fixture) => {
        unit = fixture;
      });
      stubCustomers();
      stubCreateCredit();
      cy.viewport(width, height);
      cy.loginReal('ADMIN', ADMIN_NEW_OP_URL);
      cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
    });

    afterEach(() => {
      cy.apiDeactivateLeftoverSaleUnits();
    });

    it('#46: cambio rápido de cliente con resumen demorado → POST /credits usa el cliente visible', () => {
      cy.intercept('GET', `**/api/customers/${CLIENT_A.id}/wizard-summary`, {
        statusCode: 200,
        delay: 3000,
        body: { ok: true, data: { ...rawSummary(CLIENT_A), phone: '1199999999' } },
      }).as('summaryA');
      cy.intercept('GET', `**/api/customers/${CLIENT_B.id}/wizard-summary`, {
        statusCode: 200,
        body: { ok: true, data: rawSummary(CLIENT_B) },
      }).as('summaryB');

      goToClientStep();
      cy.get(`[data-cy="client-card-${CLIENT_A.id}"]`, { timeout: 15000 }).click();
      cy.get(`[data-cy="client-card-${CLIENT_B.id}"]`).click();
      cy.wait('@summaryB');
      // La respuesta tardía del cliente A no debe pisar la selección de B.
      cy.wait('@summaryA');
      cy.contains(CLIENT_B.full_name).should('exist');

      goToConditions(unit);
      goToConfirm();
      cy.contains(CLIENT_B.full_name).should('exist');
      cy.get('[data-cy="btn-mark-all"]').click({ force: true });
      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click({ force: true });
      cy.wait('@createCredit')
        .its('request.body')
        .then((body: Record<string, unknown>) => {
          expect(body['customer_id']).to.equal(CLIENT_B.id);
          expect(body['unit_ids']).to.deep.equal([unit.unitId]);
        });
    });

    it('#50: confirmación muestra MIXED como "Efectivo + Transferencia" y el cronograma de la simulación', () => {
      cy.intercept('GET', '**/api/customers/*/wizard-summary', {
        statusCode: 200,
        body: { ok: true, data: rawSummary(CLIENT_A) },
      });
      cy.intercept('POST', '**/api/credits/simulate', (req) => {
        req.reply({
          statusCode: 200,
          body: {
            ok: true,
            data: {
              type: 'SALE',
              payment_frequency: req.body.payment_frequency,
              installments_count: 3,
              total_amount: 300000,
              installment_amount: 90000,
              total_to_return: 270000,
              note: '',
              schedule: [
                { installment_number: 1, due_date: '2027-01-11', amount: 90000 },
                { installment_number: 2, due_date: '2027-02-10', amount: 90000 },
                { installment_number: 3, due_date: '2027-03-10', amount: 90000 },
              ],
            },
          },
        });
      }).as('simulate');

      goToClientStep();
      cy.get(`[data-cy="client-card-${CLIENT_A.id}"]`, { timeout: 15000 }).click();
      goToConditions(unit);

      cy.get('#pay-down').click({ force: true });
      cy.get('[data-cy="sale-down-payment"] input').clear().type('1000');
      cy.get('[data-cy="sale-down-payment-method-mixed"]').click({ force: true });
      cy.get('[data-cy="sale-down-payment-cash"] input').clear().type('400');
      cy.get('[data-cy="sale-down-payment-transfer"] input').clear().type('600');
      cy.get('[data-cy="sale-down-payment-transfer-reference"]').type('P13-MIX');

      cy.contains('button', /simulaci/i).scrollIntoView().click({ force: true });
      cy.wait('@simulate');
      goToConfirm();

      cy.contains('Efectivo + Transferencia').should('exist');
      cy.contains('3 cuotas totales').should('exist');
      cy.contains('11/01/2027').should('exist');
      cy.contains('10/02/2027').should('exist');
      cy.contains('10/03/2027').should('exist');
    });
  });
});
