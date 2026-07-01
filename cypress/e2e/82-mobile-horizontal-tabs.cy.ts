type TabCheck = {
  nav: string;
  active: string;
  centered?: boolean;
};

/**
 * Verifica que el tab activo quede completamente visible dentro del viewport.
 * @param {TabCheck} check - Selectores del contenedor y del tab activo.
 */
function expectActiveTabVisible(check: TabCheck): void {
  cy.get(check.active).should(($active) => {
    const nav = Cypress.$(check.nav)[0];
    expect(nav, `nav ${check.nav}`).to.exist;

    const navRect = nav.getBoundingClientRect();
      const activeRect = $active[0].getBoundingClientRect();

    expect(activeRect.left).to.be.gte(navRect.left - 1);
    expect(activeRect.right).to.be.lte(navRect.right + 1);

    if (!check.centered) return;

    const navCenter = navRect.left + navRect.width / 2;
    const activeCenter = activeRect.left + activeRect.width / 2;
    expect(Math.abs(activeCenter - navCenter)).to.be.lte(navRect.width * 0.2);
  });
}

describe('Mobile horizontal tabs', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  it('Reportes — centra y muestra completo el tab seleccionado', () => {
    cy.loginAs('ADMIN', '/admin/reports');

    cy.contains('[data-cy="admin-reports-tabs"] .ff-tab', 'Cartera').click();

    expectActiveTabVisible({
      nav: '[data-cy="admin-reports-tabs"]',
      active: '[data-cy="admin-reports-tabs"] .ff-tab--active',
      centered: true,
    });
  });

  it('Configuración — mantiene visible el tab activo al entrar por ruta profunda', () => {
    cy.loginAs('ADMIN', '/admin/config/notifications');

    expectActiveTabVisible({
      nav: '[data-cy="admin-config-tabs"]',
      active: '[data-cy="admin-config-tabs"] .ff-tab--active',
    });
  });

  it('Liquidaciones — centra y muestra completo el tab seleccionado', () => {
    cy.loginAs('ADMIN', '/admin/commissions');

    cy.get('.commissions-mobile-tabs .ff-tab').should('have.length', 3);
    cy.contains('.commissions-mobile-tabs .ff-tab', 'Sueldo fijo')
      .should('be.visible')
      .click({ force: true });

    expectActiveTabVisible({
      nav: '.commissions-mobile-tabs',
      active: '.commissions-mobile-tabs .ff-tab--active',
      centered: true,
    });
  });
});
