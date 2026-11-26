const saleSimulationResponse = {
  ok: true,
  data: {
    type: 'SALE',
    payment_frequency: 'MONTHLY',
    installments_count: 3,
    total_amount: 1000,
    installment_amount: 350,
    total_to_return: 1050,
    note: 'Simulación integrada',
    down_payment: 200,
    financed_amount: 800,
  },
};

const saleCreateResponse = {
  ok: true,
  data: { id: 'credit-001', status: 'PENDING_APPROVAL' },
};

function loginSellerForSaleFlow() {
  cy.intercept('GET', '**/auth/me', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'usr-002',
        full_name: 'María Sánchez',
        dni: '87654321',
        role: 'SELLER',
        is_temp_password: false,
        force_relogin_at: null,
      },
    },
  }).as('authMe');

  cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'cust-001',
          full_name: 'Ana García',
          dni: '12345678',
          phone: '3811234567',
          status: 'ACTIVE',
          collector_id: null,
          collector_name: null,
          created_at: '2024-01-15T00:00:00Z',
          previous_credits: 1,
          delinquency: 'Al día',
          payment_capacity: 5000,
        },
      ],
    },
  }).as('customers');

  cy.visit('/seller/operations/new', {
    onBeforeLoad(win) {
      win.localStorage.setItem('sgcf_token', 'mock_seller_token');
      win.localStorage.setItem(
        'sgcf_user',
        JSON.stringify({
          id: 'usr-002',
          full_name: 'María Sánchez',
          name: 'María Sánchez',
          dni: '87654321',
          email: 'vendedor@siscreditos.com',
          avatar: 'MS',
          roles: ['SELLER'],
          is_temp_password: false,
          force_relogin_at: null,
          token: 'mock_seller_token',
        }),
      );
    },
  });
}

const VIEWPORTS: { name: string; width: number; height: number; mobile: boolean }[] = [
  { name: 'desktop', width: 1280, height: 720, mobile: false },
  { name: 'mobile', width: 375, height: 667, mobile: true },
];

/**
 * Arma una unidad disponible cruda (formato backend) del producto stub.
 * @param {string} id - id de la unidad
 * @param {string} unitCode - código visible de la unidad
 */
const rawUnit = (id: string, unitCode: string) => ({
  id,
  unit_code: unitCode,
  status: 'AVAILABLE',
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  variant_id: 'var-1',
  color: 'Rojo',
  size: null,
  capacity: null,
  current_price: 1000,
  product_id: 'prod-1',
  product_name: 'Moto X',
});

/**
 * Stubbea lo que consume el wizard en los pasos 2 a 4: resumen del cliente,
 * unidades disponibles y tasas del producto (mensual, 3 cuotas).
 */
function stubSaleFlowCatalogs() {
  cy.intercept('GET', '**/api/customers/*/wizard-summary', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'cust-001',
        full_name: 'Ana García',
        dni: '12345678',
        phone: '3811234567',
        address: 'Calle 123',
        email: null,
        status: 'ACTIVE',
        portal_enabled: false,
        created_at: '2024-01-15T00:00:00Z',
        collector_id: null,
        collector_name: null,
        active_credits: 0,
        delinquency: 'sin mora',
        payment_capacity: 5000,
        paid_installments: 0,
        pending_installments: 0,
        overdue_installments: 0,
        credits: [],
      },
    },
  }).as('wizardSummary');

  cy.intercept('GET', /\/api\/product-units(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: [rawUnit('unit-1', 'U-001'), rawUnit('unit-2', 'U-002')] },
  }).as('units');

  cy.intercept('GET', /\/api\/product-rates(\?.*)?$/, {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'rate-1',
          product_id: 'prod-1',
          product_name: 'Moto X',
          payment_frequency: 'MONTHLY',
          installments_count: 3,
          rate: 5,
          active: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    },
  }).as('productRates');
}

/**
 * Click en un botón del footer del wizard según el viewport (mobile tiene su propio footer).
 * @param {string} dataCy - data-cy del botón desktop; en mobile se usa `<dataCy>-mobile`
 * @param {boolean} mobile - true en 375x667
 */
function clickFooter(dataCy: string, mobile: boolean) {
  const sel = `[data-cy="${mobile ? `${dataCy}-mobile` : dataCy}"]`;
  cy.get(`${sel} button, button${sel}`).filter(':visible').first().should('not.be.disabled').click();
}

/**
 * Recorre el wizard hasta el paso 4 (Condiciones): venta, cliente Ana García,
 * unidad elegida, frecuencia mensual y 3 cuotas.
 * @param {boolean} mobile - true en 375x667
 * @param {string} unitCode - unidad a agregar al carrito
 */
function goToConditions(mobile: boolean, unitCode = 'U-001') {
  cy.get('[data-cy="btn-type-sale"]').should('be.visible').click();
  cy.contains('Paso 2 de 5').should('exist');
  cy.get('[data-cy="input-search-client"]').clear().type('Ana');
  cy.get('[data-cy="client-card-cust-001"]').click();
  cy.wait('@wizardSummary');
  cy.contains('button', 'Continuar con este cliente').should('be.enabled').click();

  cy.get('[data-cy="sale-product-prod-1"]').scrollIntoView().click();
  cy.get('[data-cy="sale-variant-var-1"]').scrollIntoView().click();
  cy.contains('span', unitCode).parent().find('[data-cy="sale-add-unit"]').scrollIntoView().click();
  cy.contains('span', unitCode).parent().find('[data-cy="sale-remove-unit"]').should('exist');
  clickFooter('btn-siguiente', mobile);
  cy.contains('Paso 4 de 5').should('exist');

  cy.contains('button', 'Mensual').click();
  cy.get('[data-cy="ddl-installments"] .p-dropdown').first().click();
  cy.contains('.p-dropdown-item', '3').click();
}

/**
 * Activa el enganche en efectivo con el monto dado.
 * @param {number} amount - monto del enganche
 */
function setCashDownPayment(amount: number) {
  cy.get('#pay-down').click({ force: true });
  cy.get('[data-cy="sale-down-payment"] input').clear().type(String(amount));
  cy.get('#dp-cash').click({ force: true });
}

/**
 * Avanza a confirmación, marca el checklist y envía a aprobación.
 * @param {boolean} mobile - true en 375x667
 */
function confirmAndSubmit(mobile: boolean) {
  clickFooter('btn-siguiente', mobile);
  cy.contains('Paso 5 de 5').should('exist');
  cy.get('[data-cy="btn-mark-all"]').click({ force: true });
  clickFooter('btn-enviar-aprobacion', mobile);
}

VIEWPORTS.forEach(({ name, width, height, mobile }) => {
  describe(`QA Regression — SALE en wizard de nueva operación (${name})`, () => {
    beforeEach(() => {
      cy.viewport(width, height);
      stubSaleFlowCatalogs();
      loginSellerForSaleFlow();
      cy.wait('@authMe');
    });

    it('simula SALE con down_payment y no envía prepaid_installments', () => {
      cy.intercept('POST', '**/api/credits/simulate', (req) => {
        expect(req.body).to.include({
          type: 'SALE',
          installments_count: 3,
          payment_frequency: 'MONTHLY',
          down_payment: 200,
        });
        expect(req.body.prepaid_installments).to.equal(undefined);
        req.reply(saleSimulationResponse);
      }).as('simulateSale');

      goToConditions(mobile);
      setCashDownPayment(200);
      cy.contains('button', /simulaci/i).scrollIntoView().click({ force: true });
      cy.wait('@simulateSale');
    });

    it('crea SALE con unit_ids y down_payment en efectivo, sin prepaid_installments', () => {
      cy.intercept('POST', '**/api/credits', (req) => {
        expect(req.body).to.include({
          customer_id: 'cust-001',
          type: 'SALE',
          installments_count: 3,
          payment_frequency: 'MONTHLY',
          down_payment: 200,
          down_payment_method: 'CASH',
        });
        expect(req.body.unit_ids).to.deep.equal(['unit-1']);
        expect(req.body.prepaid_installments).to.equal(undefined);
        req.reply(saleCreateResponse);
      }).as('createSale');

      goToConditions(mobile);
      setCashDownPayment(200);
      confirmAndSubmit(mobile);
      cy.wait('@createSale');
    });

    it('crea SALE con enganche mixto y envía split del pago inicial', () => {
      cy.intercept('POST', '**/api/credits', (req) => {
        expect(req.body).to.include({
          customer_id: 'cust-001',
          type: 'SALE',
          down_payment: 200,
          down_payment_cash: 80,
          down_payment_transfer: 120,
          down_payment_transfer_reference: 'DP-UI-MIX',
        });
        expect(req.body.down_payment_method).to.equal(undefined);
        expect(req.body.prepaid_installments).to.equal(undefined);
        req.reply(saleCreateResponse);
      }).as('createSaleMixedDownPayment');

      goToConditions(mobile);
      setCashDownPayment(200);
      cy.get('[data-cy="sale-down-payment-method-mixed"]').click({ force: true });
      cy.get('[data-cy="sale-down-payment-cash"] input').clear().type('80');
      cy.get('[data-cy="sale-down-payment-transfer"] input').clear().type('120');
      cy.get('[data-cy="sale-down-payment-transfer-reference"]').type('DP-UI-MIX');
      confirmAndSubmit(mobile);
      cy.wait('@createSaleMixedDownPayment');
    });

    it('crea SALE con cuotas adelantadas mixtas y envía split del adelanto', () => {
      cy.intercept('POST', '**/api/credits', saleCreateResponse).as('createSaleMixedAdvanced');

      goToConditions(mobile);
      cy.get('#pay-advance').click({ force: true });
      cy.get('[data-cy="sale-advanced-installments-count"] input').clear().type('1');
      cy.get('[data-cy="sale-advanced-installments-method-mixed"]').click({ force: true });

      // El split debe sumar el "Total estimado" que calcula el wizard; se lee de la UI.
      cy.contains('p', 'Total estimado:')
        .invoke('text')
        .then((text) => {
          const total = Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
          expect(total, 'total estimado de cuotas adelantadas').to.be.greaterThan(0);
          const cash = Math.floor(total / 2);
          const transfer = total - cash;

          cy.get('[data-cy="sale-advanced-installments-cash"] input').clear().type(String(cash));
          cy.get('[data-cy="sale-advanced-installments-transfer"] input').clear().type(String(transfer));
          cy.get('[data-cy="sale-advanced-installments-transfer-reference"]').type('ADV-UI-MIX');
          confirmAndSubmit(mobile);

          cy.wait('@createSaleMixedAdvanced').then(({ request }) => {
            expect(request.body).to.include({
              customer_id: 'cust-001',
              type: 'SALE',
              prepaid_installments: 1,
              prepaid_installments_cash: cash,
              prepaid_installments_transfer: transfer,
              prepaid_installments_transfer_reference: 'ADV-UI-MIX',
            });
            expect(request.body.prepaid_installments_method).to.equal(undefined);
          });
        });
    });

    it('acota el enganche al total del carrito cuando se ingresa un monto mayor', () => {
      cy.intercept('POST', '**/api/credits', (req) => {
        expect(req.body.down_payment, 'enganche acotado al total').to.be.at.most(1000);
        req.reply(saleCreateResponse);
      }).as('createSaleClamped');

      goToConditions(mobile);
      setCashDownPayment(1500);
      confirmAndSubmit(mobile);
      cy.wait('@createSaleClamped');
    });

    it('CR-22 — respeta la unidad puntual elegida y no reemplaza por la primera disponible', () => {
      cy.intercept('POST', '**/api/credits', (req) => {
        expect(req.body).to.include({ customer_id: 'cust-001', type: 'SALE' });
        expect(req.body.unit_ids).to.deep.equal(['unit-2']);
        req.reply(saleCreateResponse);
      }).as('createSaleWithSecondUnit');

      goToConditions(mobile, 'U-002');
      confirmAndSubmit(mobile);
      cy.wait('@createSaleWithSecondUnit');
    });
  });
});
