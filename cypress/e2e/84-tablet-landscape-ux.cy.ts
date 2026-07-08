const creditsListResponse = {
  ok: true,
  data: [
    {
      id: 'credit-tablet-1',
      type: 'LOAN',
      payment_condition: 'INSTALLMENTS',
      total_amount: 180000,
      installments_count: 6,
      payment_frequency: 'MONTHLY',
      interest_rate: 0.08,
      effective_rate: 0.08,
      total_to_return: 194400,
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00.000Z',
      approved_at: '2026-01-02T00:00:00.000Z',
      customer_id: 'cust-tablet-1',
      customer_name: 'Cliente Tablet Landscape',
      customer_dni: '40111222',
      created_by_id: 'seller-tablet-1',
      created_by_name: 'Vendedor Tablet',
      collector_name: 'Cobrador Tablet',
    },
  ],
};

const customersListResponse = {
  ok: true,
  data: [
    {
      id: 'cust-tablet-1',
      full_name: 'Cliente Tablet Landscape',
      dni: '40111222',
      address: 'Calle Falsa 123',
      phone: '11-5000-9999',
      email: null,
      status: 'ACTIVE',
      portal_enabled: false,
      created_at: '2026-01-01T00:00:00.000Z',
      collector_id: 'collector-1',
      collector_name: 'Cobrador Tablet',
      active_credits: 1,
      delinquency: false,
      payment_capacity: null,
    },
  ],
};

// P4 — Zona gris 1024-1279px (Nest Hub / Nest Hub Max): las Data Tables se
// mantienen (no se fuerza un grid de cards), pero las columnas secundarias
// colapsan vía `hidden xl:table-cell` para evitar scroll horizontal.
describe('Zona gris tablet landscape — Data Tables con columnas colapsables', () => {
  describe('Créditos — Nest Hub (1024x600)', () => {
    beforeEach(() => {
      cy.viewport(1024, 600);
      cy.intercept('GET', '**/api/credits*', creditsListResponse).as('creditsList');
      cy.loginAs('SELLER', '/seller/operations');
      cy.wait('@creditsList');
    });

    it('muestra la tabla (no las cards mobile) con columnas secundarias ocultas y sin scroll horizontal', () => {
      cy.get('[data-cy="credits-list-table"]').should('be.visible');
      cy.get('[data-cy="credits-list-mobile-list"]').should('not.be.visible');

      cy.contains('th', 'Vendedor').should('be.visible');
      cy.contains('th', 'Creación').should('not.be.visible');
      cy.contains('th', 'Aprobación').should('not.be.visible');

      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });
  });

  describe('Créditos — Nest Hub Max (1280x800)', () => {
    beforeEach(() => {
      cy.viewport(1280, 800);
      cy.intercept('GET', '**/api/credits*', creditsListResponse).as('creditsList');
      cy.loginAs('SELLER', '/seller/operations');
      cy.wait('@creditsList');
    });

    it('muestra todas las columnas, incluidas las secundarias, sin scroll horizontal', () => {
      cy.get('[data-cy="credits-list-table"]').should('be.visible');

      cy.contains('th', 'Vendedor').should('be.visible');
      cy.contains('th', 'Creación').should('be.visible');
      cy.contains('th', 'Aprobación').should('be.visible');

      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });
  });

  describe('Clientes — Nest Hub (1024x600)', () => {
    beforeEach(() => {
      cy.viewport(1024, 600);
      cy.intercept('GET', '**/api/customers*', customersListResponse).as('customersList');
      cy.loginAs('SELLER', '/seller/clients');
      cy.wait('@customersList');
    });

    it('muestra la tabla con Cobrador y Alta ocultas, y Nombre/DNI/Teléfono/Estado visibles, sin scroll horizontal', () => {
      cy.get('[data-cy="seller-clients-table"]').should('be.visible');

      cy.contains('th', 'Nombre').should('be.visible');
      cy.contains('th', 'DNI').should('be.visible');
      cy.contains('th', 'Teléfono').should('be.visible');
      cy.contains('th', 'Estado').should('be.visible');
      cy.contains('th', 'Cobrador').should('not.be.visible');
      cy.contains('th', 'Alta').should('not.be.visible');

      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });
  });

  describe('Clientes — Nest Hub Max (1280x800)', () => {
    beforeEach(() => {
      cy.viewport(1280, 800);
      cy.intercept('GET', '**/api/customers*', customersListResponse).as('customersList');
      cy.loginAs('SELLER', '/seller/clients');
      cy.wait('@customersList');
    });

    it('muestra todas las columnas, incluidas Cobrador y Alta, sin scroll horizontal', () => {
      cy.get('[data-cy="seller-clients-table"]').should('be.visible');

      cy.contains('th', 'Cobrador').should('be.visible');
      cy.contains('th', 'Alta').should('be.visible');

      cy.window().then((win) => {
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });
  });
});
