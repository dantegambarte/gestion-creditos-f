/**
 * SUITE: Seller — Lista de Operaciones (Créditos)
 *
 * Cubre:
 *  - Render de la lista con filtros de Estado y Tipo
 *  - Botón "Nueva operación" visible para SELLER
 *  - Estado vacío / tabla con datos
 *  - Navegación al wizard de creación
 */

describe('Seller — Lista de Operaciones', () => {
  const creditsMock = [
    {
      id: 'crd-001',
      type: 'SALE',
      total_amount: 120000,
      installments_count: 12,
      payment_frequency: 'WEEKLY',
      interest_rate: 10,
      status: 'ACTIVE',
      created_at: '2026-02-01T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-001',
      customer_name: 'Juan Perez Garcia',
      customer_dni: '22334455',
      created_by_id: 'usr-002',
      created_by_name: 'Maria Sanchez',
    },
    {
      id: 'crd-002',
      type: 'LOAN',
      total_amount: 90000,
      installments_count: 6,
      payment_frequency: 'MONTHLY',
      interest_rate: 15,
      status: 'PENDING_APPROVAL',
      created_at: '2026-02-10T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-002',
      customer_name: 'Laura Gomez',
      customer_dni: '11223344',
      created_by_id: 'usr-002',
      created_by_name: 'Maria Sanchez',
    },
  ];

  function stubCreditsList(): void {
    cy.intercept('GET', /\/api\/credits(\?.*)?$/, (req) => {
      const status = req.query['status'];
      const type = req.query['type'];

      const filtered = creditsMock.filter((credit) => {
        if (status && credit.status !== status) return false;
        if (type && credit.type !== type) return false;
        return true;
      });

      req.reply({ statusCode: 200, body: { ok: true, data: filtered } });
    }).as('creditsList');
  }

  beforeEach(() => {
    cy.viewport(1280, 720);
    stubCreditsList();
    cy.loginAs('SELLER', '/seller/operations');
    cy.wait('@creditsList');
  });

  it('renderiza la página sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el dropdown de filtro por Estado', () => {
    cy.get('p-dropdown').first().should('exist');
  });

  it('muestra el dropdown de filtro por Tipo', () => {
    cy.get('p-dropdown').should('have.length.gte', 1);
  });

  it('el botón "Nueva operación" es visible para SELLER', () => {
    cy.contains('button', 'Nueva operación').should('exist');
  });

  it('clic en "Nueva operación" navega al wizard', () => {
    cy.contains('button', 'Nueva operación').should('be.visible').click();
    cy.url().should('include', '/seller/operations/new');
  });

  it('muestra tabla o estado vacío (no error)', () => {
    cy.get('p-table, app-empty-state, app-loading-state').should('exist');
  });
});

describe('Admin — Lista de Operaciones (misma vista vía /admin)', () => {
  const creditsMock = [
    {
      id: 'crd-001',
      type: 'SALE',
      total_amount: 120000,
      installments_count: 12,
      payment_frequency: 'WEEKLY',
      interest_rate: 10,
      status: 'ACTIVE',
      created_at: '2026-02-01T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-001',
      customer_name: 'Juan Perez Garcia',
      customer_dni: '22334455',
      created_by_id: 'usr-001',
      created_by_name: 'Carlos Lopez',
    },
    {
      id: 'crd-002',
      type: 'LOAN',
      total_amount: 90000,
      installments_count: 6,
      payment_frequency: 'MONTHLY',
      interest_rate: 15,
      status: 'PENDING_APPROVAL',
      created_at: '2026-02-10T00:00:00Z',
      approved_at: null,
      customer_id: 'cust-002',
      customer_name: 'Laura Gomez',
      customer_dni: '11223344',
      created_by_id: 'usr-001',
      created_by_name: 'Carlos Lopez',
    },
  ];

  function stubAdminCreditsList(): void {
    cy.intercept('GET', /\/api\/credits(\?.*)?$/, (req) => {
      const status = req.query['status'];
      const type = req.query['type'];

      const filtered = creditsMock.filter((credit) => {
        if (status && credit.status !== status) return false;
        if (type && credit.type !== type) return false;
        return true;
      });

      req.reply({ statusCode: 200, body: { ok: true, data: filtered } });
    }).as('creditsList');
  }

  function stubMobileNewOperationData(): void {
    cy.intercept('GET', '**/api/customers*', {
      ok: true,
      data: [
        {
          id: 'customer-mobile-new-operation',
          full_name: 'Cliente Mobile Nueva Operación',
          dni: '40111222',
          phone: '1133334444',
          email: 'mobile-new-operation@finflow.test',
          status: 'ACTIVE',
          active_credits: 0,
          active_credits_count: 0,
          activeCredits: 0,
          delinquency: 'sin mora',
          payment_capacity: 0,
          paymentCapacity: 0,
          address: 'Calle Mobile 123',
          collector_id: null,
          collector_name: null,
          collectorName: null,
          portal_enabled: false,
          created_at: '2026-01-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }).as('newOperationCustomers');

    cy.intercept('GET', '**/api/product-units*', {
      ok: true,
      data: [
        {
          id: 'unit-mobile-001',
          unit_code: 'MOB-IMEI-001',
          status: 'AVAILABLE',
          notes: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          variant_id: 'variant-mobile-001',
          color: 'Negro',
          size: null,
          capacity: '256 GB',
          current_price: 350000,
          product_id: 'product-mobile-001',
          product_name: 'Producto Mobile Scroll Test',
        },
      ],
    }).as('newOperationProductUnits');
  }

  function reachMobileSaleProductStep(): void {
    stubMobileNewOperationData();
    cy.loginAs('SELLER', '/seller/operations/new');
    cy.wait('@newOperationCustomers');

    cy.get('[data-cy="btn-type-sale"]').click();
    cy.get('[data-cy="input-search-client"]').should(($input) => {
      expect(parseFloat(getComputedStyle($input[0]).paddingLeft)).to.be.gte(40);
    });
    cy.contains('[data-cy^="client-card-"]', 'Cliente Mobile Nueva Operación')
      .scrollIntoView()
      .click();
    cy.get('[data-cy="btn-siguiente-mobile"]').click();
    cy.wait('@newOperationProductUnits');
    cy.get('[data-cy="dropdown-operation-type"]').should('be.visible');
  }

  beforeEach(() => {
    cy.viewport(1280, 720);
    stubAdminCreditsList();
    cy.loginAs('ADMIN', '/admin/operations');
    cy.wait('@creditsList');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('botón "Nueva operación" existe para ADMIN', () => {
    cy.contains('button', /Nueva operaci[oó]n/i).should('exist');
  });

  it('CR-07: filtra operaciones por estado Activo', () => {
    cy.get('p-dropdown').first().click();
    cy.contains('.p-dropdown-item', 'Activo').click();

    cy.get('p-table tbody tr').should('have.length', 1);
    cy.get('p-table tbody tr').first().should('contain.text', 'ACTIVO');
  });

  it('CR-08: filtra por cliente al buscar "Perez"', () => {
    cy.get('input[placeholder="Buscar por cliente o DNI"]')
      .clear()
      .type('Perez');

    cy.get('p-table tbody tr').should('have.length', 1);
    cy.get('p-table tbody tr')
      .first()
      .should('contain.text', 'Juan Perez Garcia');
  });

  it('Mobile — oculta tabla y renderiza operaciones como cards', () => {
    cy.viewport('iphone-se2');

    cy.get('[data-cy="operations-table"] table').should('not.be.visible');
    cy.get('[data-cy="operations-mobile-card"]')
      .should('have.length', 2)
      .first()
      .should('contain.text', 'Juan Perez Garcia')
      .and('contain.text', 'ACTIVO');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  it('Mobile — Nueva Operación no desborda y el paso Tipo queda usable', () => {
    cy.viewport('iphone-se2');
    cy.loginAs('SELLER', '/seller/operations/new');

    cy.get('app-step-type').should('be.visible');
    cy.get('[data-cy="new-operation-stepper"]').should('be.visible');
    cy.get('[data-cy="new-operation-footer"]').should('not.be.visible');
    cy.get('[data-cy="new-operation-mobile-cancel-action"]').should(
      'be.visible',
    );
    cy.contains('h2', '¿Qué tipo de operación deseas registrar?').should(
      'be.visible',
    );
    cy.get('[data-cy="btn-type-sale"]').should('be.visible');
    cy.get('[data-cy="btn-type-loan"]').scrollIntoView().should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
      expect(win.document.body.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Mobile — Nueva Operación confirma antes de cancelar desde la X superior', () => {
    cy.viewport('iphone-se2');
    cy.loginAs('SELLER', '/seller/operations/new');

    cy.get('[data-cy="new-operation-mobile-cancel-action"]').click();
    cy.contains('.p-confirm-dialog', 'Cancelar operación').should('be.visible');
    cy.contains(
      '.p-confirm-dialog',
      '¿Estás seguro de cancelar la operación?',
    ).should('be.visible');
    cy.get('.p-confirm-dialog .p-dialog-footer button').then(($buttons) => {
      expect($buttons.first().text()).to.contain('Sí, cancelar');
      expect($buttons.last().text()).to.contain('Continuar editando');
    });
    cy.contains('.p-confirm-dialog button', 'Continuar editando').click();
    cy.get('app-step-type').should('be.visible');
  });

  it('Mobile — Nueva Operación mantiene el paso Producto dentro del viewport', () => {
    cy.viewport('iphone-se2');
    reachMobileSaleProductStep();

    cy.get('[data-cy="new-operation-main"]').should(($main) => {
      expect($main[0].scrollTop).to.equal(0);
    });
    cy.get('[data-cy="new-operation-footer"]').should('not.be.visible');
    cy.get('[data-cy="btn-siguiente-mobile"]').should('be.visible');
    cy.contains('h1', 'Nueva Operación').then(($title) => {
      cy.get('[data-cy="btn-siguiente-mobile"]').then(($button) => {
        const titleRect = $title[0].getBoundingClientRect();
        const buttonRect = $button[0].getBoundingClientRect();
        const titleCenter = titleRect.top + titleRect.height / 2;
        const buttonCenter = buttonRect.top + buttonRect.height / 2;
        expect(Math.abs(titleCenter - buttonCenter)).to.be.lte(4);
      });
    });
    cy.get('[data-cy="dropdown-operation-type"] .p-dropdown-clear-icon').should(
      'not.exist',
    );
    cy.get(
      'app-step-products input[placeholder="Buscar por código, marca o descripción..."]',
    )
      .first()
      .should(($input) => {
        expect(parseFloat(getComputedStyle($input[0]).paddingLeft)).to.be.gte(
          40,
        );
      });
    cy.get('[data-cy="new-operation-main"]').scrollTo('bottom');
    cy.get('[data-cy="new-operation-back-to-top"]')
      .should('be.visible')
      .click();
    cy.get('[data-cy="new-operation-main"]').should(($main) => {
      expect($main[0].scrollTop).to.equal(0);
    });
    cy.get('[data-cy="sale-products-step"]').should(($step) => {
      expect($step[0].scrollWidth).to.be.lte($step[0].clientWidth);
    });
    cy.get('[data-cy="sale-catalog-panel"]').should(($panel) => {
      expect($panel[0].scrollWidth).to.be.lte($panel[0].clientWidth);
    });
    cy.get('[data-cy^="sale-product-"]').first().click();
    cy.contains('2. Elegí la variante').should('be.visible');
    cy.get('[data-cy="sale-catalog-panel"]').should(($panel) => {
      expect($panel[0].scrollWidth).to.be.lte($panel[0].clientWidth);
    });
    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
      expect(win.document.body.scrollWidth).to.be.lte(win.innerWidth);
    });
  });

  it('Mobile — Nueva Operación baja a variantes y códigos al tocar un producto', () => {
    cy.viewport('iphone-se2');
    reachMobileSaleProductStep();

    cy.get('[data-cy="sale-products-step"]').should(($step) => {
      expect($step[0].scrollWidth).to.be.lte($step[0].clientWidth);
    });
    cy.contains('[data-cy^="sale-product-"]', 'Producto Mobile Scroll Test')
      .should('be.visible')
      .click();

    cy.contains('2. Elegí la variante').should('be.visible');
    cy.contains('[data-cy^="sale-variant-"]', 'Negro').click();
    cy.contains('3. Seleccioná la unidad').should('be.visible');
    cy.contains('MOB-IMEI-001').should('be.visible');
    cy.get('[data-cy="sale-catalog-panel"]').should(($panel) => {
      expect($panel[0].scrollWidth).to.be.lte($panel[0].clientWidth);
    });
  });
});
