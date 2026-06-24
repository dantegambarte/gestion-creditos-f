const paymentsResponse = {
  ok: true,
  data: [
    {
      id: 'pay-mobile-1',
      installment_id: 'inst-mobile-1',
      amount_received: 15000,
      amount_cash: 15000,
      amount_transfer: 0,
      payment_method: 'CASH',
      transfer_reference: null,
      status: 'PENDING',
      rejection_reason: null,
      notes: null,
      created_at: '2026-06-23T10:00:00.000Z',
      approved_at: null,
      approved_by: null,
      installment_number: 3,
      amount_due: 15000,
      due_date: '2026-06-20',
      credit_id: 'credit-mobile-1',
      credit_type: 'LOAN',
      customer_name: 'Cliente Mobile Remaining',
      customer_dni: '40222333',
      collector_name: 'Cobrador Mobile Remaining',
      is_reversal: false,
      admin_direct: false,
      parent_payment_id: null,
      reversal_payment_id: null,
    },
  ],
};

const paymentDetailResponse = {
  ok: true,
  data: {
    ...paymentsResponse.data[0],
    amount_paid: 15000,
    penalty_amount: 0,
    customer_id: 'cust-mobile-1',
    collector_id: 'collector-mobile-1',
    is_reversal: false,
    admin_direct: false,
    reversal_reason: null,
    reversal_payment_id: null,
  },
};

const collectorsResponse = {
  ok: true,
  data: [
    {
      id: 'collector-mobile-1',
      full_name: 'Cobrador Mobile Remaining',
      dni: '40111000',
      email: 'collector.remaining@finflow.test',
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

const overdueInstallmentsResponse = {
  ok: true,
  data: [
    {
      id: 'inst-mora-1',
      customer_name: 'Cliente Mora Remaining',
      customer_dni: '40333444',
      installment_number: 5,
      amount_due: 22000,
      due_date: '2026-05-10',
      penalty_amount: 0,
      collector_name: 'Cobrador Mobile Remaining',
    },
  ],
};

const expensesResponse = {
  ok: true,
  data: {
    rows: [
      {
        id: 'expense-mobile-1',
        amount: 8000,
        description: 'Combustible reparto',
        payment_method: 'CASH',
        transfer_reference: null,
        category_id: 'cat-1',
        category_name: 'Logística',
        expense_date: '2026-06-23',
        source: 'DAILY',
        created_at: '2026-06-23T09:00:00.000Z',
        created_by_name: 'QA Admin',
      },
    ],
    total: 1,
  },
};

// ── Fixtures con texto largo — P0 #2: ningún card debe romper el layout
// con nombres/descripciones largas (overflow horizontal o boxes rotas).
const LONG_NAME = 'Cliente Con Nombre Extremadamente Largo Para Probar Truncado En Mobile';
const LONG_DESCRIPTION =
  'Pago de combustible y mantenimiento de la flota completa de motos repartidoras del mes';

const longPaymentsResponse = {
  ok: true,
  data: [
    {
      ...paymentsResponse.data[0],
      id: 'pay-long-1',
      customer_name: LONG_NAME,
      collector_name: LONG_NAME,
    },
  ],
};

const longOverdueInstallmentsResponse = {
  ok: true,
  data: [
    {
      ...overdueInstallmentsResponse.data[0],
      customer_name: LONG_NAME,
    },
  ],
};

const longExpensesResponse = {
  ok: true,
  data: {
    rows: [
      {
        ...expensesResponse.data.rows[0],
        id: 'expense-long-1',
        description: LONG_DESCRIPTION,
        category_name: 'Categoría De Nombre Largo Tambien',
      },
    ],
    total: 1,
  },
};

describe('Admin Backoffice — Remaining Mobile UX (Cobros, Mora, Gastos)', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  it('Cobros Mobile — renderiza cards en vez de tabla y el modal de detalle tiene scroll con acciones visibles', () => {
    cy.intercept('GET', '**/api/payments*', paymentsResponse).as('paymentsList');
    cy.intercept('GET', '**/api/users*', collectorsResponse).as('collectorsList');
    cy.intercept('GET', '**/api/payments/pay-mobile-1', paymentDetailResponse).as(
      'paymentDetail',
    );

    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait(['@paymentsList', '@collectorsList']);

    cy.get('[data-cy="admin-payments-table"]').should('not.be.visible');
    cy.get('[data-cy="admin-payments-mobile-list"]').should('be.visible');
    cy.get('[data-cy="admin-payments-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cliente Mobile Remaining');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    cy.get('[data-cy="admin-payments-mobile-view-action"]').first().click();
    cy.wait('@paymentDetail');

    cy.get('[data-cy="payment-detail-dialog"]').should('be.visible');
    cy.get('[data-cy="payment-detail-dialog-body"]')
      .should('have.css', 'overflow-y', 'auto')
      .contains('Cliente Mobile Remaining');

    cy.get('[data-cy="payment-detail-dialog-close"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
        expect(rect.bottom).to.be.at.most(667);
      })
      .click({ force: true });
  });

  it('Mora Mobile — formato card y diálogo de Aplicar Mora con inputs y botón dentro del viewport', () => {
    cy.intercept('GET', '**/api/installments*', overdueInstallmentsResponse).as(
      'overdueList',
    );
    cy.intercept('GET', '**/api/cash-register/dashboard*', {
      statusCode: 200,
      body: { ok: true, data: { isClosed: false } },
    }).as('cashDashboard');

    cy.loginAs('ADMIN', '/admin/delinquency');
    cy.wait('@overdueList');

    cy.get('[data-cy="delinquency-table"]').should('not.be.visible');
    cy.get('[data-cy="delinquency-mobile-list"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-cy="delinquency-mobile-card"]')
      .should('have.length', 1)
      .first()
      .scrollIntoView()
      .should('be.visible')
      .contains('Cliente Mora Remaining');

    cy.get('[data-cy="delinquency-mobile-apply-action"]')
      .first()
      .scrollIntoView()
      .click();

    cy.get('[data-cy="delinquency-apply-dialog"]').should('be.visible');
    cy.get('[data-cy="delinquency-apply-dialog-body"] input[type="number"]')
      .should('be.visible')
      .then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(375);
        expect(parseFloat(getComputedStyle($input[0]).fontSize)).to.be.at.least(16);
      })
      .type('500');

    cy.get('[data-cy="delinquency-apply-dialog-submit"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(667);
      });
  });

  it('Gastos Mobile — listado principal en cards y botón de registrar gasto accesible', () => {
    cy.intercept('GET', '**/api/expenses*', expensesResponse).as('expensesList');
    cy.intercept('GET', '**/api/expense-categories*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('expenseCategories');

    cy.loginAs('ADMIN', '/admin/expenses');
    cy.wait(['@expensesList', '@expenseCategories']);

    cy.get('[data-cy="expenses-table"]').should('not.be.visible');
    cy.get('[data-cy="expenses-mobile-list"]').should('be.visible');
    cy.get('[data-cy="expenses-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Combustible reparto');

    cy.get('[data-cy="expenses-register-trigger"]')
      .scrollIntoView()
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
      });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    // Modal "Registrar Gasto" — el footer con el submit nunca debe quedar cortado.
    cy.get('[data-cy="expenses-register-trigger"]').click();
    cy.get('[data-cy="expense-side-panel"]').should('be.visible');
    cy.get('[data-cy="expense-side-panel-body"]').scrollTo('bottom');
    cy.get('[data-cy="expense-submit-action"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
        expect(rect.bottom).to.be.at.most(667);
      });
    cy.get('[data-cy="expense-side-panel"] button[title="Cerrar"]').click();
    cy.get('[data-cy="expense-side-panel"]').should('not.exist');

    // Modal "Nueva Categoría" — abierto desde dentro de "Gestionar categorías".
    cy.get('[data-cy="expenses-manage-categories-action"]').click();
    cy.contains('button', 'Nueva categoría')
      .scrollIntoView()
      .click();
    cy.get('[data-cy="expense-category-create-dialog"]').should('be.visible');
    cy.get('[data-cy="expense-category-create-dialog-body"] input')
      .should('be.visible')
      .type('Categoría Mobile QA');
  });

  it('Generar Planillas Mobile — el modal entra en pantalla y el botón final es clickeable', () => {
    cy.intercept('GET', '**/api/users*', collectorsResponse).as('collectorsForGenerate');
    cy.intercept('GET', '**/api/collections*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('collectionsForGenerate');
    // El cobrador por defecto es "Todos" => modo batch => POST generate-batch
    // (no POST /collections). Devuelve 200 con un outcome de error por cobrador.
    cy.intercept('POST', '**/api/collections/generate-batch', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          results: [
            {
              collector_id: 'collector-mobile-1',
              error: { status: 409, message: 'Sin cuotas para asignar.' },
            },
          ],
        },
      },
    }).as('collectionsGenerateNoQuotas');

    cy.loginAs('ADMIN', '/admin/collections');
    cy.wait(['@collectorsForGenerate', '@collectionsForGenerate']);

    cy.get('[data-cy="admin-collections-generate-action"]')
      .scrollIntoView()
      .click();

    cy.contains('.p-dialog', 'Generar planilla de cobro').should('be.visible');
    cy.contains('.p-dialog', 'Generar planilla de cobro').then(($dialog) => {
      const rect = $dialog[0].getBoundingClientRect();
      expect(rect.left).to.be.at.most(1);
      expect(rect.right).to.be.at.least(374);
      expect(rect.top).to.be.at.most(1);
      expect(rect.bottom).to.be.at.least(666);
      expect(rect.height).to.be.at.least(666);
    });

    cy.get('[data-cy="generate-collection-dialog-body"]').should('be.visible');
    cy.contains('Estado del día').scrollIntoView().should('be.visible');
    cy.contains('Se van a generar').should('be.visible');
    cy.get('[data-cy="generate-collection-dialog-footer"]')
      .should('be.visible')
      .then(($footer) => {
        const rect = $footer[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(667);
      });

    cy.get('[data-cy="generate-collection-submit"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(667);
      });

    cy.get('[data-cy="generate-collection-submit"]').click();
    cy.wait('@collectionsGenerateNoQuotas');
    cy.contains('.p-toast-message', 'Sin cuotas')
      .should('be.visible')
      .then(($toast) => {
        const rect = $toast[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(375);
        expect(rect.height).to.be.at.most(128);
      });
    cy.get('[data-cy="generate-collection-dialog-footer"]').should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Reportes Mobile — tabs de Cartera, Mora, Cobradores, Productos y Cobranza muestran cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/reports/portfolio', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          by_status_type: [
            { status: 'ACTIVE', type: 'LOAN', count: 4, total_amount: 120000 },
          ],
          active_pending_balance: 120000,
        },
      },
    }).as('portfolioReport');

    cy.intercept('GET', '**/api/reports/overdue', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          summary: {
            overdue_installments: 2,
            total_overdue_amount: 30000,
            total_penalties: 1500,
            avg_days_overdue: 12.5,
          },
          by_customer: [
            {
              customer_id: 'cust-rep-1',
              customer_name: 'Cliente Reporte Mora',
              phone: '11-4000-0000',
              overdue_count: 2,
              total_overdue: 30000,
              max_days_overdue: 18,
            },
          ],
        },
      },
    }).as('overdueReport');

    cy.intercept('GET', '**/api/reports/collectors*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            collector_id: 'collector-rep-1',
            collector_name: 'Cobrador Reporte',
            total_payments: 10,
            approved_count: 9,
            rejected_count: 1,
            total_collected: 90000,
            approval_rate: 90,
          },
        ],
      },
    }).as('collectorsReport');

    cy.intercept('GET', '**/api/reports/products*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'product-rep-1',
            title: 'Producto Reporte',
            description: '',
            status: 'ACTIVE',
            min_price: 5000,
            max_price: 7000,
            available_count: 3,
            times_sold: 8,
            total_revenue: 56000,
            avg_selling_price: 6000,
          },
        ],
      },
    }).as('productsReport');

    cy.intercept('GET', '**/api/reports/collection*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          summary: {
            grand_total: 50000,
            total_cash: 30000,
            total_transfer: 20000,
            payments_count: 6,
            avg_payment: 8333,
          },
          daily: [
            {
              day: '2026-06-23',
              total: 50000,
              total_cash: 30000,
              total_transfer: 20000,
              payments_count: 6,
            },
          ],
        },
      },
    }).as('collectionReport');

    cy.loginAs('ADMIN', '/admin/reports');
    cy.get('[data-cy="admin-reports-page"]').should('be.visible');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Cartera').click();
    cy.wait('@portfolioReport');
    cy.get('[data-cy="portfolio-report-table"]').should('not.be.visible');
    cy.get('[data-cy="portfolio-report-mobile-card"]').should('have.length.at.least', 1);

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Mora').click();
    cy.wait('@overdueReport');
    cy.get('[data-cy="overdue-report-table"]').should('not.be.visible');
    cy.get('[data-cy="overdue-report-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cliente Reporte Mora');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Cobradores').click();
    cy.wait('@collectorsReport');
    cy.get('[data-cy="collectors-report-table"]').should('not.be.visible');
    cy.get('[data-cy="collectors-report-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cobrador Reporte');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Productos').click();
    cy.wait('@productsReport');
    cy.get('[data-cy="products-report-table"]').should('not.be.visible');
    cy.get('[data-cy="products-report-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Producto Reporte');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Recaudación').click();
    cy.wait('@collectionReport');
    cy.get('[data-cy="collection-report-table"]').should('not.be.visible');
    cy.get('[data-cy="collection-report-mobile-card"]').should('have.length.at.least', 1);

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  // P1 #5 — tabs de Reportes que quedaban con <table> legacy: Movimientos de
  // caja (Caja General), Conversiones de caja y Próximos vencimientos.
  it('Reportes Mobile — Movimientos, Conversiones y Próximos vencimientos muestran cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/reports/general-cash-movements*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          summary: { total_movements: 1, total_in: 0, total_out: 5000 },
          rows: [
            {
              id: 'gen-mov-1',
              movement_type: 'EXPENSE',
              direction: 'OUT',
              amount: 5000,
              amount_cash: 5000,
              amount_transfer: 0,
              description: 'Pago proveedor combustible',
              beneficiary_name: 'YPF',
              reference_type: null,
              reference_id: null,
              created_at: '2026-06-23T12:00:00.000Z',
              performed_by_name: 'QA Admin',
            },
          ],
        },
      },
    }).as('generalCashMovements');

    cy.intercept('GET', '**/api/reports/cash-conversions*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          summary: {
            total_conversions: 1,
            total_amount: 10000,
            cash_to_transfer: 10000,
            transfer_to_cash: 0,
          },
          rows: [
            {
              id: 'conv-1',
              register_date: '2026-06-23',
              criteria: 'MANUAL',
              source_method: 'CASH',
              target_method: 'TRANSFER',
              amount: 10000,
              notes: 'Conversión de prueba',
              created_by_name: 'QA Admin',
              created_at: '2026-06-23T13:00:00.000Z',
            },
          ],
        },
      },
    }).as('cashConversions');

    cy.intercept('GET', '**/api/reports/upcoming*', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          days: 7,
          summary: { installments_count: 1, expected_amount: 15000 },
          by_day: [{ due_date: '2026-06-25', count: 1, expected_amount: 15000 }],
          by_customer: [
            {
              customer_id: 'cust-up-1',
              customer_name: 'Cliente Próximo Vencimiento',
              phone: '11-5000-0000',
              assigned_collector: 'Cobrador Reporte',
              installments_count: 1,
              expected_amount: 15000,
              next_due_date: '2026-06-25',
            },
          ],
        },
      },
    }).as('upcomingReport');

    cy.loginAs('ADMIN', '/admin/reports');
    cy.get('[data-cy="admin-reports-page"]').should('be.visible');

    // Movimientos de caja → switch a "Caja General" para evitar el flujo de
    // selección de jornada/caja puntual (fuera de alcance de este check).
    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Movimientos de caja').click();
    cy.contains('button', 'Caja General').click();
    cy.contains('button', 'Buscar movimientos').click();
    cy.wait('@generalCashMovements');
    cy.get('[data-cy="cash-movements-general-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-movements-general-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Pago proveedor combustible');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Conversiones de caja').click();
    cy.contains('button', 'Consultar').click();
    cy.wait('@cashConversions');
    cy.get('[data-cy="cash-conversions-report-table"]').should('not.be.visible');
    cy.get('[data-cy="cash-conversions-report-mobile-card"]').should('have.length', 1);

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Próximos vencimientos').click();
    cy.wait('@upcomingReport');
    cy.get('[data-cy="upcoming-report-byday-table"]').should('not.be.visible');
    cy.get('[data-cy="upcoming-report-byday-mobile-card"]').should('have.length', 1);
    cy.get('[data-cy="upcoming-report-bycustomer-table"]').should('not.be.visible');
    cy.get('[data-cy="upcoming-report-bycustomer-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Cliente Próximo Vencimiento');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  // P0 #1 — el auto-scroll a "Referencia" al elegir Transferencia no tenía cobertura.
  it('Registrar Gasto Mobile — al elegir Transferencia, el campo Referencia entra solo al viewport', () => {
    cy.intercept('GET', '**/api/expenses*', expensesResponse).as('expensesList');
    cy.intercept('GET', '**/api/expense-categories*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('expenseCategories');

    cy.loginAs('ADMIN', '/admin/expenses');
    cy.wait(['@expensesList', '@expenseCategories']);

    cy.get('[data-cy="expenses-register-trigger"]').click();
    cy.get('[data-cy="expense-side-panel"]').should('be.visible');

    // Antes de elegir Transferencia, el campo Referencia ni existe.
    cy.get('[data-cy="expense-transfer-reference-input"]').should('not.exist');

    cy.get('[data-cy="expense-payment-transfer-option"]').click();

    // El componente dispara scrollIntoView(smooth); should() reintenta hasta
    // que termine la animación y el campo quede realmente visible sin tocar nada.
    cy.get('[data-cy="expense-transfer-reference-input"]')
      .should('be.visible')
      .then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
        expect(rect.bottom).to.be.at.most(667);
      });

    // El header (con la X) sigue fijo arriba, no se lo llevó el scroll.
    cy.get('[data-cy="expense-side-panel-close"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
        expect(rect.top).to.be.at.most(100);
      });
  });

  // P0 #2 — nombres/descripciones largas no deben romper el layout (overflow
  // horizontal, cards que se ensanchan, texto que tapa botones/badges).
  it('Textos largos — Cobros, Mora y Gastos truncan sin overflow horizontal', () => {
    cy.intercept('GET', '**/api/payments*', longPaymentsResponse).as('paymentsListLong');
    cy.intercept('GET', '**/api/users*', collectorsResponse).as('collectorsListLong');

    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait(['@paymentsListLong', '@collectorsListLong']);

    cy.get('[data-cy="admin-payments-mobile-card"]')
      .first()
      .within(() => {
        cy.contains(LONG_NAME).then(($name) => {
          const el = $name[0];
          expect(el.scrollWidth).to.be.greaterThan(el.clientWidth);
        });
      });
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    cy.intercept('GET', '**/api/installments*', longOverdueInstallmentsResponse).as(
      'overdueListLong',
    );
    cy.intercept('GET', '**/api/cash-register/dashboard*', {
      statusCode: 200,
      body: { ok: true, data: { isClosed: false } },
    }).as('cashDashboardLong');

    cy.visit('/admin/delinquency');
    cy.wait('@overdueListLong');

    cy.get('[data-cy="delinquency-mobile-card"]')
      .first()
      .within(() => {
        cy.contains(LONG_NAME).then(($name) => {
          const el = $name[0];
          expect(el.scrollWidth).to.be.greaterThan(el.clientWidth);
        });
      });
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    cy.intercept('GET', '**/api/expenses*', longExpensesResponse).as('expensesListLong');
    cy.intercept('GET', '**/api/expense-categories*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('expenseCategoriesLong');

    cy.visit('/admin/expenses');
    cy.wait(['@expensesListLong', '@expenseCategoriesLong']);

    cy.get('[data-cy="expenses-mobile-card"]')
      .first()
      .within(() => {
        cy.contains(LONG_DESCRIPTION).then(($desc) => {
          const el = $desc[0];
          expect(el.scrollWidth).to.be.greaterThan(el.clientWidth);
        });
      });
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});

// P0 #3 — Android chico (360×640). Es más angosto Y más bajo que iPhone SE2
// (375×667): los maxWidth:'95vw' dan 342px en vez de 356px, y los modales
// fullscreen tienen 27px menos de alto disponible. Smoke test de los flujos
// críticos, no repite cada aserción de arriba.
describe('Admin Backoffice — Android chico (360×640)', () => {
  beforeEach(() => {
    cy.viewport(360, 640);
  });

  it('Cobros — cards y modal de detalle entran en 360×640', () => {
    cy.intercept('GET', '**/api/payments*', paymentsResponse).as('paymentsList');
    cy.intercept('GET', '**/api/users*', collectorsResponse).as('collectorsList');
    cy.intercept('GET', '**/api/payments/pay-mobile-1', paymentDetailResponse).as(
      'paymentDetail',
    );

    cy.loginAs('ADMIN', '/admin/payments');
    cy.wait(['@paymentsList', '@collectorsList']);

    cy.get('[data-cy="admin-payments-table"]').should('not.be.visible');
    cy.get('[data-cy="admin-payments-mobile-card"]').should('have.length', 1);
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    cy.get('[data-cy="admin-payments-mobile-view-action"]').first().click();
    cy.wait('@paymentDetail');
    cy.get('[data-cy="payment-detail-dialog-close"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(360);
        expect(rect.bottom).to.be.at.most(640);
      });
  });

  it('Mora — filtros apilados, cards y diálogo Aplicar Mora entran en 360×640', () => {
    cy.intercept('GET', '**/api/installments*', overdueInstallmentsResponse).as(
      'overdueList',
    );
    cy.intercept('GET', '**/api/cash-register/dashboard*', {
      statusCode: 200,
      body: { ok: true, data: { isClosed: false } },
    }).as('cashDashboard');

    cy.loginAs('ADMIN', '/admin/delinquency');
    cy.wait('@overdueList');

    cy.get('[data-cy="delinquency-filter-estado"]').should(($el) => {
      const rect = $el[0].getBoundingClientRect();
      expect(rect.right).to.be.at.most(360);
    });
    cy.get('[data-cy="delinquency-mobile-list"]').scrollIntoView().should('be.visible');

    cy.get('[data-cy="delinquency-mobile-apply-action"]').first().scrollIntoView().click();
    cy.get('[data-cy="delinquency-apply-dialog-body"] input[type="number"]')
      .should('be.visible')
      .then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        expect(rect.right).to.be.at.most(360);
      });
    cy.get('[data-cy="delinquency-apply-dialog-submit"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(640);
      });
  });

  it('Gastos — cards, panel "Registrar gasto" fullscreen y submit visibles en 360×640', () => {
    cy.intercept('GET', '**/api/expenses*', expensesResponse).as('expensesList');
    cy.intercept('GET', '**/api/expense-categories*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('expenseCategories');

    cy.loginAs('ADMIN', '/admin/expenses');
    cy.wait(['@expensesList', '@expenseCategories']);

    cy.get('[data-cy="expenses-mobile-card"]').should('have.length', 1);

    cy.get('[data-cy="expenses-register-trigger"]').click();
    cy.get('[data-cy="expense-side-panel"]').should(($panel) => {
      const rect = $panel[0].getBoundingClientRect();
      expect(rect.width).to.be.at.most(360);
    });

    cy.get('[data-cy="expense-side-panel-body"]').scrollTo('bottom');
    cy.get('[data-cy="expense-submit-action"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(640);
      });

    // El bug de "se pierde la X al scrollear" era justo más visible en
    // pantallas chicas — confirmamos que sigue fija también en 360×640.
    cy.get('[data-cy="expense-side-panel-close"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.top).to.be.at.least(0);
        expect(rect.top).to.be.at.most(100);
      });
  });

  it('Generar Planillas — el modal y el botón final entran en 360×640', () => {
    cy.intercept('GET', '**/api/users*', collectorsResponse).as('collectorsForGenerate');
    cy.intercept('GET', '**/api/collections*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('collectionsForGenerate');

    cy.loginAs('ADMIN', '/admin/collections');
    cy.wait(['@collectorsForGenerate', '@collectionsForGenerate']);

    cy.get('[data-cy="admin-collections-generate-action"]').scrollIntoView().click();

    cy.get('[data-cy="generate-collection-dialog-body"]').should('be.visible');
    cy.get('[data-cy="generate-collection-dialog-footer"]')
      .should('be.visible')
      .then(($footer) => {
        const rect = $footer[0].getBoundingClientRect();
        expect(rect.bottom).to.be.at.most(640);
      });
    cy.get('[data-cy="generate-collection-submit"]')
      .should('be.visible')
      .then(($btn) => {
        const rect = $btn[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(360);
        expect(rect.bottom).to.be.at.most(640);
      });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Reportes — tabs de Cartera y Productos muestran cards sin overflow en 360×640', () => {
    cy.intercept('GET', '**/api/reports/portfolio', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          by_status_type: [
            { status: 'ACTIVE', type: 'LOAN', count: 4, total_amount: 120000 },
          ],
          active_pending_balance: 120000,
        },
      },
    }).as('portfolioReport');
    cy.intercept('GET', '**/api/reports/products*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'product-rep-1',
            title: 'Producto Reporte',
            description: '',
            status: 'ACTIVE',
            min_price: 5000,
            max_price: 7000,
            available_count: 3,
            times_sold: 8,
            total_revenue: 56000,
            avg_selling_price: 6000,
          },
        ],
      },
    }).as('productsReport');

    cy.loginAs('ADMIN', '/admin/reports');
    cy.get('[data-cy="admin-reports-page"]').should('be.visible');

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Cartera').click();
    cy.wait('@portfolioReport');
    cy.get('[data-cy="portfolio-report-table"]').should('not.be.visible');
    cy.get('[data-cy="portfolio-report-mobile-card"]').should('have.length.at.least', 1);

    cy.get('[data-cy="admin-reports-tabs"]').contains('button', 'Productos').click();
    cy.wait('@productsReport');
    cy.get('[data-cy="products-report-table"]').should('not.be.visible');
    cy.get('[data-cy="products-report-mobile-card"]').should('have.length', 1);

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});
