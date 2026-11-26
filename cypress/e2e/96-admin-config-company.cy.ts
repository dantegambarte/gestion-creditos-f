const settings = {
  company: {
    system_name: 'Productcred',
    contact_email: 'admin@example.test',
    phone: '381 0000000',
    address: 'Calle 1',
  },
  rates: {
    sale_rate_monthly: 0.02,
    loan_rate_monthly: 0.025,
    mora_rate_daily: 0.001,
    seller_commission_rate: 0.05,
    grace_period_days: 3,
  },
};

const viewports: Array<[string, () => void]> = [
  ['Desktop', () => cy.viewport(1280, 800)],
  ['Mobile', () => cy.viewport(375, 667)],
];

viewports.forEach(([label, setViewport]) => {
  describe(`Admin Config — Empresa (${label})`, () => {
    beforeEach(() => {
      setViewport();
      cy.intercept('GET', '**/api/company', { ok: true, data: settings }).as('getCompany');
    });

    it('carga los datos reales y guarda contra PUT /company y PUT /company/rates', () => {
      cy.intercept('PUT', '**/api/company', { ok: true, data: settings }).as('putCompany');
      cy.intercept('PUT', '**/api/company/rates', { ok: true, data: settings }).as('putRates');

      cy.loginAs('ADMIN', '/admin/config/company');
      cy.wait('@getCompany');
      cy.get('[data-cy="company-config-name"]').should('have.value', 'Productcred');

      cy.get('[data-cy="company-config-name"]').clear().type('Nuevo nombre');
      cy.get('[data-cy="company-config-save"] button').click();

      cy.wait('@putCompany').its('request.body.system_name').should('eq', 'Nuevo nombre');
      cy.wait('@putRates')
        .its('request.body')
        .should('deep.include', { seller_commission_rate: 0.05, grace_period_days: 3 });
      cy.get('.p-toast-message').should('be.visible').and('contain', 'Cambios guardados');

      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });

    it('si el backend rechaza el guardado muestra error, no éxito', () => {
      cy.intercept('PUT', '**/api/company', {
        statusCode: 400,
        body: { ok: false, message: 'El email de contacto no es válido.' },
      }).as('putCompany');

      cy.loginAs('ADMIN', '/admin/config/company');
      cy.wait('@getCompany');
      cy.get('[data-cy="company-config-save"] button').click();
      cy.wait('@putCompany');
      cy.get('.p-toast-message').should('be.visible').and('contain', 'No se guardaron los cambios');
      cy.contains('Cambios guardados').should('not.exist');
    });
  });
});
