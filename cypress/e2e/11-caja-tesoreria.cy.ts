/**
 * SUITE: Admin — Caja y Tesorería (real backend)
 */

describe('Admin — Caja y Tesorería', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.loginReal('ADMIN', '/admin/cash-register');
  });

  it('muestra la pantalla de caja sin estado de error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/cash-register');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');
  });

  it('renderiza secciones base de kpis e historial', () => {
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-history-title"]').should('be.visible');
  });

  it('si existe cta de cierre, despliega panel inline y permite cerrarlo', () => {
    cy.get('body').then(($body) => {
      const closeCta = $body.find('[data-cy="admin-cash-register-close-day-cta"]');
      if (closeCta.length > 0) {
        cy.wrap(closeCta.first()).click();
        cy.get('[data-cy="admin-cash-register-close-section"]', { timeout: 12000 }).should('be.visible');
        cy.get('[data-cy="admin-cash-register-close-ingresos-inline"]').should('be.visible');

        cy.get('[data-cy="admin-cash-register-history-section"]')
          .invoke('attr', 'class')
          .should('include', 'xl:col-span-8');

        cy.get('[data-cy="admin-cash-register-close-section"] .pi-times').first().click();

        cy.get('[data-cy="admin-cash-register-close-section"]').should('not.exist');
        cy.get('[data-cy="admin-cash-register-history-section"]')
          .invoke('attr', 'class')
          .should('include', 'xl:col-span-12');
      }
    });
  });
});
