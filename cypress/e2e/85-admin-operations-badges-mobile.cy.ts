const creditsResponse = {
  ok: true,
  data: [
    {
      id: 'credit-admin-badge-mobile-1',
      type: 'LOAN',
      payment_condition: 'INSTALLMENTS',
      total_amount: 375000,
      installments_count: 1,
      payment_frequency: 'MONTHLY',
      interest_rate: null,
      effective_rate: null,
      total_to_return: 375000,
      status: 'ACTIVE',
      created_at: '2026-07-29T00:00:00.000Z',
      approved_at: '2026-07-29T00:00:00.000Z',
      customer_id: 'cust-admin-badge-mobile-1',
      customer_name: 'Novio Daniel Agui',
      customer_dni: '99000603',
      created_by_id: 'seller-admin-badge-mobile-1',
      created_by_name: 'Bichy',
      collector_name: 'Bichy',
    },
  ],
};

/**
 * Verifica que un badge compacto centre su texto con flex y sin line-height heredado.
 * @param selector Selector CSS del badge visible en la card mobile.
 */
const expectCompactBadgeAlignment = (selector: string): void => {
  cy.get(selector)
    .first()
    .should('be.visible')
    .then(($badge) => {
      const styles = getComputedStyle($badge[0]);
      const lineHeight = parseFloat(styles.lineHeight);
      const fontSize = parseFloat(styles.fontSize);

      expect(styles.display).to.eq('inline-flex');
      expect(styles.alignItems).to.eq('center');
      expect(styles.justifyContent).to.eq('center');
      expect(lineHeight).to.be.lte(fontSize + 1);
    });
};

describe('Admin Operaciones — Badges Mobile', () => {
  beforeEach(() => {
    cy.viewport(375, 667);
    cy.intercept('GET', '**/api/credits*', creditsResponse).as('creditsList');
  });

  it('centra verticalmente los badges de tipo y estado en la card mobile', () => {
    cy.loginAs('ADMIN', '/admin/operations');
    cy.wait('@creditsList');

    cy.get('[data-cy="operations-mobile-card"]')
      .should('have.length', 1)
      .and('be.visible');

    expectCompactBadgeAlignment('.operations-type-badge');
    expectCompactBadgeAlignment('.ff-badge--activo');
  });
});
