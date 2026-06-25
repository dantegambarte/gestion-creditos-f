const collectorResponse = {
  ok: true,
  data: [
    {
      id: 'collector-mobile-1',
      full_name: 'Cobrador Mobile Heavy',
      dni: '40111222',
      email: 'collector.heavy@finflow.test',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      is_temp_password: false,
      failed_attempts: 0,
      locked_at: null,
      last_login_at: null,
      created_at: '2026-06-01T12:00:00.000Z',
    },
  ],
};

const collectionSheetsResponse = {
  ok: true,
  data: [
    {
      id: 'sheet-mobile-heavy-1',
      sheet_date: '2026-06-23',
      filter_used: 'TODAY_AND_OVERDUE',
      status: 'ACTIVE',
      created_at: '2026-06-23T10:00:00.000Z',
      sent_at: null,
      collector_id: 'collector-mobile-1',
      collector_name: 'Cobrador Mobile Heavy',
      total_items: 18,
    },
    {
      id: 'sheet-mobile-heavy-2',
      sheet_date: '2026-06-22',
      filter_used: 'ALL_PENDING',
      status: 'REGENERATED',
      created_at: '2026-06-22T10:00:00.000Z',
      sent_at: null,
      collector_id: 'collector-mobile-1',
      collector_name: 'Cobrador Mobile Heavy',
      total_items: 7,
    },
  ],
};

const systemConfigResponse = {
  ok: true,
  data: [
    {
      key: 'penalty_grace_days',
      value: 5,
      description: 'Días de gracia para mora',
      updated_at: '2026-06-01T12:00:00.000Z',
      updated_by: 'QA Admin',
    },
    {
      key: 'login_max_attempts',
      value: 4,
      description: 'Intentos fallidos de login',
      updated_at: '2026-06-02T12:00:00.000Z',
      updated_by: 'QA Admin',
    },
  ],
};

/**
 * Intercepta la caja con una jornada abierta y movimientos suficientes para validar cards mobile.
 */
const interceptCashRegister = (): void => {
  cy.intercept('GET', '**/api/expense-categories*', {
    statusCode: 200,
    body: { ok: true, data: [] },
  }).as('expenseCategoriesHeavy');

  cy.intercept('GET', '**/api/cash-register/dashboard*', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        date: '2026-06-23',
        is_closed: false,
        cash_amount: 120000,
        transfer_amount: 85000,
        total_collected: 205000,
        total_outflows: 30000,
        approved_count: 4,
        pending_count: 1,
        net_balance: 175000,
        pending_amount: 15000,
        down_payments_total: 20000,
        down_payments_count: 1,
      },
    },
  }).as('cashDashboardHeavy');

  cy.intercept('GET', '**/api/business-days/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'business-day-mobile-heavy',
        business_date: '2026-06-23',
        status: 'OPEN',
        session_counts: { total_count: 1, open_count: 1, pending_count: 0, closed_count: 0 },
      },
    },
  }).as('activeBusinessDayHeavy');

  cy.intercept('GET', '**/api/cash-sessions/active', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'cash-session-mobile-heavy',
        business_day_id: 'business-day-mobile-heavy',
        status: 'OPEN',
        opening_amount: 10000,
        cash_counted: null,
        opened_at: '2026-06-23T09:00:00.000Z',
        opened_by: 'admin-001',
        owner_name: 'QA Admin',
        shift_label: 'Central',
      },
    },
  }).as('activeCashSessionHeavy');

  cy.intercept('GET', '**/api/cash-sessions/cash-session-mobile-heavy/snapshot', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        expected: { cash: 132000, transfer: 93000 },
        collections: {
          payments: { cash: 90000, transfer: 65000 },
          down_payments: { cash: 20000, transfer: 12000 },
          manual_incomes: { cash: 22000, transfer: 16000 },
        },
        outflows: {
          expenses: { cash: 8000, transfer: 4000 },
          commissions: { cash: 2000, transfer: 1000 },
        },
        conversions: { cash_delta: 0, transfer_delta: 0 },
      },
    },
  }).as('cashSnapshotHeavy');

  cy.intercept('GET', '**/api/cash-register/sessions/cash-session-mobile-heavy/movements', {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'mov-heavy-1',
          concepto: 'Cobro cuota #4',
          fecha_hora: '2026-06-23T10:30:00.000Z',
          responsable: 'Cobrador Mobile Heavy',
          tipo: 'INGRESO',
          monto: 57000,
          metodo_pago: 'EFECTIVO',
        },
        {
          id: 'mov-heavy-2',
          concepto: 'Gasto operativo',
          fecha_hora: '2026-06-23T11:30:00.000Z',
          responsable: 'QA Admin',
          tipo: 'EGRESO',
          monto: 12000,
          metodo_pago: 'TRANSFERENCIA',
        },
      ],
    },
  }).as('cashMovementsHeavy');

  cy.intercept('GET', '**/api/cash-accounts*', {
    statusCode: 200,
    body: {
      ok: true,
      data: [
        {
          id: 'general-cash-heavy',
          type: 'GENERAL_CASH',
          name: 'Caja General',
          current_balance: 450000,
          status: 'ACTIVE',
        },
      ],
    },
  }).as('cashAccountsHeavy');
};

describe('Admin Backoffice — Heavy Mobile UX', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('Caja Fuerte Mobile — muestra resumen sin desbordes y acciones principales clickeables', () => {
    interceptCashRegister();

    cy.loginAs('ADMIN', '/admin/cash-register');

    cy.get('[data-cy="admin-cash-register-page"]', { timeout: 15000 }).should('be.visible');
    cy.wait(['@cashDashboardHeavy', '@activeBusinessDayHeavy', '@activeCashSessionHeavy']);

    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-breakdown-mobile"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-cy="admin-cash-register-history-mobile-list"]')
      .scrollIntoView()
      .should('be.visible')
      .contains('Cobro cuota #4');

    cy.contains('button', 'Ingreso Manual').scrollIntoView().should('be.visible').click();
    cy.contains('.p-dialog', 'Ingreso Manual').should('be.visible');
    cy.get('.p-dialog button .pi-times').last().click({ force: true });

    cy.contains('button', 'Registrar Gasto').scrollIntoView().should('be.visible');
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Planillas Mobile — renderiza skeleton cards con delay y luego cards de datos sin tabla', () => {
    let releaseCollections: () => void;
    const collectionsGate = new Promise<void>((resolve) => {
      releaseCollections = resolve;
    });

    cy.intercept('GET', '**/api/users*', collectorResponse).as('collectorsHeavy');
    cy.intercept({ method: 'GET', url: '**/api/collections*', times: 1 }, (req) => {
      req.reply(async () => {
        await collectionsGate;
        return { statusCode: 200, body: collectionSheetsResponse };
      });
    }).as('collectionsDelayedHeavy');

    cy.loginAs('ADMIN', '/admin/collections');

    cy.get('[data-cy="admin-collections-mobile-skeleton-list"]').should('be.visible');
    cy.get('[data-cy="admin-collections-mobile-skeleton-card"] .p-skeleton').should(
      'have.length.at.least',
      9,
    );

    cy.then(() => releaseCollections());
    cy.wait('@collectionsDelayedHeavy');

    cy.get('[data-cy="admin-collections-mobile-skeleton-list"]').should('not.exist');
    cy.get('body').then(($body) => {
      expect($body.find('table:visible').length, 'tablas visibles en mobile').to.eq(0);
    });
    cy.get('body').then(($body) => {
      const cards = $body.find('[data-cy="admin-collections-mobile-card"]');
      const empty = $body.find('[data-cy="admin-collections-mobile-empty-state"]');
      expect(cards.length + empty.length, 'cards o empty state mobile').to.be.greaterThan(0);
      if (cards.length > 0) {
        expect(cards.first().text()).to.contain('Cobrador Mobile Heavy');
      }
    });
    cy.get('body').then(($body) => {
      const actions = $body.find('[data-cy="admin-collections-mobile-view-action"]');
      if (actions.length > 0) {
        cy.wrap(actions.first()).should('be.visible');
      }
    });
  });

  it('Configuración Mobile — tabs scrolleables y edición de parámetro visible en viewport', () => {
    cy.intercept('GET', '**/api/system-config', systemConfigResponse).as('systemConfigHeavy');

    cy.loginAs('ADMIN', '/admin/config/system-params');
    cy.wait('@systemConfigHeavy');

    cy.get('[data-cy="admin-config-tabs"]').should(($tabs) => {
      const el = $tabs[0];
      expect(el.scrollWidth).to.be.greaterThan(el.clientWidth);
    });
    cy.get('[data-cy="admin-system-params-table"]').should('not.be.visible');
    cy.get('[data-cy="admin-system-params-mobile-card"]')
      .should('have.length.at.least', 2)
      .first()
      .contains('Días de gracia');

    cy.get('[data-cy="admin-system-params-mobile-edit-action"]').first().click();
    cy.get('[data-cy="admin-system-params-edit-input"] input')
      .should('be.visible')
      .then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(375);
        expect(parseFloat(getComputedStyle($input[0]).fontSize)).to.be.at.least(16);
      })
      .clear()
      .type('6');
  });
});
