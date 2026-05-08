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

function stubSaleFlowCatalogs() {
  cy.intercept('GET', /\/api\/products(\?.*)?$/, {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'prod-1',
          title: 'Moto X',
          description: 'Demo',
          model: 'MX',
          status: 'ACTIVE',
          created_at: '2026-01-01T00:00:00Z',
          category_id: null,
          category_name: null,
          brand_id: null,
          brand_name: null,
          available_count: 1,
          reserved_count: 0,
          sold_count: 0,
          variants: [
            {
              id: 'var-1',
              color: 'Rojo',
              size: null,
              capacity: null,
              current_price: 1000,
              status: 'ACTIVE',
            },
          ],
        },
      ],
    },
  }).as('products');

  cy.intercept('GET', /\/api\/product-variants(\?.*)?$/, {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'var-1',
          color: 'Rojo',
          size: null,
          capacity: null,
          current_price: 1000,
          status: 'ACTIVE',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          product_id: 'prod-1',
          product_name: 'Moto X',
          title: 'Moto X',
          model: 'MX',
          product_status: 'ACTIVE',
          brand_id: null,
          brand_name: null,
        },
      ],
    },
  }).as('variants');

  cy.intercept('GET', /\/api\/product-units(\?.*)?$/, {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'unit-1',
          unit_code: 'U-001',
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
        },
      ],
    },
  }).as('units');
}

function selectDropdownOption(selector: string, optionText: string) {
  cy.get(selector)
    .find('.p-dropdown, .p-select')
    .first()
    .click({ force: true });
  cy.get('.p-dropdown-item, .p-select-option')
    .should('have.length.greaterThan', 0);
  cy.contains('.p-dropdown-item, .p-select-option', optionText).click({
    force: true,
  });
}

function prepareSaleForm() {
  selectDropdownOption('[data-cy="credit-customer"]', 'Ana García');
  selectDropdownOption('[data-cy="credit-frequency"]', 'Mensual');

  cy.get('[data-cy="credit-installments-count"] input')
    .clear()
    .type('3');

  selectDropdownOption('[data-cy="sale-product-selector"]', 'Moto X');
  cy.wait('@variants');
  selectDropdownOption('[data-cy="sale-variant-selector"]', 'Rojo');
  cy.wait('@units');
  selectDropdownOption('[data-cy="sale-unit-selector"]', 'U-001');
  cy.get('[data-cy="sale-add-unit"]').click();

  cy.get('[data-cy="sale-toggle-down-payment"]').click();
  cy.get('[data-cy="sale-down-payment"] input').clear().type('200');
}

describe('QA Regression — SALE frontend integration', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubSaleFlowCatalogs();
    loginSellerForSaleFlow();
    cy.wait('@authMe');
    cy.wait('@customers');
    cy.wait('@products');
  });

  it('simula SALE con down_payment, muestra monto financiado y no usa prepaid_installments', () => {
    cy.intercept('POST', '**/api/credits/simulate', (req) => {
      expect(req.body).to.include({
        type: 'SALE',
        installments_count: 3,
        payment_frequency: 'MONTHLY',
        down_payment: 200,
      });
      expect(req.body.products).to.deep.equal([
        { variant_id: 'var-1', quantity: 1 },
      ]);
      expect(req.body.prepaid_installments).to.equal(undefined);
      req.reply(saleSimulationResponse);
    }).as('simulateSale');

    prepareSaleForm();
    cy.get('[data-cy="credit-simulate"]').click();
    cy.wait('@simulateSale');

    cy.get('[data-cy="simulate-down-payment"]')
      .invoke('text')
      .should('match', /\$\s*200(?:,00)?/);
    cy.get('[data-cy="simulate-financed-amount"]')
      .invoke('text')
      .should('match', /\$\s*800(?:,00)?/);
    cy.get('[data-cy="sale-financed-amount-preview"]')
      .invoke('text')
      .should('match', /\$\s*800(?:,00)?/);
  });

  it('crea SALE con unit_ids y down_payment, sin prepaid_installments', () => {
    cy.intercept('POST', '**/api/credits', (req) => {
      expect(req.body).to.deep.equal({
        customer_id: 'cust-001',
        type: 'SALE',
        installments_count: 3,
        payment_frequency: 'MONTHLY',
        unit_ids: ['unit-1'],
        down_payment: 200,
        down_payment_method: 'CASH',
      });
      expect(req.body.prepaid_installments).to.equal(undefined);
      req.reply(saleCreateResponse);
    }).as('createSale');

    prepareSaleForm();
    cy.get('[data-cy="credit-submit"]').click();
    cy.wait('@createSale');
  });

  it('bloquea la venta cuando el enganche supera el total del carrito', () => {
    prepareSaleForm();
    cy.get('[data-cy="sale-down-payment"] input').clear().type('1500');

    cy.get('[data-cy="credit-submit"]').click();

    cy.contains('El enganche no puede ser mayor al total de la venta.').should(
      'be.visible',
    );
  });
});
