/**
 * SUITE: Wizard "Nueva Operación" — 4 pasos
 *
 * Happy paths:
 *   - Flujo VENTA (SALE): cliente → carrito → condiciones → confirmación
 *   - Flujo PRÉSTAMO (LOAN): cliente → monto → condiciones → confirmación
 *
 * Casos unitarios:
 *   - Indicador de paso
 *   - Botón Cancelar
 *   - Cliente inactivo bloquea avance
 *   - Búsqueda de clientes filtra la lista
 */

const URL_NEW_OP = '/admin/operations/new';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const CLIENTS_MOCK = [
  {
    id: 'cust-001',
    full_name: 'Ana García',
    dni: '10293847',
    phone: '3811234567',
    email: 'ana@example.com',
    status: 'ACTIVE',
    portal_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    collector_id: null,
    collector_name: null,
  },
  {
    id: 'cust-002',
    full_name: 'Bruno Pérez',
    dni: '22334455',
    phone: '3810000000',
    email: 'bruno@example.com',
    status: 'INACTIVE',
    portal_enabled: false,
    created_at: '2026-01-01T00:00:00Z',
    collector_id: null,
    collector_name: null,
  },
];

const PRODUCT_UNITS_MOCK = [
  {
    id: 'unit-001',
    unit_code: 'UN-001',
    status: 'AVAILABLE',
    current_price: 100000,
    product_id: 'prod-001',
    product_name: 'Moto X',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const PRODUCT_RATES_MOCK = [
  {
    id: 'prate-001',
    product_id: 'prod-001',
    installments_count: 3,
    payment_frequency: 'MONTHLY',
    rate: 0.5,
    active: true,
  },
  {
    id: 'prate-002',
    product_id: 'prod-001',
    installments_count: 6,
    payment_frequency: 'MONTHLY',
    rate: 0.8,
    active: true,
  },
];

const INTEREST_RATES_MOCK = [
  {
    id: 'irate-001',
    installments_count: 3,
    payment_frequency: 'MONTHLY',
    rate: 0.5,
    min_amount: 1000,
    max_amount: null,
    active: true,
  },
  {
    id: 'irate-002',
    installments_count: 6,
    payment_frequency: 'MONTHLY',
    rate: 0.8,
    min_amount: 1000,
    max_amount: null,
    active: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Registra todos los intercepts necesarios para el wizard.
 * Se define ANTES de visitar la URL para garantizar que las requests sean capturadas.
 */
function stubWizardApis(): void {
  cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: CLIENTS_MOCK },
  }).as('customers');

  cy.intercept('GET', /\/api\/product-units(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_UNITS_MOCK },
  }).as('productUnits');

  cy.intercept('GET', /\/api\/product-rates(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_RATES_MOCK },
  }).as('productRates');

  cy.intercept('GET', /\/api\/interest-rates(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: INTEREST_RATES_MOCK },
  }).as('loanRates');

  cy.intercept('POST', /\/api\/credits(\?.*)?$/, {
    statusCode: 201,
    body: { ok: true, data: { id: 'op-new-001' } },
  }).as('submitOp');
}

/**
 * Abre el dropdown de tipo de operación y elige la opción indicada.
 * Usa el overlay que PrimeNG agrega al body.
 */
function selectOperationType(label: 'Venta' | 'Préstamo'): void {
  cy.get('[data-cy="dropdown-operation-type"] .p-dropdown').click();
  cy.get('.p-dropdown-panel .p-dropdown-item').contains(label).click();
}

/**
 * Selecciona una frecuencia de pago en el paso 3.
 * El dropdown puede estar ya auto-seleccionado; si hay opciones, elige la primera.
 */
function selectFirstFrequencyIfNeeded(): void {
  cy.get('p-dropdown[formControlName="paymentFrequency"] .p-dropdown').then(($el) => {
    const hasValue = $el.find('.p-dropdown-label:not(.p-placeholder)').length > 0;
    if (!hasValue) {
      cy.wrap($el).click();
      cy.get('.p-dropdown-panel .p-dropdown-item').first().click();
    }
  });
}

/**
 * Completa la fecha del primer pago con una fecha futura fija.
 */
function fillFirstPaymentDate(): void {
  cy.get('p-calendar[formControlName="firstPaymentDate"] input')
    .clear()
    .type('15/12/2026')
    .blur();
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('Wizard — Nueva Operación de Crédito', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    stubWizardApis();
    cy.loginAs('ADMIN', URL_NEW_OP);
    cy.wait('@customers');
  });

  // ── Estructura general ────────────────────────────────────────────────────

  it('renderiza el título y el indicador de paso 1', () => {
    cy.contains('h1', 'Nueva Operación de Crédito').should('be.visible');
    cy.contains('Paso 1 de 4').should('be.visible');
    cy.contains('Cliente').should('be.visible');
  });

  it('el botón Cancelar navega fuera del wizard', () => {
    cy.get('[data-cy="btn-cancelar"] button').click();
    cy.url().should('not.include', '/new');
  });

  it('el botón X del header navega fuera del wizard', () => {
    cy.get('p-button[icon="pi pi-times"]').first().click();
    cy.url().should('not.include', '/new');
  });

  // ── Paso 0: Cliente ───────────────────────────────────────────────────────

  describe('Paso 0 — Selección de Cliente', () => {
    it('muestra la lista de clientes cargada desde el mock', () => {
      cy.get('[data-cy^="client-card-"]').should('have.length', CLIENTS_MOCK.length);
    });

    it('el botón Siguiente está deshabilitado sin cliente seleccionado', () => {
      cy.get('[data-cy="btn-siguiente"] button').should('be.disabled');
    });

    it('filtra clientes al escribir en el campo de búsqueda', () => {
      cy.get('[data-cy="input-search-client"]').type('Ana');
      cy.get('[data-cy^="client-card-"]').should('have.length', 1);
      cy.contains('Ana García').should('be.visible');
    });

    it('cliente inactivo bloquea avance aunque esté seleccionado', () => {
      cy.get('[data-cy="client-card-cust-002"]').click();
      cy.contains('El cliente seleccionado está inactivo').should('be.visible');
      cy.get('[data-cy="btn-siguiente"] button').should('be.disabled');
    });

    it('cliente activo habilita el botón Siguiente', () => {
      cy.get('[data-cy="client-card-cust-001"]').click();
      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled');
    });
  });

  // ── Happy Path: VENTA ─────────────────────────────────────────────────────

  describe('Happy Path — Flujo SALE (Venta)', () => {
    beforeEach(() => {
      cy.get('[data-cy="client-card-cust-001"]').click();
      cy.get('[data-cy="btn-siguiente"] button').click();
      cy.contains('Paso 2 de 4').should('be.visible');
    });

    it('completa el flujo completo de venta y envía para aprobación', () => {
      // ── Paso 2: tipo + carrito ──────────────────────────────────────────

      selectOperationType('Venta');
      cy.wait('@productUnits');

      cy.contains('Catálogo').should('be.visible');
      cy.contains('Moto X').should('be.visible');

      cy.get('[data-cy="btn-add-product"] button').first().click();
      cy.wait('@productRates');

      cy.contains('Carrito').should('be.visible');
      // El total carrito debe mostrar un valor > 0
      cy.contains('Total carrito').parent().should('contain.text', '100.000');

      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
      cy.contains('Paso 3 de 4').should('be.visible');

      // ── Paso 3: condiciones ─────────────────────────────────────────────

      cy.contains('Condiciones Financieras').should('be.visible');
      cy.contains('Total a devolver').should('be.visible');

      selectFirstFrequencyIfNeeded();

      // Las cuotas por producto deben ser visibles
      cy.contains('Cuotas por producto').should('be.visible');
      cy.contains('Moto X').should('be.visible');

      fillFirstPaymentDate();

      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
      cy.contains('Paso 4 de 4').should('be.visible');

      // ── Paso 4: confirmación ────────────────────────────────────────────

      cy.contains('Resumen de la Operación').should('be.visible');
      cy.contains('Ana García').should('be.visible');
      cy.contains('Venta').should('be.visible');
      cy.contains('Declaraciones y Autorizaciones').should('be.visible');
      cy.contains('será enviada a revisión del supervisor').should('be.visible');

      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('be.disabled');

      cy.get('[data-cy="chk-identity"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click();

      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click();
      cy.wait('@submitOp');
    });

    it('el botón Anterior desde paso 2 regresa al paso 1', () => {
      cy.get('[data-cy="btn-anterior"] button').click();
      cy.contains('Paso 1 de 4').should('be.visible');
      cy.contains('Buscar cliente').should('be.visible');
    });

    it('el carrito vacío bloquea el avance al paso 3', () => {
      selectOperationType('Venta');
      cy.wait('@productUnits');
      cy.get('[data-cy="btn-siguiente"] button').should('be.disabled');
    });
  });

  // ── Happy Path: PRÉSTAMO ──────────────────────────────────────────────────

  describe('Happy Path — Flujo LOAN (Préstamo)', () => {
    beforeEach(() => {
      cy.get('[data-cy="client-card-cust-001"]').click();
      cy.get('[data-cy="btn-siguiente"] button').click();
      cy.contains('Paso 2 de 4').should('be.visible');
    });

    it('completa el flujo completo de préstamo y envía para aprobación', () => {
      // ── Paso 2: tipo + monto ────────────────────────────────────────────

      selectOperationType('Préstamo');
      cy.wait('@loanRates');

      cy.contains('Monto total').should('be.visible');

      // .blur() fuerza a PrimeNG a confirmar el valor al FormControl antes de avanzar,
      // lo que dispara totalAmount.valueChanges → habilita las opciones de cuotas
      cy.get('p-inputNumber[formControlName="totalAmount"] input')
        .clear()
        .type('50000')
        .blur();

      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
      cy.contains('Paso 3 de 4').should('be.visible');

      // ── Paso 3: condiciones ─────────────────────────────────────────────

      cy.contains('Condiciones Financieras').should('be.visible');

      // Seleccionamos la frecuencia explícitamente para asegurar que
      // paymentFrequency.valueChanges dispare ensureValidInstallmentsSelection
      cy.get('p-dropdown[formControlName="paymentFrequency"] .p-dropdown').click();
      cy.get('.p-dropdown-panel .p-dropdown-item').first().click();

      // El dropdown de cuotas debe estar habilitado — el blur anterior garantizó
      // que totalAmount se comprometió y las tasas se filtraron correctamente
      cy.get('[data-cy="ddl-installments"] .p-dropdown')
        .should('not.have.class', 'p-disabled')
        .then(($dd) => {
          const label = $dd.find('.p-dropdown-label').text().trim();
          if (!label || label === 'Seleccionar cuotas') {
            cy.wrap($dd).click();
            cy.get('.p-dropdown-panel .p-dropdown-item').first().click();
          }
        });

      cy.contains('Total a devolver').should('be.visible');
      cy.contains('Capital base').should('be.visible');

      fillFirstPaymentDate();

      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
      cy.contains('Paso 4 de 4').should('be.visible');

      // ── Paso 4: confirmación ────────────────────────────────────────────

      cy.contains('Resumen de la Operación').should('be.visible');
      cy.contains('Ana García').should('be.visible');
      cy.contains('Préstamo').should('be.visible');
      cy.contains('Cantidad de cuotas').should('be.visible');

      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('be.disabled');

      cy.get('[data-cy="chk-identity"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click();
      cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click();

      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click();
      cy.wait('@submitOp');
    });

    it('sin monto ingresado el botón Siguiente está deshabilitado', () => {
      selectOperationType('Préstamo');
      cy.wait('@loanRates');
      cy.contains('Monto total').should('be.visible');
      cy.get('[data-cy="btn-siguiente"] button').should('be.disabled');
    });
  });
});
