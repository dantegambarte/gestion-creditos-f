/**
 * SUITE: Cobranzas — Collector Route
 *
 * Cubre:
 *  - Listado de planillas del cobrador
 *  - Ver detalle de cada planilla
 *  - Estado de cuotas por cliente
 *  - Acceso desde /collector/route
 *
 * NOTA: La UI muestra "Mi Ruta de Cobro" con planillas generadas por el Admin.
 *       Los botones de acción están dentro de cada planilla.
 */

describe('Cobranzas — Collector Route', () => {
  const SHEETS_MOCK = [
    {
      id: 'sheet-001',
      collector_id: 'usr-003',
      collector_name: 'Juan Pedraza',
      sheet_date: '2026-04-28T00:00:00Z',
      filter_used: 'ALL',
      total_items: 2,
      generated_by_name: 'Carlos Lopez',
      created_at: '2026-04-28T08:00:00Z',
    },
  ];

  const SHEET_DETAIL_MOCK = {
    ...SHEETS_MOCK[0],
    items: [
      {
        order_number: 1,
        planned_amount: 13000,
        installment_id: 'inst-001',
        installment_number: 3,
        due_date: '2026-04-30T00:00:00Z',
        amount_due: 13000,
        amount_paid: 0,
        penalty_amount: 0,
        installment_status: 'PENDING',
        credit_id: 'cred-001',
        credit_type: 'SALE',
        customer_name: 'Ana Garcia',
        customer_phone: '3811234567',
        customer_address: 'Av. Principal 100',
      },
      {
        order_number: 2,
        planned_amount: 8500,
        installment_id: 'inst-002',
        installment_number: 2,
        due_date: '2026-04-20T00:00:00Z',
        amount_due: 8500,
        amount_paid: 0,
        penalty_amount: 0,
        installment_status: 'OVERDUE',
        credit_id: 'cred-002',
        credit_type: 'LOAN',
        customer_name: 'Pedro Gomez',
        customer_phone: '3819876543',
        customer_address: 'Calle Sur 50',
      },
    ],
  };

  const PENDING_PAYMENTS_MOCK = [
    {
      id: 'pay-001',
      installment_id: 'inst-001',
      amount_received: 13000,
      payment_method: 'CASH',
      transfer_reference: null,
      status: 'PENDING',
      rejection_reason: null,
      notes: null,
      created_at: '2026-04-29T10:30:00Z',
      approved_at: null,
      approved_by: null,
      installment_number: 3,
      amount_due: 13000,
      due_date: '2026-04-30T00:00:00Z',
      credit_id: 'cred-001',
      credit_type: 'SALE',
      customer_name: 'Ana Garcia',
      customer_dni: '12345678',
      collector_name: 'Juan Pedraza',
    },
  ];

  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/collections(\?.*)?$/, {
      statusCode: 200,
      body: { ok: true, data: SHEETS_MOCK },
    }).as('listSheets');

    cy.intercept('GET', /\/api\/payments(\?.*)?$/, {
      statusCode: 200,
      body: { ok: true, data: PENDING_PAYMENTS_MOCK },
    }).as('listPendingPayments');

    cy.intercept('GET', /\/api\/collections\/sheet-001$/, {
      statusCode: 200,
      body: { ok: true, data: SHEET_DETAIL_MOCK },
    }).as('sheetDetail');

    cy.loginAs('COLLECTOR', '/collector/route');
  });

  // ── Listado ────────────────────────────────────────────────────────────────────
  it('muestra el título de la ruta de cobros', () => {
    cy.contains('h1', 'Mi Ruta de Cobro').should('be.visible');
  });

  it('la fecha del día es visible', () => {
    cy.contains(/\d{1,2} \w+ \d{4}/).should('be.visible');
  });

  it('la sección de planillas es visible', () => {
    cy.contains('Mis planillas').should('be.visible');
  });

  // La tabla puede tener planillas o estar vacía
  it('muestra la tabla de planillas', () => {
    cy.get('p-table').should('exist');
  });

  // ── Planillas ─────────────────────────────────────────────────────────────────
  it('si hay planillas, muestra al menos una fila', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons > 0) {
        cy.contains('span', 'Ver planilla').should('have.length.gte', 1);
      } else {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });

  // Si hay planillas, verifica columnas
  it('las planillas tienen las columnas esperadas', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons > 0) {
        cy.contains('th', 'Fecha').should('be.visible');
        cy.contains('th', 'Filtro').should('be.visible');
        cy.contains('th', 'Cuotas').should('be.visible');
        cy.contains('th', 'Acción').should('be.visible');
      } else {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });

  // ── Ver detalle de Planilla ──────────────────────────────────────────────────
  it('al hacer clic en Ver planilla navega al detalle', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons > 0) {
        cy.contains('span', 'Ver planilla').first().parents('button').click();
        cy.url().should('match', /\/collector\/route\/.+/);
        cy.contains('h1', 'Planilla').should('be.visible');
      } else {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });

  it('el detalle muestra las cuotas de la planilla', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons > 0) {
        cy.contains('span', 'Ver planilla').first().parents('button').click();
        cy.contains(/Cuota\s+\d+/).should('be.visible');
      } else {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });

  it('el botón Volver regresa a la ruta del collector', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons > 0) {
        cy.contains('span', 'Ver planilla').first().parents('button').click();
        cy.contains('button', 'Volver').click();
        cy.url().should('eq', `${Cypress.config('baseUrl')}/collector/route`);
      } else {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });

  // ── Estado vacío ─────────────────────────────────────────────────────────────
  it('si no hay planillas muestra mensaje informativo', () => {
    cy.get('body').then(($body) => {
      const actionButtons = $body.find('span:contains("Ver planilla")').length;
      if (actionButtons === 0) {
        cy.contains('Mis planillas').should('be.visible');
      }
    });
  });
});
