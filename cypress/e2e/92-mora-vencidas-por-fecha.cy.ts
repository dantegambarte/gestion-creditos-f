/**
 * #88: el listado de mora pide las cuotas vencidas por fecha (`overdue=true`)
 * y muestra cuotas PENDING/PARTIAL vencidas aunque el status persistido no sea
 * OVERDUE. Además, chip y dropdown de estado no se superponen.
 * Specs stubbeados (sin backend real), desktop y mobile.
 */

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

/**
 * Arma una cuota vencida por fecha en formato API.
 * @param id - ID de la cuota
 * @param name - nombre del cliente
 * @param status - status persistido (puede no estar actualizado a OVERDUE)
 */
function pastDue(id: string, name: string, status: string): Record<string, unknown> {
  return {
    id,
    credit_id: `cr-${id}`,
    installment_number: 1,
    due_date: '2026-10-01',
    amount_due: 1000,
    amount_paid: status === 'PARTIAL' ? 300 : 0,
    penalty_amount: 0,
    status,
    created_at: '2026-09-01T00:00:00Z',
    credit_type: 'LOAN',
    customer_id: `c-${id}`,
    customer_name: name,
    customer_dni: '20000000',
    collector_id: null,
    collector_name: null,
  };
}

/** Devuelve el selector de filas visibles según el viewport. */
function rowsSelector(mobile: boolean): string {
  return mobile
    ? '[data-cy="delinquency-mobile-list"] [data-cy="delinquency-mobile-card"]'
    : '[data-cy="delinquency-table"] tbody tr:visible';
}

describe('#88 — mora: cuotas vencidas por fecha de vencimiento', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    const mobile = width < 768;

    context(name, () => {
      beforeEach(() => {
        cy.viewport(width, height);
        cy.intercept('GET', '**/api/cash-sessions/active', {
          ok: true,
          data: { id: 'sess-1', status: 'OPEN' },
        });
        cy.intercept('GET', '**/api/users*', { ok: true, data: [] });
        cy.intercept('GET', '**/api/installments?*', {
          ok: true,
          data: [pastDue('i1', 'Carla Pendiente', 'PENDING'), pastDue('i2', 'Dario Parcial', 'PARTIAL')],
        }).as('overdue');
        cy.loginAs('ADMIN', '/admin/delinquency');
      });

      it('pide overdue=true sin status y lista cuotas con status no actualizado', () => {
        cy.wait('@overdue').then(({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('overdue')).to.equal('true');
          expect(url.searchParams.has('status')).to.equal(false);
        });
        cy.get(rowsSelector(mobile))
          .should('have.length', 2)
          .and('contain.text', 'Carla Pendiente')
          .and('contain.text', 'Dario Parcial');
      });

      it('chip y dropdown de estado no se superponen', () => {
        cy.wait('@overdue');
        cy.get('[data-cy="delinquency-filter-estado"]').then(($dd) => {
          const dd = $dd[0].getBoundingClientRect();
          cy.get('[data-cy="delinquency-chip-EN_MORA"]').then(($chip) => {
            const chip = $chip[0].getBoundingClientRect();
            const overlap =
              chip.left < dd.right &&
              chip.right > dd.left &&
              chip.top < dd.bottom &&
              chip.bottom > dd.top;
            expect(overlap, 'chip y dropdown se superponen').to.equal(false);
          });
        });
      });
    });
  });
});
