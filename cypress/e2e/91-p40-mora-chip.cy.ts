/**
 * P40 (#88): el chip de estado y el dropdown de estado de la tabla de mora
 * comparten un único filtro, así nunca muestran filtros distintos ni se pisan.
 * Specs stubbeados (sin backend real), desktop y mobile.
 */

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

/**
 * Arma una cuota vencida en formato API.
 * @param id - ID de la cuota
 * @param name - nombre del cliente
 * @param penalty - mora ya aplicada (0 = sin aplicar)
 */
function overdue(id: string, name: string, penalty: number): Record<string, unknown> {
  return {
    id,
    credit_id: `cr-${id}`,
    installment_number: 1,
    due_date: '2026-10-01',
    amount_due: 1000,
    amount_paid: 0,
    penalty_amount: penalty,
    status: 'OVERDUE',
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

describe('P40 — mora: chip y dropdown de estado comparten filtro', () => {
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
          data: [overdue('i1', 'Ana Mora', 500), overdue('i2', 'Beto Libre', 0)],
        }).as('overdue');
        cy.loginAs('ADMIN', '/admin/delinquency');
        cy.wait('@overdue');
      });

      it('el chip actualiza el dropdown y el dropdown actualiza el chip', () => {
        cy.get(rowsSelector(mobile)).should('have.length', 2);

        cy.get('[data-cy="delinquency-chip-EN_MORA"]').click();
        cy.get('[data-cy="delinquency-chip-EN_MORA"]').should('have.attr', 'aria-pressed', 'true');
        cy.get('[data-cy="delinquency-filter-estado"] .p-dropdown-label').should(
          'contain.text',
          'En Mora',
        );
        cy.get(rowsSelector(mobile)).should('have.length', 1).and('contain.text', 'Ana Mora');

        cy.get('[data-cy="delinquency-filter-estado"] .p-dropdown').click();
        cy.get('.p-dropdown-item').contains('Sin Aplicar').click();
        cy.get('[data-cy="delinquency-chip-EN_MORA"]').should('have.attr', 'aria-pressed', 'false');
        cy.get('[data-cy="delinquency-chip-SIN_APLICAR"]').should(
          'have.attr',
          'aria-pressed',
          'true',
        );
        cy.get(rowsSelector(mobile)).should('have.length', 1).and('contain.text', 'Beto Libre');

        cy.get('[data-cy="delinquency-chip-SIN_APLICAR"]').click();
        cy.get(rowsSelector(mobile)).should('have.length', 2);
      });

      it('los chips no se superponen con el dropdown de estado', () => {
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
