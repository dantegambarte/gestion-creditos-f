/**
 * SUITE: Cobros — Regresión CO-01
 *
 * CO-01a: Después de revertir un cobro aprobado, la lista muestra tag "Revertido".
 * CO-01b: Cuando el backend devuelve installment_status='PENDING' en la planilla,
 *         la UI muestra "Pendiente" (no "Cobrado").
 *
 * El backend ya llama a restoreInstallmentFromReversal al revertir un cobro,
 * que actualiza installments.status a PENDING. Estos tests validan la integración
 * UI → API → estado visible.
 */

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_PAYMENT_APPROVED = {
  id: 'pay-001',
  installment_id: 'inst-001',
  installment_number: 3,
  credit_id: 'cred-001',
  amount_received: 15000,
  payment_method: 'CASH',
  transfer_reference: null,
  status: 'APPROVED',
  is_reversal: false,
  reversal_reason: null,
  admin_direct: false,
  parent_payment_id: null,
  reversal_payment_id: null,
  collector_id: 'col-001',
  collector_name: 'Juan Cobrador',
  customer_name: 'Pedro Rodríguez',
  customer_dni: '30111222',
  notes: null,
  created_at: '2026-05-28T10:00:00Z',
  approved_at: '2026-05-28T10:05:00Z',
  approved_by: 'admin-001',
};

const MOCK_PAYMENT_DETAIL_APPROVED = {
  ...MOCK_PAYMENT_APPROVED,
  amount_due: 15000,
  penalty_amount: 0,
  customer_id: 'cust-001',
  rejected_by: null,
  rejection_reason: null,
};

/** Misma lista post-reversión: reversal_payment_id seteado. */
const MOCK_PAYMENT_REVERSED = { ...MOCK_PAYMENT_APPROVED, reversal_payment_id: 'pay-002' };

const MOCK_CASH_OPEN = { ok: true, data: { isClosed: false, isOpen: true } };

const MOCK_COLLECTORS = {
  ok: true,
  data: [
    {
      id: 'col-001',
      full_name: 'Juan Cobrador',
      email: 'cobrador@test.com',
      dni: '11111111',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};

/** Planilla donde la cuota ya está en PENDING (estado post-reversión del backend). */
const MOCK_SHEET_DETAIL_PENDING = {
  ok: true,
  data: {
    id: 'sheet-001',
    sheet_date: '2026-05-28',
    filter_used: 'ALL_PENDING',
    status: 'ACTIVE',
    created_at: '2026-05-28T08:00:00Z',
    sent_at: null,
    collector_id: 'col-001',
    collector_name: 'Juan Cobrador',
    total_items: 1,
    generated_by_name: 'Admin Sistema',
    items: [
      {
        installment_id: 'inst-001',
        order_number: 1,
        planned_amount: 15000,
        inclusion_criteria: null,
        inclusion_reason: 'OVERDUE',
        op_priority: 1,
        remaining_amount: 15000,
        antecedent_id: null,
        antecedent_type: null,
        antecedent_date: null,
        antecedent_notes: null,
        next_visit_date: null,
        has_pending_payment: false,
        installment_number: 3,
        amount_due: 15000,
        amount_paid: 0,
        penalty_amount: 0,
        installment_status: 'PENDING',
        credit_id: 'cred-001',
        credit_type: 'SALE',
        due_date: '2026-05-20',
        collection_reference: null,
        customer_name: 'Pedro Rodríguez',
        customer_phone: '3811234567',
        customer_address: 'Calle Falsa 123',
        customer_dni: '30111222',
      },
    ],
  },
};

const MOCK_SHEETS_LIST = {
  ok: true,
  data: [
    {
      id: 'sheet-001',
      sheet_date: '2026-05-28',
      filter_used: 'ALL_PENDING',
      status: 'ACTIVE',
      created_at: '2026-05-28T08:00:00Z',
      sent_at: null,
      collector_id: 'col-001',
      collector_name: 'Juan Cobrador',
      total_items: 1,
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupPaymentsBaseIntercepts(): void {
  cy.intercept('GET', '**/api/users*', {
    statusCode: 200,
    body: MOCK_COLLECTORS,
  }).as('getCollectors');

  cy.intercept('GET', '**/api/cash-register/**', {
    statusCode: 200,
    body: MOCK_CASH_OPEN,
  }).as('getCashRegister');
}

// ── CO-01a: Revertir cobro desde admin/payments ────────────────────────────────

describe('CO-01a — Revertir cobro: tag "Revertido" aparece en lista tras confirmar', () => {
  beforeEach(() => {
    setupPaymentsBaseIntercepts();

    let paymentsCallCount = 0;
    cy.intercept('GET', '**/api/payments', (req) => {
      paymentsCallCount++;
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: [paymentsCallCount === 1 ? MOCK_PAYMENT_APPROVED : MOCK_PAYMENT_REVERSED],
        },
      });
    }).as('getPayments');

    cy.intercept('GET', '**/api/payments/pay-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_PAYMENT_DETAIL_APPROVED },
    }).as('getPaymentDetail');

    cy.intercept('POST', '**/api/payments/pay-001/reverse', {
      statusCode: 200,
      body: {
        ok: true,
        data: { ...MOCK_PAYMENT_DETAIL_APPROVED, reversal_payment_id: 'pay-002' },
      },
    }).as('postReverse');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait('@getPayments');
  });

  it('CO-01a — el pago aprobado no muestra "Revertido" antes de la reversión', () => {
    cy.contains('td', 'Pedro Rodríguez').should('exist');
    cy.contains('.p-tag', 'Revertido').should('not.exist');
  });

  it('CO-01a — tras confirmar la reversión la lista muestra tag "Revertido"', () => {
    // Abrir detalle del cobro
    cy.contains('tr', 'Pedro Rodríguez').click();
    cy.wait('@getPaymentDetail');

    // Abrir dialog de reversión
    cy.contains('button', 'Revertir cobro').should('be.visible').click();

    // El dialog aparece con campo de motivo
    cy.get('textarea').should('be.visible').type('Cobro registrado por error');

    // Confirmar reversión — el dialog activo tiene la clase .p-dialog visible
    cy.contains('button', /^Revertir cobro$/).last().click();
    cy.wait('@postReverse');
    cy.wait('@getPayments');

    // El tag "Revertido" debe aparecer en la tabla
    cy.contains('.p-tag', 'Revertido').should('exist');
  });
});

// ── CO-01b: Cuota PENDING se muestra como "Pendiente" en planilla ──────────────

describe('CO-01b — Cuota revertida muestra "Pendiente" en planilla de cobros (Admin)', () => {
  beforeEach(() => {
    // Registrar el detail DESPUÉS del genérico — en Cypress el último match gana
    cy.intercept('GET', '**/api/collections', {
      statusCode: 200,
      body: MOCK_SHEETS_LIST,
    }).as('getSheets');

    cy.intercept('GET', '**/api/collections/sheet-001', {
      statusCode: 200,
      body: MOCK_SHEET_DETAIL_PENDING,
    }).as('getSheetDetail');

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: MOCK_COLLECTORS,
    }).as('getCollectors');

    cy.intercept('GET', '**/api/cash-register/**', {
      statusCode: 200,
      body: MOCK_CASH_OPEN,
    }).as('getCashRegister');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/collections');
    cy.wait('@getSheets');
  });

  it('CO-01b — planilla con installment_status PENDING muestra tag "Pendiente"', () => {
    // Seleccionar la planilla de la lista
    cy.contains('td', 'Juan Cobrador').click();
    cy.wait('@getSheetDetail');

    // La cuota debe mostrar "Pendiente" (p-tag renderiza el value en .p-tag-label)
    cy.contains('.p-tag', 'Pendiente').should('exist');
  });

  it('CO-01b — planilla con installment_status PENDING NO muestra tag "Cobrado"', () => {
    cy.contains('td', 'Juan Cobrador').click();
    cy.wait('@getSheetDetail');

    cy.contains('.p-tag', 'Cobrado').should('not.exist');
    cy.contains('.p-tag', 'Pagada').should('not.exist');
  });
});
