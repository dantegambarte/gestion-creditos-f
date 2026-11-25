/**
 * P12 — Cobros sin duplicados y pagos mixtos válidos (issue #53).
 * - Pago mixto sin referencia de transferencia → no se puede enviar.
 * - Doble click / reintento tras error de red → un solo cobro (misma
 *   `client_request_id`, contrato P08 del backend).
 * - Cancelación anticipada no abre si no se pudieron cargar los pagos.
 * - No romper: pre-carga simple en efectivo.
 * Se valida en desktop y mobile (iPhone SE 375x667).
 */

const INST_1 = '11111111-1111-4111-8111-111111111111';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const CREDIT_DETAIL = {
  id: 'cred-p12',
  type: 'LOAN',
  total_amount: 20000,
  installments_count: 2,
  payment_frequency: 'MONTHLY',
  interest_rate: 0.5,
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
  financed_amount: 20000,
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
      id: INST_1,
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

/** Visita la ruta con sesión de admin simulada. */
function visitAsAdmin(path: string): void {
  cy.intercept('GET', '**/auth/me', {
    ok: true,
    data: {
      id: 'usr-001',
      full_name: 'Carlos López',
      dni: '12345678',
      role: 'ADMIN',
      is_temp_password: false,
      force_relogin_at: null,
    },
  }).as('authMe');
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

/** Stubs base del detalle de crédito con caja abierta. */
function stubCredit(): void {
  cy.intercept('GET', '**/api/cash-register/dashboard*', {
    ok: true,
    data: { date: '2026-06-15', is_closed: false },
  });
  cy.intercept('GET', '**/api/cash-sessions/active', {
    ok: true,
    data: { id: 'sess-p12', status: 'OPEN' },
  });
  cy.intercept('GET', '**/api/credits/cred-p12', { ok: true, data: CREDIT_DETAIL }).as('getCredit');
}

/** Abre el diálogo "Cobrar cuota" de la primera cuota. */
function openInstallmentPayment(): void {
  visitAsAdmin('/seller/operations/cred-p12');
  cy.wait('@getCredit');
  cy.get('[data-cy="installment-direct-payment"]').first().find('button').click({ force: true });
}

/** Elige un valor de un p-dropdown por su etiqueta. */
function selectDropdown(selector: string, label: string): void {
  cy.get(selector).find('.p-dropdown-trigger, .p-select-dropdown').click({ force: true });
  cy.contains('.p-dropdown-item, .p-select-option', label).click({ force: true });
}

const VIEWPORTS: Array<[string, () => void]> = [
  ['desktop', () => cy.viewport(1280, 720)],
  ['mobile', () => cy.viewport(375, 667)],
];

VIEWPORTS.forEach(([name, setViewport]) => {
  describe(`P12 — cobros sin duplicados (${name})`, () => {
    beforeEach(() => {
      setViewport();
      stubCredit();
    });

    it('pago mixto sin referencia no se puede enviar; con referencia viaja con client_request_id', () => {
      const bodies: Array<Record<string, unknown>> = [];
      cy.intercept('POST', '**/api/payments', (req) => {
        bodies.push(req.body);
        req.reply({ statusCode: 201, body: { ok: true, data: { id: 'p1', status: 'PENDING' } } });
      }).as('postPayment');

      openInstallmentPayment();
      selectDropdown('[data-cy="seller-direct-payment-method"]', 'Efectivo + transferencia');
      cy.get('[data-cy="seller-direct-cash-amount"] input').clear().type('4000');
      cy.get('[data-cy="seller-direct-transfer-amount"] input').clear().type('6000');

      cy.get('[data-cy="mixed-reference-required"]').should('be.visible');
      cy.get('[data-cy="seller-direct-submit"] button').should('be.disabled');

      cy.get('[data-cy="seller-direct-transfer-reference"]').type('OP-P12');
      cy.get('[data-cy="mixed-reference-required"]').should('not.exist');
      cy.get('[data-cy="seller-direct-submit"] button').should('be.enabled').click();

      cy.wait('@postPayment').then(() => {
        expect(bodies).to.have.length(1);
        expect(bodies[0]).to.include({
          amount_cash: 4000,
          amount_transfer: 6000,
          transfer_reference: 'OP-P12',
        });
        expect(bodies[0]['client_request_id']).to.match(UUID_RE);
      });
    });

    it('reintento tras timeout (504) reusa la misma client_request_id (un solo cobro)', () => {
      const keys: unknown[] = [];
      let calls = 0;
      cy.intercept('POST', '**/api/payments', (req) => {
        keys.push(req.body.client_request_id);
        calls += 1;
        if (calls === 1) {
          req.reply({ statusCode: 504, body: { ok: false, message: 'Gateway Timeout' } });
          return;
        }
        req.reply({
          statusCode: 200,
          body: { ok: true, data: { id: 'p1', status: 'PENDING', idempotent_replay: true } },
        });
      }).as('postPayment');

      openInstallmentPayment();
      cy.get('[data-cy="seller-direct-submit"] button').click();
      cy.wait('@postPayment');
      cy.get('[data-cy="seller-direct-submit"] button').should('be.enabled').click();
      cy.wait('@postPayment');
      cy.contains('pendiente de aprobación').should('be.visible');

      cy.then(() => {
        expect(keys).to.have.length(2);
        expect(keys[0]).to.match(UUID_RE);
        expect(keys[1]).to.eq(keys[0]);
      });
    });

    it('doble click en confirmar envía un solo cobro', () => {
      let calls = 0;
      cy.intercept('POST', '**/api/payments', (req) => {
        calls += 1;
        req.reply({
          delay: 400,
          statusCode: 201,
          body: { ok: true, data: { id: 'p1', status: 'PENDING' } },
        });
      }).as('postPayment');

      openInstallmentPayment();
      cy.get('[data-cy="seller-direct-submit"] button').dblclick();
      cy.wait('@postPayment');
      cy.contains('pendiente de aprobación').should('be.visible');
      cy.then(() => expect(calls).to.eq(1));
    });

    it('no romper: pre-carga simple en efectivo', () => {
      cy.intercept('POST', '**/api/payments', (req) => {
        expect(req.body).to.include({
          installment_id: INST_1,
          amount_received: 10000,
          payment_method: 'CASH',
        });
        req.reply({ statusCode: 201, body: { ok: true, data: { id: 'p1', status: 'PENDING' } } });
      }).as('postPayment');

      openInstallmentPayment();
      cy.get('[data-cy="seller-direct-submit"] button').should('be.enabled').click();
      cy.wait('@postPayment');
      cy.contains('pendiente de aprobación').should('be.visible');
    });

    it('cancelación anticipada no abre si no se pudieron cargar los pagos', () => {
      cy.intercept('GET', '**/api/credits/cred-p12/payments', {
        statusCode: 500,
        body: { ok: false, message: 'boom' },
      }).as('getPayments');

      visitAsAdmin('/seller/operations/cred-p12');
      cy.wait('@getCredit');
      cy.contains('button', 'Pago total').click({ force: true });
      cy.wait('@getPayments');
      cy.contains('No se pudo verificar').should('be.visible');
      cy.get('[data-cy="settlement-submit"]').should('not.exist');
    });

    it('cancelación anticipada mixta sin referencia queda deshabilitada', () => {
      cy.intercept('GET', '**/api/credits/cred-p12/payments', { ok: true, data: [] }).as(
        'getPayments',
      );

      visitAsAdmin('/seller/operations/cred-p12');
      cy.wait('@getCredit');
      cy.contains('button', 'Pago total').click({ force: true });
      cy.wait('@getPayments');
      selectDropdown('[data-cy="settlement-payment-method"]', 'Efectivo + transferencia');
      cy.get('[data-cy="settlement-cash-amount"] input').clear().type('8000');
      cy.get('[data-cy="settlement-transfer-amount"] input').clear().type('12000');
      cy.get('[data-cy="settlement-submit"] button').should('be.disabled');
      cy.get('[data-cy="settlement-transfer-reference"]').type('SET-P12');
      cy.get('[data-cy="settlement-submit"] button').should('be.enabled');
    });
  });
});
