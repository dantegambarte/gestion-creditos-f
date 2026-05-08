/**
 * SUITE: Admin — Detalle de Planilla de Cobro (/admin/collections/:id)
 *
 * Cubre:
 *  - Render del detalle con datos
 *  - Cabecera: fecha, cobrador, generado por, filtro usado
 *  - Lista de ítems con estados (PENDING, OVERDUE, PAID)
 *  - Tag "Cobro pendiente de aprobación" si hasPendingPayment
 *  - Botón Volver
 */

const ADMIN_SHEET_MOCK = {
  id: 'sheet-adm-001',
  collector_id: 'usr-003',
  collector_name: 'Juan Pedraza',
  sheet_date: '2026-04-28T00:00:00Z',
  filter_used: 'ALL',
  total_items: 3,
  generated_by_name: 'Carlos López',
  created_at: '2026-04-28T08:00:00Z',
  items: [
    {
      order_number: 1,
      planned_amount: 13000,
      installment_id: 'inst-adm-01',
      installment_number: 1,
      due_date: '2026-04-30T00:00:00Z',
      amount_due: 13000,
      amount_paid: 0,
      penalty_amount: 0,
      installment_status: 'PENDING',
      credit_id: 'cred-adm-01',
      credit_type: 'SALE',
      customer_name: 'Ana García',
      customer_phone: '3811234567',
      customer_address: 'Av. Principal 100',
    },
    {
      order_number: 2,
      planned_amount: 8500,
      installment_id: 'inst-adm-02',
      installment_number: 4,
      due_date: '2026-04-10T00:00:00Z',
      amount_due: 8500,
      amount_paid: 0,
      penalty_amount: 0,
      installment_status: 'OVERDUE',
      credit_id: 'cred-adm-02',
      credit_type: 'LOAN',
      customer_name: 'Pedro Gómez',
      customer_phone: '3819876543',
      customer_address: 'Calle Sur 50',
    },
    {
      order_number: 3,
      planned_amount: 10000,
      installment_id: 'inst-adm-03',
      installment_number: 2,
      due_date: '2026-04-15T00:00:00Z',
      amount_due: 10000,
      amount_paid: 10000,
      penalty_amount: 0,
      installment_status: 'PAID',
      credit_id: 'cred-adm-03',
      credit_type: 'SALE',
      customer_name: 'Laura Díaz',
      customer_phone: null,
      customer_address: null,
    },
  ],
};

describe('Admin — Detalle de Planilla de Cobro', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/collections\/sheet-adm-001$/, {
      statusCode: 200,
      body: { ok: true, data: ADMIN_SHEET_MOCK },
    }).as('adminSheetDetail');

    cy.loginAs('ADMIN', '/admin/collections/sheet-adm-001');
    cy.wait('@adminSheetDetail');
  });

  it('muestra la fecha de la planilla', () => {
    cy.contains(/\d{2}\/\d{2}\/2026/).should('exist');
  });

  it('muestra el nombre del cobrador', () => {
    cy.contains('Juan Pedraza').should('exist');
  });

  it('muestra quién generó la planilla', () => {
    cy.contains('Carlos López').should('exist');
  });

  it('muestra los 3 ítems de la planilla', () => {
    cy.contains('Ana García').should('exist');
    cy.contains('Pedro Gómez').should('exist');
    cy.contains('Laura Díaz').should('exist');
  });

  it('ítem en mora tiene fondo rojo', () => {
    cy.get('.border-red-200').should('exist');
  });

  it('ítem pagado tiene fondo verde', () => {
    cy.get('.border-green-200').should('exist');
  });

  it('muestra tags de estado', () => {
    cy.get('p-tag').should('have.length.gte', 2);
  });

  it('botón Volver navega al listado de planillas', () => {
    cy.contains('button', 'Volver').click();
    cy.url().should('include', '/admin/collections');
    cy.url().should('not.include', '/sheet-adm-001');
  });
});

describe('Admin — Detalle de Planilla — Estado carga/error', () => {
  it('muestra loading state mientras carga', () => {
    cy.intercept('GET', /\/api\/collections\/sheet-slow-adm$/, (req) => {
      req.reply({ delay: 3000, statusCode: 200, body: { ok: true, data: null } });
    }).as('slowSheet');
    cy.loginAs('ADMIN', '/admin/collections/sheet-slow-adm');
    cy.get('app-loading-state').should('exist');
  });

  it('muestra error state si no existe la planilla', () => {
    cy.intercept('GET', /\/api\/collections\/sheet-404-adm$/, {
      statusCode: 404,
      body: { ok: false, message: 'Not found' },
    }).as('notFound');
    cy.loginAs('ADMIN', '/admin/collections/sheet-404-adm');
    cy.wait('@notFound');
    cy.get('app-error-state').should('exist');
  });
});
