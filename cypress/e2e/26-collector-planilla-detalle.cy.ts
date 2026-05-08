/**
 * SUITE: Collector — Detalle de Planilla de Cobro (/collector/route/:sheetId)
 *
 * Cubre:
 *  - Render del detalle con datos de planilla
 *  - Título con fecha de planilla
 *  - Nombre del cobrador y generado por
 *  - Listado de ítems (cuotas)
 *  - Botón Volver
 *  - Estado de carga / error
 */

const SHEET_MOCK = {
  id: 'sheet-001',
  collector_id: 'usr-003',
  collector_name: 'Juan Pedraza',
  sheet_date: '2026-04-28T00:00:00Z',
  filter_used: 'ALL',
  total_items: 2,
  generated_by_name: 'Carlos López',
  created_at: '2026-04-28T08:00:00Z',
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
      customer_name: 'Ana García',
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
      customer_name: 'Pedro Gómez',
      customer_phone: '3819876543',
      customer_address: 'Calle Sur 50',
    },
  ],
};

function stubSheet() {
  cy.intercept('GET', /\/api\/collections\/sheet-001$/, {
    statusCode: 200,
    body: { ok: true, data: SHEET_MOCK },
  }).as('sheetDetail');
}

describe('Collector — Detalle de Planilla', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubSheet();
    cy.loginAs('COLLECTOR', '/collector/route/sheet-001');
    cy.wait('@sheetDetail');
  });

  it('muestra el título con la fecha de la planilla', () => {
    cy.contains('Planilla').should('be.visible');
    cy.contains(/\d{2}\/\d{2}\/2026/).should('exist');
  });

  it('muestra el nombre del cobrador', () => {
    cy.contains('Juan Pedraza').should('exist');
  });

  it('muestra quién generó la planilla', () => {
    cy.contains('Carlos López').should('exist');
  });

  it('renderiza los ítems de la planilla', () => {
    cy.contains('Ana García').should('exist');
    cy.contains('Pedro Gómez').should('exist');
  });

  it('los ítems en mora tienen fondo rojo', () => {
    cy.get('.border-red-200').should('exist');
  });

  it('los ítems pendientes no tienen fondo rojo', () => {
    cy.get('.border-green-200').should('not.exist');
  });

  it('muestra el tag de estado de cada ítem', () => {
    cy.get('p-tag').should('have.length.gte', 1);
  });

  it('muestra el botón Volver', () => {
    cy.contains('button', 'Volver').should('exist');
  });

  it('Volver navega a la ruta del collector', () => {
    cy.contains('button', 'Volver').click();
    cy.url().should('include', '/collector/route');
    cy.url().should('not.include', '/sheet-001');
  });
});

describe('Collector — Detalle de Planilla — Estado carga/error', () => {
  it('muestra loading state mientras carga', () => {
    cy.intercept('GET', /\/api\/collections\/sheet-slow$/, (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: { ok: true, data: null } });
    }).as('slowSheet');
    cy.loginAs('COLLECTOR', '/collector/route/sheet-slow');
    cy.get('app-loading-state').should('exist');
  });

  it('muestra error state si falla el endpoint', () => {
    cy.intercept('GET', /\/api\/collections\/sheet-404$/, {
      statusCode: 404,
      body: { ok: false, message: 'Not found' },
    }).as('notFound');
    cy.loginAs('COLLECTOR', '/collector/route/sheet-404');
    cy.wait('@notFound');
    cy.get('app-error-state').should('exist');
  });
});
