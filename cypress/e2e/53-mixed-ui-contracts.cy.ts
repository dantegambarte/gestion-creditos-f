const ADMIN_ME = {
  ok: true,
  data: {
    id: 'usr-001',
    full_name: 'Carlos López',
    dni: '12345678',
    role: 'ADMIN',
    is_temp_password: false,
    force_relogin_at: null,
  },
};

const ACTIVE_CASH_DASHBOARD = {
  ok: true,
  data: {
    date: '2026-06-15',
    is_closed: false,
    cash_amount: 10000,
    transfer_amount: 10000,
    total_collected: 0,
    total_outflows: 0,
    approved_count: 0,
    pending_count: 0,
  },
};

const CREDIT_DETAIL = {
  id: 'cred-mixed-ui',
  type: 'LOAN',
  total_amount: 30000,
  installments_count: 3,
  payment_frequency: 'MONTHLY',
  interest_rate: 0.89,
  status: 'ACTIVE',
  created_at: '2026-06-15T10:00:00Z',
  approved_at: '2026-06-15T10:05:00Z',
  approved_by: 'usr-001',
  rejection_reason: null,
  notes: null,
  customer_id: 'cust-001',
  customer_name: 'Ana García',
  customer_dni: '12345678',
  customer_phone: '3811234567',
  created_by_id: 'usr-002',
  created_by_name: 'María Sánchez',
  financed_amount: 30000,
  down_payment: 0,
  down_payment_method: null,
  down_payment_transfer_reference: null,
  prepaid_installments: 0,
  prepaid_installments_method: null,
  prepaid_installments_transfer_reference: null,
  settled_at: null,
  settlement_amount: null,
  settlement_type: null,
  refinanced_from_credit_id: null,
  products: [],
  units: [],
  installments: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      installment_number: 1,
      due_date: '2026-07-15',
      amount_due: 10000,
      amount_paid: 0,
      penalty_amount: 0,
      status: 'PENDING',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      installment_number: 2,
      due_date: '2026-08-15',
      amount_due: 10000,
      amount_paid: 0,
      penalty_amount: 0,
      status: 'PENDING',
    },
  ],
};

function visitWithAdminSession(path: string): void {
  cy.intercept('GET', '**/auth/me', ADMIN_ME).as('authMe');
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('sgcf_token', 'mock_admin_token');
      win.localStorage.setItem(
        'sgcf_user',
        JSON.stringify({
          id: 'usr-001',
          full_name: 'Carlos López',
          name: 'Carlos López',
          dni: '12345678',
          email: 'admin@siscreditos.com',
          roles: ['ADMIN'],
          is_temp_password: false,
          force_relogin_at: null,
          token: 'mock_admin_token',
        }),
      );
    },
  });
  cy.wait('@authMe');
}

function selectDropdownValue(dropdownSelector: string, label: string): void {
  cy.get(dropdownSelector)
    .find('.p-dropdown-trigger, .p-select-dropdown')
    .click({ force: true });
  cy.contains('.p-dropdown-item, .p-select-option', label).click({
    force: true,
  });
}

function stubCreditDetail(): void {
  cy.intercept(
    'GET',
    '**/api/cash-register/dashboard*',
    ACTIVE_CASH_DASHBOARD,
  ).as('getDashboard');
  cy.intercept('GET', '**/api/credits/cred-mixed-ui', {
    ok: true,
    data: CREDIT_DETAIL,
  }).as('getCredit');
  cy.intercept('GET', '**/api/credits/cred-mixed-ui/payments', {
    ok: true,
    data: [],
  }).as('getCreditPayments');
}

describe('Contratos UI mixtos — dialogs financieros', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('admin payments: cobro directo mixto envía split al backend', () => {
    cy.intercept('GET', '**/api/users*', { ok: true, data: [] }).as('getUsers');
    cy.intercept('GET', '**/api/payments', { ok: true, data: [] }).as(
      'getPayments',
    );
    cy.intercept(
      'GET',
      '**/api/cash-register/dashboard*',
      ACTIVE_CASH_DASHBOARD,
    ).as('getDashboard');
    cy.intercept('POST', '**/api/payments/admin-direct', (req) => {
      expect(req.body).to.include({
        installment_id: '11111111-1111-4111-8111-111111111111',
        amount_cash: 3500,
        amount_transfer: 6500,
        transfer_reference: 'ADM-UI-MIX',
      });
      expect(req.body.payment_method).to.eq(undefined);
      req.reply({
        ok: true,
        data: { ...CREDIT_DETAIL.installments[0], id: 'pay-ui' },
      });
    }).as('postAdminDirect');

    visitWithAdminSession('/admin/payments');
    cy.wait('@getPayments');

    cy.contains('button', 'Cobro directo').click();
    cy.get('[data-cy="admin-direct-installment-id"]').type(
      '11111111-1111-4111-8111-111111111111',
    );
    selectDropdownValue(
      '[data-cy="admin-direct-payment-method"]',
      'Efectivo + transferencia',
    );
    cy.get('[data-cy="admin-direct-cash-amount"] input').clear().type('3500');
    cy.get('[data-cy="admin-direct-transfer-amount"] input')
      .clear()
      .type('6500');
    cy.get('[data-cy="admin-direct-transfer-reference"]').type('ADM-UI-MIX');
    cy.get('[data-cy="admin-direct-submit"] button').click();

    cy.wait('@postAdminDirect');
  });

  it('detalle de crédito: cobro de cuota mixto envía split como pre-carga', () => {
    stubCreditDetail();
    cy.intercept('POST', '**/api/payments', (req) => {
      expect(req.body).to.include({
        installment_id: '11111111-1111-4111-8111-111111111111',
        amount_cash: 4000,
        amount_transfer: 6000,
        transfer_reference: 'PAY-UI-MIX',
      });
      expect(req.body.payment_method).to.eq(undefined);
      req.reply({ ok: true, data: { id: 'pay-pending-ui' } });
    }).as('postPayment');

    visitWithAdminSession('/seller/operations/cred-mixed-ui');
    cy.wait('@getCredit');
    cy.get('[data-cy="installment-direct-payment"]')
      .first()
      .find('button')
      .click({ force: true });

    selectDropdownValue(
      '[data-cy="seller-direct-payment-method"]',
      'Efectivo + transferencia',
    );
    cy.get('[data-cy="seller-direct-cash-amount"] input').clear().type('4000');
    cy.get('[data-cy="seller-direct-transfer-amount"] input')
      .clear()
      .type('6000');
    cy.get('[data-cy="seller-direct-transfer-reference"]').type('PAY-UI-MIX');
    cy.get('[data-cy="seller-direct-submit"] button').click();

    cy.wait('@postPayment');
  });

  it('detalle de crédito: cancelación anticipada mixta envía split total', () => {
    stubCreditDetail();
    cy.intercept(
      'PATCH',
      '**/api/credits/cred-mixed-ui/early-settlement',
      (req) => {
        expect(req.body).to.include({
          amount_cash: 8000,
          amount_transfer: 12000,
          transfer_reference: 'SET-UI-MIX',
        });
        expect(req.body.payment_method).to.eq(undefined);
        req.reply({
          ok: true,
          data: {
            credit_id: 'cred-mixed-ui',
            settlement_amount: 20000,
            payment_method: 'MIXED',
          },
        });
      },
    ).as('patchSettlement');

    visitWithAdminSession('/seller/operations/cred-mixed-ui');
    cy.wait('@getCredit');
    cy.contains('button', 'Cancelación total anticipada').click();
    cy.wait('@getCreditPayments');

    selectDropdownValue(
      '[data-cy="settlement-payment-method"]',
      'Efectivo + transferencia',
    );
    cy.get('[data-cy="settlement-cash-amount"] input').clear().type('8000');
    cy.get('[data-cy="settlement-transfer-amount"] input')
      .clear()
      .type('12000');
    cy.get('[data-cy="settlement-transfer-reference"]').type('SET-UI-MIX');
    cy.get('[data-cy="settlement-submit"] button').click();

    cy.wait('@patchSettlement');
  });
});
