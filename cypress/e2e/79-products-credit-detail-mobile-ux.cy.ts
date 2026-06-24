const productsResponse = {
  ok: true,
  data: [
    {
      id: 'prod-mobile-1',
      title: 'Moto 110cc',
      description: 'Moto urbana de baja cilindrada',
      brand_id: 'brand-1',
      brand_name: 'Honda',
      category_id: 'cat-1',
      category_name: 'Motos',
      status: 'ACTIVE',
      available_count: 2,
      reserved_count: 0,
      sold_count: 1,
      variants: [
        {
          id: 'variant-1',
          color: 'Rojo',
          size: null,
          capacity: null,
          current_price: 1500000,
          status: 'ACTIVE',
          available_count: 2,
          reserved_count: 0,
          sold_count: 1,
        },
      ],
    },
  ],
};

const creditDetailResponse = {
  ok: true,
  data: {
    id: 'credit-mobile-1',
    type: 'LOAN',
    total_amount: 180000,
    installments_count: 6,
    payment_frequency: 'MONTHLY',
    interest_rate: 0.08,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    approved_at: '2026-01-02T00:00:00.000Z',
    customer_id: 'cust-mobile-1',
    customer_name: 'Cliente Credit Detail Mobile',
    customer_dni: '40555666',
    created_by_id: 'seller-mobile-1',
    created_by_name: 'Vendedor Mobile',
    rejection_reason: null,
    notes: null,
    approved_by: 'admin-mobile-1',
    customer_phone: '11-5000-1234',
    financed_amount: 180000,
    down_payment: 0,
    down_payment_method: null,
    down_payment_transfer_reference: null,
    prepaid_installments: 0,
    prepaid_installments_method: null,
    prepaid_installments_transfer_reference: null,
    settled_at: null,
    settlement_amount: null,
    settlement_type: null,
    refinanced_from_credit_id: null,
    refinancing_chain: null,
    products: [],
    units: [],
    installments: [
      {
        id: 'inst-mobile-1',
        installment_number: 1,
        due_date: '2026-02-01',
        amount_due: 30000,
        amount_paid: 30000,
        penalty_amount: 0,
        status: 'PAID',
      },
      {
        id: 'inst-mobile-2',
        installment_number: 2,
        due_date: '2026-03-01',
        amount_due: 30000,
        amount_paid: 0,
        penalty_amount: 1500,
        status: 'OVERDUE',
      },
    ],
  },
};

describe('Productos y Credit Detail — Mobile UX', () => {
  beforeEach(() => {
    cy.viewport('iphone-se2');
  });

  // P1 #4 — Productos: tabla de 8 columnas sin tratamiento mobile.
  it('Productos Mobile — listado en cards en vez de tabla', () => {
    cy.intercept('GET', '**/api/products*', productsResponse).as('productsList');

    cy.loginAs('ADMIN', '/admin/products');
    cy.wait('@productsList');

    cy.get('[data-cy="products-list-table"]').should('not.be.visible');
    cy.get('[data-cy="products-list-mobile-card"]')
      .should('have.length', 1)
      .first()
      .contains('Moto 110cc');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  // P1 #4 — Bug crítico: panel izquierdo de 420px fijo + tabla de cuotas de
  // 7 columnas + side panel de 220px, todo dentro de un flex sin wrap. En
  // mobile el panel izquierdo solo ya superaba el ancho del viewport.
  it('Credit Detail Mobile — el layout de dos columnas apila en vez de desbordar y el cronograma usa cards', () => {
    cy.intercept('GET', '**/api/credits/credit-mobile-1', creditDetailResponse).as(
      'creditDetail',
    );

    cy.loginAs('ADMIN', '/admin/operations/credit-mobile-1');
    cy.wait('@creditDetail');

    cy.get('[data-cy="credit-schedule-table"]').should('not.be.visible');
    cy.get('[data-cy="credit-schedule-mobile-card"]')
      .should('have.length', 2)
      .first()
      .contains('Cuota 1');

    // El bug original: el panel de detalles financieros (420px fijo) dejaba
    // todo el documento con scroll horizontal.
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });

    // Tocar una cuota vencida abre el panel lateral, que ahora debe apilar
    // debajo de las cards (no comprimirlas a un costado).
    cy.get('[data-cy="credit-schedule-mobile-card"]').eq(1).click();
    cy.contains('Cuota 2 de 6').should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});

// P3 — landscape: el viewport entero pasa a medir ~375px de alto. El
// cronograma forzaba min-height:400px, más alto que la pantalla disponible.
describe('Credit Detail — Landscape (667×375)', () => {
  beforeEach(() => {
    cy.viewport(667, 375);
  });

  it('el cronograma de cuotas no fuerza overflow vertical de página en landscape', () => {
    cy.intercept('GET', '**/api/credits/credit-mobile-1', creditDetailResponse).as(
      'creditDetail',
    );

    cy.loginAs('ADMIN', '/admin/operations/credit-mobile-1');
    cy.wait('@creditDetail');

    cy.get('[data-cy="credit-schedule-mobile-card"]').should('have.length', 2);

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      // El piso de 400px ya no debe exceder el alto real disponible del viewport.
      expect(win.document.documentElement.scrollHeight).to.be.lte(win.innerHeight + 50);
    });
  });
});
