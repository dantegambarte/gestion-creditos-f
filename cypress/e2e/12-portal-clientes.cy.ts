/**
 * SUITE: Portal Cliente — Dashboard y Créditos (real backend)
 */

describe('Portal Cliente — Dashboard y Créditos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  it('muestra dashboard portal sin error de app', () => {
    cy.loginPortalReal('/portal/dashboard');

    cy.location('pathname').should('eq', '/portal/dashboard');
    cy.url().should('not.include', '/portal/login');
    cy.get('app-error-state').should('not.exist');
    cy.get('app-root').should('be.visible');
  });

  it('en lista de creditos, abre detalle si existen tarjetas', () => {
    cy.loginPortalReal('/portal/credits');

    cy.location('pathname').should('eq', '/portal/credits');
    cy.url().should('not.include', '/portal/login');
    cy.get('app-error-state').should('not.exist');
    cy.get('body').then(($body) => {
      const cards = $body.find('[data-cy="portal-credits-card"]');
      if (cards.length > 0) {
        cy.wrap(cards.first()).click();
        cy.location('pathname', { timeout: 15000 }).should('match', /^\/portal\/credits\//);
      }
    });
  });

  it('muestra pagina de creditos sin romper contrato visual basico', () => {
    cy.loginPortalReal('/portal/credits');

    cy.location('pathname').should('eq', '/portal/credits');
    cy.url().should('not.include', '/portal/login');
    cy.get('app-error-state').should('not.exist');
    cy.get('app-root').should('be.visible');
  });
});
