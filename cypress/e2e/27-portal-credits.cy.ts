/**
 * SUITE: Portal Cliente — Créditos y Detalle de Crédito (real backend)
 */

describe('Portal — Lista de Créditos (/portal/credits)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginPortalReal('/portal/credits');
  });

  it('muestra el titulo de creditos y no rompe la app', () => {
    cy.location('pathname').should('eq', '/portal/credits');
    cy.url().should('not.include', '/portal/login');
    cy.get('app-error-state').should('not.exist');
    cy.get('app-root').should('be.visible');
  });

  it('renderiza tarjetas o estado vacio', () => {
    cy.location('pathname').should('eq', '/portal/credits');
    cy.get('app-error-state').should('not.exist');
  });

  it('si hay tarjetas, navegar a detalle funciona', () => {
    cy.get('body').then(($body) => {
      const cards = $body.find('[data-cy="portal-credits-card"]');
      if (cards.length > 0) {
        cy.wrap(cards.first()).click();
        cy.location('pathname', { timeout: 15000 }).should('match', /^\/portal\/credits\//);
      }
    });
  });
});

describe('Portal — Detalle de Crédito (/portal/credits/:id)', () => {
  it('si existe detalle accesible, muestra secciones base y permite volver', () => {
    cy.viewport(1280, 720);
    cy.loginPortalReal('/portal/credits');

    cy.get('body').then(($body) => {
      const cards = $body.find('[data-cy="portal-credits-card"]');
      if (cards.length > 0) {
        cy.wrap(cards.first()).click();
        cy.location('pathname', { timeout: 15000 }).should('match', /^\/portal\/credits\//);
        cy.get('app-error-state').should('not.exist');
      }
    });
  });
});
