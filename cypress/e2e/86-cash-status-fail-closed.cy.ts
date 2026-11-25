/**
 * P15 (#52): si falla la consulta de caja operativa, la UI falla cerrado
 * (informa y bloquea). Con caja abierta todo sigue igual. Specs stubbeados.
 */

const VIEWPORTS: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

/** Stubea el listado de aprobaciones vacío y la caja activa con la respuesta dada. */
function stubApprovals(activeSession: Parameters<typeof cy.intercept>[2]): void {
  cy.intercept('GET', '**/api/credits*', { ok: true, data: [] }).as('approvals');
  cy.intercept('GET', '**/api/users*', { ok: true, data: [] });
  cy.intercept('GET', '**/api/cash-sessions/active', activeSession).as('activeSession');
}

describe('Estado de caja — falla cerrado (P15)', () => {
  VIEWPORTS.forEach(({ name, width, height }) => {
    describe(name, () => {
      beforeEach(() => cy.viewport(width, height));

      it('si la consulta de caja falla, aprobaciones muestra el bloqueo', () => {
        stubApprovals({ statusCode: 500, body: { ok: false, message: 'boom' } });
        cy.loginAs('ADMIN', '/admin/approvals');
        cy.wait('@activeSession');
        cy.get('[data-cy="cash-status-unknown"]')
          .should('be.visible')
          .and('contain.text', 'No se pudo verificar el estado de la caja');
      });

      it('con caja abierta no muestra bloqueo de caja', () => {
        stubApprovals({ ok: true, data: { id: 'sess-1', status: 'OPEN' } });
        cy.loginAs('ADMIN', '/admin/approvals');
        cy.wait('@activeSession');
        cy.wait('@approvals');
        cy.get('[data-cy="cash-status-unknown"]').should('not.exist');
        cy.contains('La caja del día está CERRADA').should('not.exist');
      });
    });
  });
});
