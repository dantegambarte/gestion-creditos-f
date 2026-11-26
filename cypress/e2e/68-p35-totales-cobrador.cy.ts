/**
 * SUITE: P35 — Totales de gastos y filtro de cobrador por id (#63)
 *
 * - Gastos: el "Total del período" suma todas las páginas, no sólo las 20 filas visibles.
 * - Cobros: el filtro de cobrador se envía al backend como collector_id, así dos
 *   cobradores homónimos no se mezclan.
 * Stubbed con cy.intercept; corre en desktop y mobile (375x667).
 */

const VIEWPORTS: { name: string; w: number; h: number }[] = [
  { name: 'desktop', w: 1280, h: 720 },
  { name: 'mobile', w: 375, h: 667 },
];

const expenseRow = (i: number) => ({
  id: `exp-${i}`,
  amount: 1000,
  description: `Gasto ${i}`,
  payment_method: 'CASH',
  transfer_reference: null,
  source: 'DAILY',
  expense_date: '2026-11-10',
  created_at: '2026-11-10T12:00:00Z',
  created_by_name: 'Admin',
  category_id: 'cat-1',
  category_name: 'Varios',
});

const payment = (id: string, collectorName: string) => ({
  id,
  installment_id: `inst-${id}`,
  installment_number: 1,
  credit_id: 'cred-1',
  credit_type: 'LOAN',
  amount_received: 5000,
  amount_cash: 5000,
  amount_transfer: 0,
  payment_method: 'CASH',
  transfer_reference: null,
  status: 'APPROVED',
  rejection_reason: null,
  notes: null,
  created_at: '2026-11-10T10:00:00Z',
  approved_at: '2026-11-10T10:05:00Z',
  approved_by: 'admin-001',
  amount_due: 5000,
  due_date: '2026-11-10',
  customer_name: `Cliente ${id}`,
  customer_dni: '30111222',
  collector_name: collectorName,
  is_reversal: false,
  admin_direct: false,
  parent_payment_id: null,
  reversal_payment_id: null,
  concepto: 'Cobro de cuota',
});

const COLLECTORS = {
  ok: true,
  data: ['col-a', 'col-b'].map((id, i) => ({
    id,
    full_name: 'Juan Pérez',
    email: `juan${i}@test.com`,
    dni: `1111111${i}`,
    role: 'COLLECTOR',
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00Z',
  })),
};

VIEWPORTS.forEach(({ name, w, h }) => {
  describe(`P35 — Gastos: total del período sobre todo el dataset (${name})`, () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/expense-categories*', { statusCode: 200, body: { ok: true, data: [] } });
      cy.intercept('GET', '**/api/cash-register/**', { statusCode: 200, body: { ok: true, data: { isClosed: false, isOpen: true } } });
      // 25 gastos de $1.000: página 1 (limit 20) trae 20, el resto viene en otras páginas.
      cy.intercept('GET', '**/api/expenses*', (req) => {
        const limit = Number(req.query['limit']);
        const page = Number(req.query['page']);
        const all = Array.from({ length: 25 }, (_, i) => expenseRow(i + 1));
        const rows = all.slice((page - 1) * limit, page * limit);
        req.reply({ statusCode: 200, body: { ok: true, data: { rows, total: 25 } } });
      }).as('getExpenses');
      cy.viewport(w, h);
      cy.loginAs('ADMIN', '/admin/expenses');
    });

    it('el total suma los 25 gastos ($25.000) y no sólo los 20 visibles', () => {
      cy.wait('@getExpenses').its('request.query.limit').should('eq', '20');
      cy.wait('@getExpenses').its('request.query.limit').should('eq', '100');
      cy.contains('Total del período').parent().should('contain.text', '25.000');
    });
  });

  describe(`P35 — Cobros: filtro de cobrador por id (${name})`, () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/users*', { statusCode: 200, body: COLLECTORS });
      cy.intercept('GET', '**/api/cash-register/**', { statusCode: 200, body: { ok: true, data: { isClosed: false, isOpen: true } } });
      cy.intercept('GET', '**/api/payments*', (req) => {
        const byCollector: Record<string, unknown[]> = {
          'col-a': [payment('p-a', 'Juan Pérez')],
          'col-b': [payment('p-b', 'Juan Pérez')],
        };
        const id = req.query['collector_id'] as string | undefined;
        req.reply({
          statusCode: 200,
          body: { ok: true, data: id ? byCollector[id] : [...byCollector['col-a'], ...byCollector['col-b']] },
        });
      }).as('getPayments');
      cy.viewport(w, h);
      cy.loginAs('ADMIN', '/admin/payments');
      cy.wait('@getPayments');
    });

    it('elegir uno de dos homónimos pide collector_id y muestra sólo sus cobros', () => {
      cy.get('[data-cy="admin-payments-filter-collector"] p-dropdown').click();
      cy.get('.p-dropdown-item').should('have.length', 2).first().click();
      cy.wait('@getPayments').its('request.query.collector_id').should('eq', 'col-a');
      cy.contains('Cliente p-a').should('exist');
      cy.contains('Cliente p-b').should('not.exist');
    });
  });
});
