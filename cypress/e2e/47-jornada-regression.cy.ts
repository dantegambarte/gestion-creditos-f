/**
 * SUITE: Jornada Comercial — Regresión CA-02
 *
 * CA-02a: Pasada la medianoche, el dashboard muestra la fecha de la jornada activa
 *         (ayer) con el badge de advertencia, NO la fecha de hoy.
 *
 * CA-02b: Cerrar caja pasada la medianoche cierra la jornada del día anterior
 *         (el backend recibe la fecha correcta). El frontend no envía register_date —
 *         el backend la detecta vía getActiveJornadaDate().
 *
 * CA-02c: Aprobar un cobro pasada la medianoche lo registra en la jornada activa
 *         (el movimiento queda en la fecha de ayer, no hoy).
 *
 * CA-02d: Revertir un cobro de la jornada activa (post-medianoche) funciona
 *         correctamente sin el error "caja cerrada".
 */

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** Devuelve una fecha YYYY-MM-DD desplazada N días desde hoy. */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

const TODAY = dateOffset(0);
const YESTERDAY = dateOffset(-1);

// ── Mock data ─────────────────────────────────────────────────────────────────

/** Dashboard con jornada de ayer (post-medianoche: hoy no tiene actividad). */
const MOCK_DASHBOARD_JORNADA_YESTERDAY = {
  ok: true,
  data: {
    date: YESTERDAY,
    is_closed: false,
    cash_amount: 50000,
    transfer_amount: 20000,
    total_collected: 70000,
    total_outflows: 5000,
    net_balance: 65000,
    approved_count: 3,
    pending_count: 1,
    pending_amount: 15000,
    down_payments_total: 0,
    down_payments_count: 0,
  },
};

/** Dashboard del día actual ya cerrado. */
const MOCK_DASHBOARD_TODAY_CLOSED = {
  ok: true,
  data: {
    date: TODAY,
    is_closed: true,
    cash_amount: 50000,
    transfer_amount: 20000,
    total_collected: 70000,
    total_outflows: 5000,
    net_balance: 65000,
    approved_count: 3,
    pending_count: 0,
    pending_amount: 0,
    down_payments_total: 0,
    down_payments_count: 0,
  },
};

const MOCK_PRE_CLOSE_YESTERDAY = {
  ok: true,
  data: {
    date: YESTERDAY,
    ingresos: {
      cobros_efectivo: 50000,
      cobros_transferencia: 20000,
      enganches_efectivo: 0,
      enganches_transferencia: 0,
      total_bruto: 70000,
    },
    egresos: {
      gastos_efectivo: 5000,
      gastos_transferencia: 0,
      comisiones_efectivo: 0,
      comisiones_transferencia: 0,
      total: 5000,
    },
    efectivo: { esperado: 45000 },
    transferencias: { esperado: 20000 },
    pendientes: { count: 0, amount: 0 },
  },
};

const MOCK_CLOSE_RESULT = {
  ok: true,
  data: {
    id: 'cr-001',
    register_date: YESTERDAY,
    total_collected: 70000,
    cash_amount: 45000,
    transfer_amount: 20000,
    total_outflows: 5000,
    declared_cash: 45000,
    difference: 0,
    difference_status: 'EXACT',
    observations: null,
    created_at: `${YESTERDAY}T03:10:00Z`,
    closed_by_name: 'Admin Sistema',
  },
};

const MOCK_DETAIL = {
  ok: true,
  data: {
    ...MOCK_CLOSE_RESULT.data,
    breakdown: {
      payments: [],
      down_payments: [],
      liquidations: [],
      expenses: [],
    },
  },
};

const MOCK_CASH_HISTORY = { ok: true, data: [] };

const MOCK_PAYMENT_PENDING = {
  ok: true,
  data: [
    {
      id: 'pay-001',
      installment_id: 'inst-001',
      installment_number: 1,
      credit_id: 'cred-001',
      amount_received: 15000,
      payment_method: 'CASH',
      transfer_reference: null,
      status: 'PENDING',
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
      created_at: `${YESTERDAY}T22:00:00Z`,
      approved_at: null,
      approved_by: null,
    },
  ],
};

const MOCK_PAYMENT_APPROVED = {
  ok: true,
  data: {
    id: 'pay-001',
    installment_id: 'inst-001',
    installment_number: 1,
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
    created_at: `${YESTERDAY}T22:00:00Z`,
    approved_at: `${TODAY}T01:30:00Z`,
    approved_by: 'admin-001',
    amount_due: 15000,
    penalty_amount: 0,
    customer_id: 'cust-001',
    rejected_by: null,
    rejection_reason: null,
  },
};

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

// ── CA-02a: Badge de jornada post-medianoche ───────────────────────────────────

describe('CA-02a — Dashboard muestra badge de jornada cuando la fecha activa es anterior a hoy', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/cash-register/dashboard', {
      statusCode: 200,
      body: MOCK_DASHBOARD_JORNADA_YESTERDAY,
    }).as('getDashboard');

    cy.intercept('GET', '**/api/cash-register/pre-close', {
      statusCode: 200,
      body: MOCK_PRE_CLOSE_YESTERDAY,
    }).as('getPreClose');

    cy.intercept('GET', '**/api/cash-register', {
      statusCode: 200,
      body: MOCK_CASH_HISTORY,
    }).as('getCashHistory');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait('@getDashboard');
  });

  it('CA-02a — muestra el badge de jornada anterior cuando dashboard.date < hoy', () => {
    cy.get('[data-cy="jornada-post-midnight-badge"]').should('be.visible');
  });

  it('CA-02a — el badge contiene la fecha de la jornada activa', () => {
    // formatDate convierte YYYY-MM-DD → dd/mm/yyyy
    const [y, m, d] = YESTERDAY.split('-');
    const formatted = `${d}/${m}/${y}`;
    cy.get('[data-cy="jornada-post-midnight-badge"]').should(
      'contain',
      formatted,
    );
  });

  it('CA-02a — NO muestra el badge cuando dashboard.date == hoy', () => {
    // Re-interceptar con dashboard de hoy
    cy.intercept('GET', '**/api/cash-register/dashboard', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          ...MOCK_DASHBOARD_JORNADA_YESTERDAY.data,
          date: TODAY,
          is_closed: false,
        },
      },
    }).as('getDashboardToday');

    cy.reload();
    cy.wait('@getDashboardToday');

    cy.get('[data-cy="jornada-post-midnight-badge"]').should('not.exist');
  });
});

// Mock snapshot V4 para el diálogo de cierre de caja operativa
const MOCK_SESSION_SNAPSHOT = {
  session_id: 'sess-active',
  status: 'OPEN',
  owner_user_id: 'usr-001',
  opened_at: `${YESTERDAY}T08:00:00Z`,
  opening: { cash: 0, transfer: 0 },
  collections: {
    payments: { cash: 50000, transfer: 20000 },
    down_payments: { cash: 0, transfer: 0 },
    manual_incomes: { cash: 0, transfer: 0 },
  },
  outflows: {
    expenses: { cash: 5000, transfer: 0 },
    commissions: { cash: 0, transfer: 0 },
  },
  conversions: { cash_delta: 0, transfer_delta: 0 },
  drops: { cash: 0, transfer: 0, items: [] },
  expected: { cash: 45000, transfer: 20000 },
};

// ── CA-02b: Cerrar caja post-medianoche ────────────────────────────────────────

describe('CA-02b — Cerrar caja post-medianoche cierra la jornada del día anterior', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/cash-register/dashboard', {
      statusCode: 200,
      body: MOCK_DASHBOARD_JORNADA_YESTERDAY,
    }).as('getDashboard');

    cy.intercept('GET', '**/api/cash-sessions/*/snapshot', {
      statusCode: 200,
      body: { ok: true, data: MOCK_SESSION_SNAPSHOT, message: '' },
    }).as('getSnapshot');

    cy.intercept('POST', '**/api/cash-sessions/*/close', {
      statusCode: 200,
      body: {
        ok: true,
        data: { id: 'sess-active', status: 'CLOSED' },
        message: '',
      },
    }).as('postClose');

    cy.intercept('GET', '**/api/cash-register', {
      statusCode: 200,
      body: MOCK_CASH_HISTORY,
    }).as('getCashHistory');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait('@getDashboard');
  });

  it('CA-02b — el botón de cerrar caja existe cuando la jornada no está cerrada', () => {
    cy.get('[data-cy="admin-cash-register-close-day-cta"]').should(
      'be.visible',
    );
  });

  it('CA-02b — al confirmar el cierre, el diálogo se abre con el snapshot de la caja activa', () => {
    cy.get('[data-cy="admin-cash-register-close-day-cta"]').click();
    cy.wait('@getSnapshot');

    // El diálogo debe mostrar "Cerrar caja operativa" y los montos del snapshot
    cy.contains('Cerrar caja operativa').should('be.visible');
    cy.contains('Esperado').should('be.visible');
  });

  it('CA-02b — el POST de cierre se llama SIN register_date (backend auto-detecta la jornada)', () => {
    cy.get('[data-cy="admin-cash-register-close-day-cta"]').click();
    cy.wait('@getSnapshot');

    // Ingresar efectivo declarado en la primera fila (CASH)
    cy.get('p-inputNumber input').first().clear().type('45000');

    // Confirmar cierre con el botón "Cerrar caja"
    cy.contains('button', 'Cerrar caja').click();
    cy.wait('@postClose').then((interception) => {
      // El frontend NO debe enviar register_date — el backend lo auto-detecta
      expect(interception.request.body).not.to.have.property('register_date');
      // El body tiene el array declared con al menos el método CASH
      expect(interception.request.body).to.have.property('declared');
      expect(interception.request.body.declared[0]).to.have.property(
        'payment_method',
        'CASH',
      );
      expect(interception.request.body.declared[0]).to.have.property(
        'declared_amount',
        45000,
      );
    });
  });
});

// ── CA-02c: Aprobar cobro post-medianoche ──────────────────────────────────────

describe('CA-02c — Aprobar cobro post-medianoche: el endpoint responde correctamente', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: MOCK_COLLECTORS,
    }).as('getCollectors');

    cy.intercept('GET', '**/api/cash-register/**', {
      statusCode: 200,
      body: { ok: true, data: { isClosed: false, isOpen: true } },
    }).as('getCashRegister');

    cy.intercept('GET', '**/api/payments', {
      statusCode: 200,
      body: MOCK_PAYMENT_PENDING,
    }).as('getPayments');

    // El detalle debe mostrar PENDING para que aparezca el botón "Aprobar"
    cy.intercept('GET', '**/api/payments/pay-001', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          ...MOCK_PAYMENT_APPROVED.data,
          status: 'PENDING',
          approved_at: null,
          approved_by: null,
          amount_due: 15000,
          penalty_amount: 0,
          customer_id: 'cust-001',
          rejected_by: null,
          rejection_reason: null,
        },
      },
    }).as('getPaymentDetail');

    // Backend aprueba correctamente (asigna a jornada de ayer)
    cy.intercept('PATCH', '**/api/payments/pay-001/approve', {
      statusCode: 200,
      body: { ok: true, data: MOCK_PAYMENT_APPROVED.data },
    }).as('postApprove');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait('@getPayments');
  });

  it('CA-02c — cobro PENDING aparece en la lista y puede aprobarse', () => {
    cy.contains('td', 'Pedro Rodríguez').should('exist');
    cy.contains('.p-tag', 'Pendiente').should('exist');
  });

  it('CA-02c — el endpoint de aprobación responde 200 (backend gestiona jornada internamente)', () => {
    cy.contains('tr', 'Pedro Rodríguez').click();
    cy.wait('@getPaymentDetail');

    // "Aprobar" aparece directamente en el panel lateral (sin dialog intermedio)
    cy.contains('button', 'Aprobar').should('be.visible').click();
    cy.wait('@postApprove').its('response.statusCode').should('eq', 200);
  });
});

// ── CA-02d: Revertir cobro de la jornada activa ────────────────────────────────

describe('CA-02d — Revertir cobro de jornada activa post-medianoche funciona sin error de caja cerrada', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: MOCK_COLLECTORS,
    }).as('getCollectors');

    cy.intercept('GET', '**/api/cash-register/**', {
      statusCode: 200,
      body: { ok: true, data: { isClosed: false, isOpen: true } },
    }).as('getCashRegister');

    const approvedList = {
      ok: true,
      data: [{ ...MOCK_PAYMENT_APPROVED.data }],
    };

    let paymentCallCount = 0;
    cy.intercept('GET', '**/api/payments', (req) => {
      paymentCallCount++;
      req.reply({
        statusCode: 200,
        body:
          paymentCallCount === 1
            ? approvedList
            : {
                ok: true,
                data: [
                  {
                    ...MOCK_PAYMENT_APPROVED.data,
                    reversal_payment_id: 'pay-002',
                  },
                ],
              },
      });
    }).as('getPayments');

    cy.intercept('GET', '**/api/payments/pay-001', {
      statusCode: 200,
      body: MOCK_PAYMENT_APPROVED,
    }).as('getPaymentDetail');

    cy.intercept('POST', '**/api/payments/pay-001/reverse', {
      statusCode: 200,
      body: {
        ok: true,
        data: { ...MOCK_PAYMENT_APPROVED.data, reversal_payment_id: 'pay-002' },
      },
    }).as('postReverse');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait('@getPayments');
  });

  it('CA-02d — la reversión de un cobro aprobado responde 200 (jornada aún abierta)', () => {
    cy.contains('tr', 'Pedro Rodríguez').click();
    cy.wait('@getPaymentDetail');

    cy.contains('button', 'Revertir cobro').should('be.visible').click();
    cy.get('textarea')
      .should('be.visible')
      .type('Cobro registrado en jornada nocturna por error');

    cy.contains('button', /^Revertir cobro$/)
      .last()
      .click();
    cy.wait('@postReverse').its('response.statusCode').should('eq', 200);
    cy.wait('@getPayments');

    cy.contains('.p-tag', 'Revertido').should('exist');
  });
});
