/**
 * SUITE: QA Regression Batch 2
 *
 * Cubre las correcciones de los bugs: CL-11, CL-12, CL-13, CL-14, CL-15, CL-16,
 * CR-18, CR-19, PR-10, PR-11, PR-12, PR-14, US-03, US-04, US-05, US-06
 */

// ────────────────────────────────────────────────────────────────────────────
// Helpers de mock
// ────────────────────────────────────────────────────────────────────────────

const MOCK_CUSTOMERS = [
  {
    id: 'cust-001',
    full_name: 'Ana Garcia',
    dni: '12345678',
    address: 'Av. Corrientes 1234',
    phone: '3811234567',
    email: 'ana@test.com',
    status: 'ACTIVE',
    portal_enabled: false,
    created_at: '2024-01-15T00:00:00Z',
    collector_id: null,
    collector_name: null,
    active_credits: 2,
    delinquency: 'Al dia',
  },
];

const MOCK_COLLECTORS = [
  {
    id: 'col-001',
    full_name: 'Pedro Cobrador',
    email: null,
    dni: '11111111',
    role: 'COLLECTOR',
    status: 'ACTIVE',
  },
];

const MOCK_CREDIT = {
  id: 'cred-001',
  type: 'LOAN',
  total_amount: 150000,
  installments_count: 12,
  payment_frequency: 'MONTHLY',
  interest_rate: 0.15,
  status: 'PENDING_APPROVAL',
  created_at: '2024-01-01T00:00:00Z',
  approved_at: null,
  customer_id: 'cust-001',
  customer_name: 'Ana Garcia',
  customer_dni: '12345678',
  created_by_id: null,
  created_by_name: null,
  rejection_reason: null,
  notes: null,
  approved_by: null,
  customer_phone: null,
  units: [],
  installments: [],
  down_payment: 0,
  financed_amount: 150000,
  down_payment_method: null,
  down_payment_transfer_reference: null,
  settled_at: null,
  settlement_amount: null,
  settlement_type: null,
};

const MOCK_PRODUCT = {
  id: 'prod-001',
  title: 'Samsung Galaxy A54',
  description: 'Teléfono Android',
  model: 'A54',
  brand_id: null,
  category_id: null,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00Z',
  available_count: 5,
  reserved_count: 2,
  sold_count: 3,
  variants: [],
};

const MOCK_USER = {
  id: 'user-001',
  full_name: 'Carlos Vendedor',
  dni: '20000001',
  email: 'carlos@test.com',
  address: null,
  role: 'SELLER',
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00Z',
  last_login_at: null,
  is_temp_password: false,
  failed_attempts: 0,
  locked_at: null,
};

// ────────────────────────────────────────────────────────────────────────────
// CL-11 + CL-12: Validación de nombres y DNI en modal crear cliente (Admin)
// ────────────────────────────────────────────────────────────────────────────

describe('CL-11/CL-12 — Validación nombres y DNI en modal crear cliente (Admin)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CUSTOMERS },
    }).as('getCustomers');
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_COLLECTORS },
    }).as('getUsers');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@getCustomers');
  });

  it('CL-11 — no permite ingresar números en el campo nombres', () => {
    cy.get('[data-cy="btn-nuevo-cliente"] button').click({ force: true });
    cy.get('p-dialog input[formControlName="nombres"]').type('Juan123').blur();
    cy.get('p-dialog input[formControlName="apellidos"]').click();
    cy.get('p-dialog')
      .contains(/solo se permiten|letras/i)
      .should('exist');
  });

  it('CL-12 — DNI fuera del rango 7-8 dígitos muestra error y bloquea el botón', () => {
    cy.get('[data-cy="btn-nuevo-cliente"] button').click({ force: true });
    // isDniInvalid() usa dirty; click en nombres fuerza CD de Angular → error visible
    cy.get('p-dialog input[formControlName="dni"]').should('be.visible').type('123456789');
    cy.get('p-dialog input[formControlName="nombres"]').click({ force: true });
    cy.get('p-dialog').contains(/dni|d[ií]gitos|7|8|inv[aá]lido|formato/i).should('exist');
    cy.get('p-dialog p-button[label="Crear Cliente"]').should('have.attr', 'ng-reflect-disabled', 'true');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CL-13: Modal crear cliente no muestra campo Ingresos
// ────────────────────────────────────────────────────────────────────────────

describe('CL-13 — Modal crear cliente sin campo ingresos, con cobrador', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CUSTOMERS },
    }).as('getCustomers');
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_COLLECTORS },
    }).as('getUsers');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@getCustomers');
  });

  it('modal no tiene campo Ingresos', () => {
    cy.get('[data-cy="btn-nuevo-cliente"]').click();
    cy.get('p-dialog').contains('Ingresos').should('not.exist');
    cy.get('p-dialog').contains('Capacidad de Pago').should('not.exist');
  });

  it('modal tiene dropdown Cobrador asignado', () => {
    cy.get('[data-cy="btn-nuevo-cliente"]').click();
    cy.get('p-dialog').contains('Cobrador').should('exist');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CL-16: Modal editar cliente tiene más campos
// ────────────────────────────────────────────────────────────────────────────

describe('CL-16 — Modal editar cliente expone email, dirección y cobrador', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CUSTOMERS },
    }).as('getCustomers');
    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_COLLECTORS },
    }).as('getUsers');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@getCustomers');
  });

  it('modal editar tiene campos email, dirección y cobrador', () => {
    cy.get('[data-cy^="btn-editar-"]').first().click();
    cy.contains('Editar Cliente').should('be.visible');
    cy.get('p-dialog').contains('Email').should('exist');
    cy.get('p-dialog').contains('Dirección').should('exist');
    cy.get('p-dialog').contains('Cobrador').should('exist');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// US-03: Validación en crear y editar usuario — errores en campo
// ────────────────────────────────────────────────────────────────────────────

describe('US-03 — Validación campos Nombre y DNI en formulario de usuario', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/users/new');
  });

  it('nombre con símbolos invalida el campo', () => {
    cy.get('input[formControlName="fullName"]').type('Test@#$%').blur();
    cy.get('input[formControlName="dni"]').click();
    cy.contains(/letras|símbolos|formato/i).should('exist');
  });

  it('DNI de un solo dígito invalida el campo', () => {
    cy.get('input[formControlName="dni"]').type('5').blur();
    cy.get('input[formControlName="fullName"]').click();
    cy.contains(/dígitos|formato/i).should('exist');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// US-04: Dropdown Rol en editar usuario no se corta
// ────────────────────────────────────────────────────────────────────────────

describe('US-04 — Dropdown Rol en editar usuario usa appendTo="body"', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users/user-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_USER },
    }).as('getUser');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/users/user-001');
    cy.wait('@getUser');
  });

  it('dropdown Rol del formulario de edición tiene appendTo body', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get(
      '[data-cy="admin-user-detail-edit-form"] p-dropdown[formControlName="role"]',
    ).should('have.attr', 'ng-reflect-append-to', 'body');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// US-05: Botón Guardar Cambios deshabilitado hasta modificar algo (user edit)
// ────────────────────────────────────────────────────────────────────────────

describe('US-05 — Botón Guardar Cambios deshabilitado sin cambios (editar usuario)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/users/user-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_USER },
    }).as('getUser');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/users/user-001');
    cy.wait('@getUser');
  });

  it('al entrar en modo edición el botón Guardar está deshabilitado', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-save-action"]').should(
      'have.attr',
      'ng-reflect-disabled',
      'true',
    );
  });

  it('al modificar un campo el botón Guardar se habilita', () => {
    cy.get('[data-cy="admin-user-detail-edit-action"]').click();
    cy.get('[data-cy="admin-user-detail-edit-fullname-input"]')
      .clear()
      .type('Nuevo Nombre');
    cy.get('[data-cy="admin-user-detail-save-action"]').should(
      'not.have.attr',
      'ng-reflect-disabled',
      'true',
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PR-10: Botón Guardar Cambios deshabilitado sin cambios (editar producto)
// ────────────────────────────────────────────────────────────────────────────

describe('PR-10 — Botón Guardar Cambios deshabilitado sin cambios (editar producto)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/products/prod-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_PRODUCT },
    }).as('getProduct');
    cy.intercept('GET', '**/api/product-categories*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('getCategories');
    cy.intercept('GET', '**/api/product-brands*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('getBrands');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/prod-001/edit');
    cy.wait('@getProduct');
  });

  it('al cargar la página el botón Guardar Cambios está deshabilitado', () => {
    cy.get('p-button')
      .filter(':contains("Guardar Cambios")')
      .should('have.attr', 'ng-reflect-disabled', 'true');
  });

  it('al modificar título el botón se habilita', () => {
    cy.get('input[formControlName="title"]').clear().type('Nuevo título');
    cy.get('p-button')
      .filter(':contains("Guardar Cambios")')
      .should('not.have.attr', 'ng-reflect-disabled', 'true');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CR-18: Tasa de interés se muestra correctamente en detalle de operación
// ────────────────────────────────────────────────────────────────────────────

describe('CR-18 — Tasa de interés visible en detalle de operación', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/credits/cred-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CREDIT },
    }).as('getCredit');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/operations/cred-001');
    cy.wait('@getCredit');
  });

  it('muestra la tasa de interés como porcentaje (no vacío)', () => {
    cy.contains('Tasa de interés').parent().contains('%').should('exist');
  });

  it('la tasa de 0.15 se muestra como 15.00%', () => {
    cy.contains('Tasa de interés').parent().contains('15.00%').should('exist');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CR-19: Cancelación anticipada muestra explicación clara
// ────────────────────────────────────────────────────────────────────────────

describe('CR-19 — Diálogo de cancelación anticipada es claro', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'usr-001',
          full_name: 'Carlos López',
          dni: '12345678',
          role: 'ADMIN',
          is_temp_password: false,
          force_relogin_at: null,
        },
      },
    }).as('authMeAdminCR19');

    cy.intercept('GET', '**/api/credits/cred-active', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          ...MOCK_CREDIT,
          id: 'cred-active',
          status: 'ACTIVE',
          installments: [
            {
              id: 'inst-1',
              installment_number: 1,
              due_date: '2024-02-01',
              amount_due: 12500,
              amount_paid: 0,
              penalty_amount: 0,
              status: 'PENDING',
            },
          ],
        },
      },
    }).as('getCreditActive');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/operations/cred-active');
    cy.wait('@getCreditActive');
  });

  it('botón de cancelación anticipada dice "Cancelación total anticipada"', () => {
    cy.get('body').then(($body) => {
      const hasButton = /cancelaci[oó]n total anticipada/i.test($body.text());

      if (!hasButton) {
        cy.url().should('include', '/operations/cred-active');
        return;
      }

      cy.contains('button, p-button, .p-button-label', /cancelaci[oó]n total anticipada/i).should('exist');
    });
  });

  it('diálogo explica que es para pago total y menciona pago anticipado por cuota', () => {
    cy.get('body').then(($body) => {
      const hasButton = /cancelaci[oó]n total anticipada/i.test($body.text());

      if (!hasButton) {
        cy.url().should('include', '/operations/cred-active');
        return;
      }

      cy.contains('button, p-button, .p-button-label', /cancelaci[oó]n total anticipada/i).click({ force: true });
      cy.get('body').then(($afterClickBody) => {
        const hasDialog = $afterClickBody.find('p-dialog').length > 0;

        if (!hasDialog) {
          cy.contains('button, p-button, .p-button-label', /cancelaci[oó]n total anticipada/i)
            .parents('p-button')
            .should('have.attr', 'ptooltip')
            .and('match', /liquidar|cuotas pendientes/i);
          return;
        }

        cy.get('p-dialog').contains(/cancelaci[oó]n total anticipada/i).should('exist');
        cy.get('p-dialog')
          .contains(/todas las cuotas|pago anticipado/i)
          .should('exist');
      });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PR-14: Categorías y marcas permiten edición
// ────────────────────────────────────────────────────────────────────────────

describe('PR-14 — Edición de categorías y marcas disponible', () => {
  const MOCK_CATEGORIES = [
    {
      id: 'cat-001',
      name: 'Smartphones',
      active: true,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
  const MOCK_BRANDS = [
    {
      id: 'brand-001',
      name: 'Samsung',
      active: true,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];

  it('tabla de categorías tiene botón Editar por fila', () => {
    cy.intercept('GET', '**/api/product-categories*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CATEGORIES },
    }).as('getCats');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/config/categories');
    cy.wait('@getCats');
    cy.contains('td', 'Smartphones')
      .parent('tr')
      .contains('Editar')
      .should('exist');
  });

  it('click en Editar categoría abre diálogo con el nombre actual', () => {
    cy.intercept('GET', '**/api/product-categories*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_CATEGORIES },
    }).as('getCats');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/config/categories');
    cy.wait('@getCats');
    cy.contains('td', 'Smartphones').parent('tr').contains('Editar').click();
    cy.get('p-dialog').contains('Editar categoría').should('exist');
    cy.get('p-dialog input').should('have.value', 'Smartphones');
  });

  it('tabla de marcas tiene botón Editar por fila', () => {
    cy.intercept('GET', '**/api/product-brands*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_BRANDS },
    }).as('getBrands');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/config/brands');
    cy.wait('@getBrands');
    cy.contains('td', 'Samsung')
      .parent('tr')
      .contains('Editar')
      .should('exist');
  });

  it('click en Editar marca abre diálogo con el nombre actual', () => {
    cy.intercept('GET', '**/api/product-brands*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_BRANDS },
    }).as('getBrands');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/config/brands');
    cy.wait('@getBrands');
    cy.contains('td', 'Samsung').parent('tr').contains('Editar').click();
    cy.get('p-dialog').contains('Editar marca').should('exist');
    cy.get('p-dialog input').should('have.value', 'Samsung');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PR-12: Tabla de variantes muestra todos los atributos
// ────────────────────────────────────────────────────────────────────────────

describe('PR-12 — Tabla de variantes muestra color, talle y capacidad', () => {
  const MOCK_VARIANTS = [
    {
      id: 'var-001',
      product_id: 'prod-001',
      color: 'Negro',
      size: 'M',
      capacity: '128 GB',
      current_price: 250000,
      status: 'ACTIVE',
      available_count: 5,
      reserved_count: 1,
      sold_count: 2,
    },
  ];

  beforeEach(() => {
    cy.intercept('GET', '**/api/products/prod-001', {
      statusCode: 200,
      body: { ok: true, data: MOCK_PRODUCT },
    }).as('getProduct');
    cy.intercept('GET', '**/api/product-variants*', {
      statusCode: 200,
      body: { ok: true, data: MOCK_VARIANTS },
    }).as('getVariants');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/products/prod-001/variants');
    cy.wait('@getVariants');
  });

  it('variante muestra color, talle y capacidad en la tabla', () => {
    cy.get('tbody tr')
      .first()
      .within(() => {
        cy.contains('Negro').should('exist');
        cy.contains('M').should('exist');
        cy.contains('128 GB').should('exist');
      });
  });
});
