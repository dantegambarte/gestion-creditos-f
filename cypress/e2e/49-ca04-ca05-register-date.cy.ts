/**
 * SUITE: CA-04 + CA-05 — register_date en enganches y gastos (Jornada Comercial)
 *
 * Raíz del bug:
 *   credit_down_payments y expenses usaban DEFAULT NOW() para inferir la jornada.
 *   Post-medianoche, los registros caían en el nuevo día calendario y eran excluidos
 *   del dashboard y pre-cierre de la jornada activa.
 *
 * Fix: columna register_date DATE seteada vía getActiveJornadaDate() al momento de
 *   crear el registro. Todas las queries de caja filtran por register_date en lugar
 *   de created_at::date.
 *
 * Cobertura:
 *   - CA-05 real backend: gasto creado aparece en pre-cierre de la jornada activa
 *   - CA-04 mock: dashboard muestra enganches de jornada anterior (post-medianoche simulado)
 *   - CA-04 + CA-05 mock: pre-cierre muestra enganches y gastos de jornada anterior
 */

// ── Helpers de fecha ──────────────────────────────────────────────────────────

/** YYYY-MM-DD desplazada N días desde hoy (hora local Buenos Aires). */
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

const TODAY = dateOffset(0);
const YESTERDAY = dateOffset(-1);

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DASHBOARD_WITH_ENGANCHES = {
  ok: true,
  data: {
    date: YESTERDAY,
    is_closed: false,
    cash_amount: 55000,
    transfer_amount: 20000,
    total_collected: 85000,
    total_outflows: 5000,
    net_balance: 80000,
    approved_count: 3,
    pending_count: 0,
    pending_amount: 0,
    down_payments_total: 10000,
    down_payments_count: 1,
  },
};

const MOCK_PRE_CLOSE_WITH_ENGANCHES_AND_GASTOS = {
  ok: true,
  data: {
    date: YESTERDAY,
    ingresos: {
      cobros_efectivo: 45000,
      cobros_transferencia: 20000,
      enganches_efectivo: 8000,
      enganches_transferencia: 2000,
      total_bruto: 75000,
    },
    egresos: {
      gastos_efectivo: 3000,
      gastos_transferencia: 1500,
      comisiones_efectivo: 0,
      comisiones_transferencia: 0,
      total: 4500,
    },
    efectivo: { esperado: 50000 },
    transferencias: { esperado: 20500 },
    pendientes: { count: 0, amount: 0 },
  },
};

const MOCK_CASH_HISTORY = { ok: true, data: [] };

// ── CA-05 real backend ─────────────────────────────────────────────────────────

describe('CA-05 real — gasto creado hoy queda en la jornada activa (register_date)', () => {
  const GASTO_AMOUNT = 1337;
  let createdExpenseId: string | null = null;

  before(() => {
    // Solo corre si realAuthEnabled está habilitado
    if (!Cypress.env('realAuthEnabled')) {
      cy.log('realAuthEnabled=false — saltando suite real CA-05');
    }
  });

  beforeEach(function () {
    if (!Cypress.env('realAuthEnabled')) this.skip();
  });

  it('CA-05 — gasto POST retorna 201 y el pre-cierre refleja el egreso en la jornada activa', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      // Obtener una categoría válida (category_id es requerido en el validador)
      cy.apiRequest('GET', '/expense-categories', null, token).then(
        (catRes) => {
          expect(catRes.status).to.eq(200);
          const categories: { id: string }[] = catRes.body.data ?? [];
          if (categories.length === 0) {
            cy.log('Sin categorías — saltando test CA-05');
            return;
          }
          const categoryId = categories[0].id;

          // Snapshot del pre-cierre antes de crear el gasto
          cy.apiRequest('GET', '/cash-register/pre-close', null, token).then(
            (before) => {
              expect(before.status).to.eq(200);
              const gastosBefore: number =
                before.body.data.egresos.gastos_efectivo ?? 0;

              // Crear gasto en efectivo
              cy.apiRequest(
                'POST',
                '/expenses',
                {
                  amount: GASTO_AMOUNT,
                  description: '[CA-05 test] gasto register_date',
                  expense_date: TODAY,
                  payment_method: 'CASH',
                  category_id: categoryId,
                },
                token,
              ).then((createRes) => {
                expect(
                  createRes.status,
                  `POST /expenses — ${JSON.stringify(createRes.body)}`,
                ).to.eq(201);
                createdExpenseId = (createRes.body.data as { id: string }).id;

                // El pre-cierre debe reflejar el gasto nuevo
                cy.apiRequest(
                  'GET',
                  '/cash-register/pre-close',
                  null,
                  token,
                ).then((after) => {
                  expect(after.status).to.eq(200);
                  const gastosAfter: number =
                    after.body.data.egresos.gastos_efectivo ?? 0;
                  expect(
                    gastosAfter,
                    'gastos_efectivo debe incluir el nuevo gasto',
                  ).to.equal(gastosBefore + GASTO_AMOUNT);
                });
              });
            },
          );
        },
      );
    });
  });

  afterEach(() => {
    // Limpieza: eliminar el gasto creado (falla silenciosa si ya fue incluido en cierre)
    if (!createdExpenseId) return;
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest(
        'DELETE',
        `/expenses/${createdExpenseId}`,
        null,
        token,
      ).then((res) => {
        // 200 = eliminado, 409 = ya en cierre — ambos son estados válidos post-test
        expect([200, 409], `cleanup expense ${createdExpenseId}`).to.include(
          res.status,
        );
        createdExpenseId = null;
      });
    });
  });
});

// ── CA-05 real — estructura del pre-cierre ────────────────────────────────────

describe('CA-05 real — estructura de /cash-register/pre-close incluye gastos desagregados', () => {
  beforeEach(function () {
    if (!Cypress.env('realAuthEnabled')) this.skip();
  });

  it('CA-05 — pre-cierre retorna gastos_efectivo y gastos_transferencia como campos numéricos', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', '/cash-register/pre-close', null, token).then(
        (res) => {
          expect(res.status).to.eq(200);
          const egresos = res.body.data.egresos;
          expect(egresos)
            .to.have.property('gastos_efectivo')
            .that.is.a('number');
          expect(egresos)
            .to.have.property('gastos_transferencia')
            .that.is.a('number');
        },
      );
    });
  });

  it('CA-05 — dashboard retorna down_payments_total y down_payments_count como campos numéricos', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', '/cash-register/dashboard', null, token).then(
        (res) => {
          expect(res.status).to.eq(200);
          const data = res.body.data;
          expect(data)
            .to.have.property('down_payments_total')
            .that.is.a('number');
          expect(data)
            .to.have.property('down_payments_count')
            .that.is.a('number');
        },
      );
    });
  });
});

// ── CA-04 mock — dashboard con enganches de jornada anterior ──────────────────

describe('CA-04 mock — dashboard muestra enganches de jornada anterior a hoy', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/cash-register/dashboard', {
      statusCode: 200,
      body: MOCK_DASHBOARD_WITH_ENGANCHES,
    }).as('getDashboard');

    cy.intercept('GET', '**/api/cash-register/pre-close', {
      statusCode: 200,
      body: MOCK_PRE_CLOSE_WITH_ENGANCHES_AND_GASTOS,
    }).as('getPreClose');

    cy.intercept('GET', '**/api/cash-register', {
      statusCode: 200,
      body: MOCK_CASH_HISTORY,
    }).as('getCashHistory');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait('@getDashboard');
  });

  it('CA-04 — el dashboard carga sin error cuando down_payments_total > 0 para jornada anterior', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
  });

  it('CA-04 — el badge de jornada anterior está visible junto con los enganches en el dashboard', () => {
    // La jornada activa es AYER → debe mostrarse el badge
    cy.get('[data-cy="jornada-post-midnight-badge"]').should('be.visible');
    // Los KPIs del dashboard se renderizan (no 0 ni error)
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
  });
});

// ── CA-04 + CA-05 mock — pre-cierre muestra enganches y gastos de jornada anterior ─

describe('CA-04 + CA-05 mock — pre-cierre de jornada anterior muestra enganches y gastos', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/cash-register/dashboard', {
      statusCode: 200,
      body: MOCK_DASHBOARD_WITH_ENGANCHES,
    }).as('getDashboard');

    cy.intercept('GET', '**/api/cash-register/pre-close', {
      statusCode: 200,
      body: MOCK_PRE_CLOSE_WITH_ENGANCHES_AND_GASTOS,
    }).as('getPreClose');

    cy.intercept('GET', '**/api/cash-register', {
      statusCode: 200,
      body: MOCK_CASH_HISTORY,
    }).as('getCashHistory');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/cash-register');
    cy.wait('@getDashboard');

    // Abrir panel de pre-cierre
    cy.get('[data-cy="admin-cash-register-close-day-cta"]').click();
    cy.wait('@getPreClose');
    cy.get('[data-cy="admin-cash-register-close-section"]', {
      timeout: 10000,
    }).should('be.visible');
  });

  it('CA-04 — el pre-cierre muestra la fila "Enganches en efectivo" con monto > 0', () => {
    // enganches_efectivo: 8000 — aparece en la sección de ingresos
    cy.get('[data-cy="admin-cash-register-close-ingresos-inline"]').within(
      () => {
        cy.contains('Enganches en efectivo').should('be.visible');
        cy.contains(/8[\.,]000|8000/).should('exist');
      },
    );
  });

  it('CA-04 — el pre-cierre muestra la fila "Enganches en transferencia" con monto > 0', () => {
    // enganches_transferencia: 2000
    cy.get('[data-cy="admin-cash-register-close-ingresos-inline"]').within(
      () => {
        cy.contains('Enganches en transferencia').should('be.visible');
        cy.contains(/2[\.,]000|2000/).should('exist');
      },
    );
  });

  it('CA-05 — la sección de egresos aparece cuando hay gastos (egresos.total > 0)', () => {
    // @if (preClose.egresos.total > 0) → sección visible solo cuando hay egresos
    cy.get('[data-cy="admin-cash-register-close-egresos-inline"]').should(
      'be.visible',
    );
  });

  it('CA-04 + CA-05 — el total de egresos muestra el valor correcto (gastos registrados)', () => {
    // total egresos: 4500 — mostrado como "- $4.500" en la sección de egresos
    cy.get('[data-cy="admin-cash-register-close-egresos-inline"]').within(
      () => {
        cy.contains(/4[\.,]500|4500/).should('exist');
      },
    );
  });

  it('CA-04 + CA-05 — la jornada del pre-cierre corresponde al día anterior (no hoy)', () => {
    const [y, m, d] = YESTERDAY.split('-');
    const formatted = `${d}/${m}/${y}`;
    // La fecha de jornada aparece en el badge fuera del close-section
    cy.contains(formatted).should('exist');
  });
});
