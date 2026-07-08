const creditsResponse = {
  ok: true,
  data: [
    {
      id: 'credit-sc-1',
      type: 'LOAN',
      total_amount: 90000,
      installments_count: 6,
      payment_frequency: 'MONTHLY',
      interest_rate: 0.08,
      status: 'ACTIVE',
      created_at: '2026-06-01T00:00:00.000Z',
      approved_at: '2026-06-02T00:00:00.000Z',
      customer_id: 'cust-sc-1',
      customer_name: 'Cliente Seller Mobile',
      customer_dni: '40777888',
      created_by_id: 'seller-sc-1',
      created_by_name: 'Vendedor Mobile',
    },
  ],
};

const commissionsResponse = {
  ok: true,
  data: [
    {
      id: 'comm-sc-1',
      user_id: 'seller-sc-1',
      credit_id: 'credit-sc-1',
      amount: 4500,
      status: 'PENDING',
      week_start: '2026-06-15',
      week_end: '2026-06-21',
      created_at: '2026-06-21T00:00:00.000Z',
      user_name: 'Vendedor Mobile',
      user_role: 'SELLER',
      credit_type: 'LOAN',
      credit_amount: 90000,
      customer_name: 'Cliente Seller Mobile',
    },
  ],
};

const liquidationsResponse = {
  ok: true,
  data: [
    {
      id: 'liq-sc-1',
      user_id: 'seller-sc-1',
      week_start: '2026-06-08',
      week_end: '2026-06-14',
      commissions_total: 12000,
      salary_amount: 0,
      total_paid: 12000,
      payment_method: 'TRANSFER',
      transfer_reference: 'ref-1',
      paid_at: '2026-06-15T00:00:00.000Z',
      paid_by: 'admin-1',
      user_name: 'Vendedor Mobile',
      paid_by_name: 'Admin',
    },
  ],
};

const adminWeeklySummaryResponse = {
  ok: true,
  data: {
    employees: [
      {
        user_id: 'collector-sc-1',
        full_name: 'Cobrador Mobile',
        role: 'COLLECTOR',
        commissions_total: 4500,
        earliest_week: '2026-06-15',
        latest_week: '2026-06-21',
        salary_amount: 25000,
        total_net: 29500,
      },
    ],
  },
};

const collectionSheetsResponse = {
  ok: true,
  data: [
    {
      id: 'sheet-sc-1',
      sheet_date: '2026-06-23',
      filter_used: 'ALL',
      status: 'ACTIVE',
      created_at: '2026-06-23T06:00:00.000Z',
      sent_at: null,
      collector_id: 'collector-sc-1',
      collector_name: 'Cobrador Mobile',
      total_items: 8,
    },
  ],
};

const collectorPaymentsResponse = {
  ok: true,
  data: [
    {
      id: 'pay-sc-1',
      installment_id: 'inst-sc-1',
      amount_received: 12000,
      amount_cash: 12000,
      amount_transfer: 0,
      payment_method: 'CASH',
      transfer_reference: null,
      status: 'PENDING',
      rejection_reason: null,
      notes: null,
      created_at: '2026-06-23T10:00:00.000Z',
      approved_at: null,
      approved_by: null,
      installment_number: 2,
      amount_due: 12000,
      due_date: '2026-06-20',
      credit_id: 'credit-sc-1',
      credit_type: 'LOAN',
      customer_name: 'Cliente Cobrador Mobile',
      customer_dni: '40999000',
      collector_name: 'Cobrador Mobile',
      is_reversal: false,
      admin_direct: false,
      parent_payment_id: null,
      reversal_payment_id: null,
    },
  ],
};

describe('Seller / Collector — Remaining Mobile UX', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  it('Seller Operaciones Mobile — listado en cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/credits*', creditsResponse).as('creditsList');

    cy.loginAs('SELLER', '/seller/operations');
    cy.wait('@creditsList');

    cy.get('[data-cy="credits-list-table"]').should('not.be.visible');
    cy.get('[data-cy="credits-list-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cliente Seller Mobile');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Seller Comisiones Mobile — comisiones y liquidaciones en cards', () => {
    cy.intercept('GET', '**/api/commissions', commissionsResponse).as('commissions');
    cy.intercept('GET', '**/api/commissions/liquidations*', liquidationsResponse).as(
      'liquidations',
    );

    cy.loginAs('SELLER', '/seller/commissions');
    cy.wait('@commissions');
    cy.wait('@liquidations');

    cy.get('[data-cy="seller-commissions-table"]').should('not.be.visible');
    cy.get('[data-cy="seller-commissions-mobile-card"]').should('have.length', 1);
    cy.get('[data-cy="seller-liquidations-table"]').should('not.be.visible');
    cy.get('[data-cy="seller-liquidations-mobile-card"]').should('have.length', 1);

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Collector Mi Ruta Mobile — planillas asignadas en cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/collections*', collectionSheetsResponse).as(
      'collectionSheets',
    );
    cy.intercept('GET', '**/api/payments*', { ok: true, data: [] }).as(
      'recentPayments',
    );

    cy.loginAs('COLLECTOR', '/collector/route');
    cy.wait('@collectionSheets');

    cy.get('[data-cy="collector-route-sheets-table"]').should('not.be.visible');
    cy.get('[data-cy="collector-route-sheets-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cobrador Mobile');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Collector Mis Cobros Mobile — listado en cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/payments*', collectorPaymentsResponse).as(
      'collectorPayments',
    );

    cy.loginAs('COLLECTOR', '/collector/payments');
    cy.wait('@collectorPayments');

    cy.get('[data-cy="collector-payments-table"]').should('not.be.visible');
    cy.get('[data-cy="collector-payments-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cliente Cobrador Mobile');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Collector Comisiones Mobile — comisiones y liquidaciones en cards', () => {
    cy.intercept('GET', '**/api/commissions', commissionsResponse).as('commissions');
    cy.intercept('GET', '**/api/commissions/liquidations*', liquidationsResponse).as(
      'liquidations',
    );

    cy.loginAs('COLLECTOR', '/collector/commissions');
    cy.wait('@commissions');
    cy.wait('@liquidations');

    cy.get('[data-cy="collector-commissions-table"]').should('not.be.visible');
    cy.get('[data-cy="collector-commissions-mobile-card"]').should('have.length', 1);
    cy.get('[data-cy="collector-liquidations-table"]').should('not.be.visible');
    cy.get('[data-cy="collector-liquidations-mobile-card"]').should('have.length', 1);

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Admin Comisiones Mobile — resumen e historial usan cards en vez de tablas', () => {
    cy.intercept('GET', '**/api/cash-register/dashboard*', {
      ok: true,
      data: { is_closed: false },
    }).as('cashDashboardCommissions');
    cy.intercept('GET', '**/api/commissions/weekly-summary', adminWeeklySummaryResponse).as(
      'weeklySummary',
    );
    cy.intercept('GET', '**/api/commissions/liquidations*', liquidationsResponse).as(
      'liquidations',
    );
    cy.intercept('GET', /\/api\/commissions(\?.*)?$/, commissionsResponse).as(
      'pendingCommissions',
    );
    cy.intercept('GET', '**/api/commissions/salary/collector-sc-1', {
      ok: true,
      data: {
        user_id: 'collector-sc-1',
        weekly_amount: 25000,
        active: true,
      },
    }).as('collectorSalary');
    cy.intercept('GET', '**/api/users*', {
      ok: true,
      data: [
        {
          id: 'collector-sc-1',
          full_name: 'Cobrador Mobile',
          dni: '40999000',
          email: 'collector.mobile@finflow.test',
          role: 'COLLECTOR',
          status: 'ACTIVE',
          is_temp_password: false,
          failed_attempts: 0,
          locked_at: null,
          last_login_at: null,
          created_at: '2026-06-01T12:00:00.000Z',
        },
      ],
    }).as('commissionUsers');

    cy.loginAs('ADMIN', '/admin/commissions');
    cy.wait('@weeklySummary');
    cy.wait('@liquidations');

    cy.get('[data-cy="admin-commissions-summary-table"] table').should('not.be.visible');
    cy.get('[data-cy="admin-commissions-summary-mobile-card"]')
      .should('have.length', 1)
      .first()
      .should('contain.text', 'Cobrador Mobile')
      .and('contain.text', 'Total liquidado');
    cy.get('[data-cy="admin-commissions-recent-table"] table').should('not.be.visible');
    cy.get('[data-cy="admin-commissions-recent-mobile-card"]').should('have.length', 1);

    cy.contains('button', 'Historial').click();
    cy.get('[data-cy="admin-commissions-history-table"] table').should('not.be.visible');
    cy.get('[data-cy="admin-commissions-history-mobile-card"]')
      .should('have.length', 1)
      .first()
      .should('contain.text', 'Total liquidado');

    cy.contains('button', 'Resumen semanal').click();
    cy.contains('[data-cy="admin-commissions-summary-mobile-card"] button', 'Liquidar')
      .should('be.visible')
      .click();
    cy.wait('@pendingCommissions');
    cy.get('[data-cy="admin-commissions-liquidation-sales-table"] table').should(
      'not.be.visible',
    );
    cy.get('[data-cy="admin-commissions-liquidation-sales-mobile-card"]')
      .should('have.length', 1)
      .first()
      .should('contain.text', 'Cliente Seller Mobile')
      .and('contain.text', 'Comisión');
    cy.contains('.p-dialog:visible button', 'Confirmar liquidación')
      .should('be.visible')
      .and('be.enabled')
      .then(($button) => {
        const rect = $button[0].getBoundingClientRect();
        expect(rect.right).to.be.at.most($button[0].ownerDocument.defaultView?.innerWidth ?? 375);
      })
      .click();
    cy.contains('.p-dialog:visible button', 'Sí, liquidar')
      .should('be.visible')
      .and('be.enabled');

    cy.contains('.p-dialog:visible button', 'Cancelar').click();
    cy.contains('.p-dialog:visible button', 'Cancelar').click();
    cy.get('.ff-shell__main').scrollTo('top');
    cy.contains('.commissions-mobile-tabs .ff-tab', 'Sueldo fijo')
      .then(($tab) => $tab[0].scrollIntoView({ block: 'nearest', inline: 'center' }))
      .click({ force: true });
    cy.get('[data-cy="admin-commissions-salaries-table"] table').should('not.be.visible');
    cy.get('[data-cy="admin-commissions-salaries-mobile-card"]')
      .should('have.length', 1)
      .first()
      .should('contain.text', 'Cobrador Mobile')
      .and('contain.text', 'Monto base')
      .and('contain.text', 'Total a pagar fijo');
    cy.get('[data-cy="admin-commissions-salaries-mobile-edit-action"]')
      .first()
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });
    cy.wait('@collectorSalary');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});
