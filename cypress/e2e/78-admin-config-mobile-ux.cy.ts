const holidaysResponse = {
  ok: true,
  data: [
    {
      id: 'holiday-mobile-1',
      date: '2026-12-25',
      name: 'Navidad',
      type: 'NATIONAL',
      affects_due_dates: true,
      active: true,
      repeats_annually: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const interestRatesResponse = {
  ok: true,
  data: [
    {
      id: 'rate-mobile-1',
      payment_frequency: 'MONTHLY',
      installments_count: 6,
      min_amount: 10000,
      max_amount: 100000,
      rate: 0.08,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

const productRatesResponse = {
  ok: true,
  data: [
    {
      id: 'prate-mobile-1',
      product_id: 'prod-mobile-1',
      product_name: 'Moto 110cc',
      payment_frequency: 'MONTHLY',
      installments_count: 12,
      rate: 0.1,
      active: true,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('Admin Config — Remaining Mobile UX (Feriados, Usuarios, Tasas)', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  // P1 #4 — Feriados sin Card-List, toolbar (input + 2 botones) sin wrap.
  it('Feriados Mobile — cards en vez de tabla, toolbar apilado y modal de edición acotado', () => {
    cy.intercept('GET', '**/api/holidays*', holidaysResponse).as(
      'holidaysList',
    );

    cy.loginAs('ADMIN', '/admin/config/holidays');
    cy.wait('@holidaysList');

    cy.get('[data-cy="holidays-table"]').should('not.be.visible');
    cy.get('[data-cy="holidays-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Navidad');

    cy.window().then((win) => {
      cy.get('[data-cy="holidays-duplicate-source-year"]').then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        expect(rect.right).to.be.lte(win.innerWidth);
      });
    });

    cy.get('[data-cy="holidays-mobile-edit-action"]').first().click();
    cy.window().then((win) => {
      cy.get('.p-dialog')
        .should('be.visible')
        .then(($dialog) => {
          const rect = $dialog[0].getBoundingClientRect();
          expect(rect.width).to.be.lte(win.innerWidth);
        });
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  it('Feriados Mobile — preview de duplicación usa cards internas sin tablas visibles', () => {
    cy.intercept('GET', '**/api/holidays*', holidaysResponse).as(
      'holidaysList',
    );
    cy.intercept('POST', '**/api/holidays/duplicate-year/preview', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          sourceYear: 2026,
          targetYear: 2027,
          eligibleCount: 2,
          toCreateCount: 1,
          skippedCount: 1,
          conflictsCount: 0,
          invalidDatesCount: 0,
          nonRecurringCount: 1,
          toCreate: [
            {
              sourceDate: '2026-05-01',
              targetDate: '2027-05-01',
              type: 'NATIONAL',
              name: 'Día del trabajador',
            },
          ],
          skipped: [
            {
              sourceDate: '2026-06-15',
              targetDate: null,
              type: 'EXTRAORDINARY',
              name: 'Puente local',
              reason: 'not_recurring_annual',
            },
          ],
        },
      },
    }).as('previewDuplicate');

    cy.loginAs('ADMIN', '/admin/config/holidays');
    cy.wait('@holidaysList');

    cy.get('[data-cy="holidays-duplicate-source-year"]').clear().type('2026');
    cy.get('[data-cy="holidays-preview-duplicate-btn"]').click();
    cy.wait('@previewDuplicate');

    cy.get('.p-dialog:visible').within(() => {
      cy.get('table:visible').should('have.length', 0);
      cy.get('[data-cy="holiday-duplicate-create-mobile-card"]')
        .should('have.length', 1)
        .and('contain', 'Día del trabajador');
      cy.get('[data-cy="holiday-duplicate-skipped-mobile-card"]')
        .should('have.length', 1)
        .and('contain', 'Puente local');
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  // P1 #4 — Config > Usuarios: tabla legacy + panel "Nueva tasa" sin maxWidth.
  it('Config Usuarios Mobile — cards en vez de tabla, toolbar apilado y modal acotado', () => {
    cy.loginAs('ADMIN', '/admin/config/users');

    cy.get('[data-cy="admin-config-users-table"]').should('not.be.visible');
    cy.get('[data-cy="admin-config-users-mobile-card"]').should(
      'have.length.at.least',
      1,
    );

    cy.contains('button', '+ Nuevo Usuario').click();
    cy.window().then((win) => {
      cy.get('.p-dialog')
        .should('be.visible')
        .then(($dialog) => {
          const rect = $dialog[0].getBoundingClientRect();
          expect(rect.width).to.be.lte(win.innerWidth);
        });
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  // P1 #4 — Tasas de interés: tabla + panel lateral fijo de 320px sin wrap.
  it('Tasas Mobile — cards agrupadas y panel "Nueva tasa" apila debajo sin achicar la tabla', () => {
    cy.intercept('GET', '**/api/interest-rates*', interestRatesResponse).as(
      'interestRates',
    );

    cy.loginAs('ADMIN', '/admin/config/rates');
    cy.wait('@interestRates');

    cy.get('[data-cy="interest-rates-table"]').should('not.be.visible');
    cy.get('[data-cy="interest-rates-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('6 cuotas');

    cy.contains('button', '+ Nueva Tasa').click();
    cy.contains('h3', 'Nueva tasa').then(($panel) => {
      const rect = $panel[0].getBoundingClientRect();
      expect(rect.left).to.be.gte(0);
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  // P1 #4 — Tasas por producto: panel "absolute right-0 w-[380px]" se salía del viewport.
  it('Tasas por producto Mobile — cards y panel flotante deja de quedar fuera del viewport', () => {
    cy.intercept('GET', '**/api/product-rates*', productRatesResponse).as(
      'productRates',
    );
    cy.intercept('GET', '**/api/products*', { ok: true, data: [] }).as(
      'productsList',
    );

    cy.loginAs('ADMIN', '/admin/config/product-rates');
    cy.wait('@productRates');

    cy.get('[data-cy="product-rates-table"]').should('not.be.visible');
    cy.get('[data-cy="product-rates-mobile-list"]').should(
      'contain',
      'Moto 110cc',
    );
    cy.get('[data-cy="product-rates-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('12 cuotas');

    cy.contains('button', '+ Nueva tasa por producto').click();
    cy.window().then((win) => {
      cy.contains('h3', 'Nueva tasa por producto').then(($panel) => {
        const rect = $panel[0].getBoundingClientRect();
        expect(rect.right).to.be.lte(win.innerWidth);
      });
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });
});
