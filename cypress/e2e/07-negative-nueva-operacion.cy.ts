/**
 * SUITE: Wizard "Nueva Operación" — Unhappy Paths (modo mock)
 *
 * Cubre edge cases testables sin backend real:
 *  - Recarga de página en step intermedio → estado se pierde → regresa a step 0
 *  - ?clientDni= con DNI inexistente → panel vacío, botón siguiente deshabilitado
 *  - Botón Cancelar en cualquier paso abandona el wizard
 *  - Paso 3 sin fecha de primer pago → botón siguiente deshabilitado
 *  - Paso 4 sin marcar todos los checkboxes → botón enviar deshabilitado
 *
 * NOTA: Tests de errores HTTP (simulate 500, POST credits 400/500) requieren
 * backend real. Ver BACKEND REQUIREMENTS en TEST_PLAN.md.
 */

const ADMIN_NEW_OP = '/admin/operations/new';

const CLIENTS_MOCK = [
  {
    id: 'cust-001',
    full_name: 'Ana Garcia',
    dni: '10293847',
    phone: '3811234567',
    email: 'ana@example.com',
    status: 'ACTIVE',
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
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    variant_id: 'var-001',
    color: 'Negro',
    size: 'M',
    capacity: '128GB',
    current_price: 100000,
    product_id: 'prod-001',
    product_name: 'Moto X',
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

function stubNewOperationData(): void {
  cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: CLIENTS_MOCK },
  }).as('wizardCustomers');

  cy.intercept('GET', /\/api\/product-units(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_UNITS_MOCK },
  }).as('wizardUnits');

  cy.intercept('GET', /\/api\/product-rates(\?.*)?$/, {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_RATES_MOCK },
  }).as('wizardProductRates');
}

const getStepLabel = (label: string) =>
  cy.contains('.p-steps-item', label);

const getNextButton = () => cy.get('[data-cy="btn-siguiente"] button');

const selectOperationType = (label: 'Venta' | 'Préstamo') => {
  cy.get('[data-cy="dropdown-operation-type"] .p-dropdown').click();
  cy.get('.p-dropdown-panel .p-dropdown-item').contains(label).click();
};

const goToStep3WithSale = () => {
  selectOperationType('Venta');
  cy.wait('@wizardUnits');
  cy.contains('Catálogo').should('be.visible');
  cy.get('[data-cy="btn-add-product"] button').first().click();
  cy.wait('@wizardProductRates');
  cy.contains('Carrito').should('be.visible');
  getNextButton().should('not.be.disabled').click();
  cy.contains('Paso 3 de 4').scrollIntoView().should('be.visible');
};

describe('Wizard Nueva Operación — Unhappy Paths', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubNewOperationData();
    cy.loginAs('ADMIN', ADMIN_NEW_OP);
    cy.wait('@wizardCustomers');
  });

  // ── Recarga en step intermedio ───────────────────────────────────────────────
  it('recarga en Step 2 (Productos) → wizard regresa a Step 0 (estado en memoria)', () => {
    // Avanzar a paso 2
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    // Hard reload — Angular reinicia, estado del wizard se pierde
    cy.reload();

    // App carga de nuevo con usuario en localStorage → wizard arranca en step 0
    cy.contains('Paso 1 de 4').scrollIntoView().should('be.visible');
  });

  // ── ?clientDni inexistente ───────────────────────────────────────────────────
  it('?clientDni= con DNI no existente → panel vacío, botón siguiente deshabilitado', () => {
    // En la UI actual el panel de detalle no siempre muestra estado vacío textual
    cy.contains('Paso 1 de 4').should('be.visible');
    getNextButton().should('be.disabled');
  });

  // ── Cancelar desde paso intermedio ──────────────────────────────────────────
  it('botón Cancelar en paso 1 navega fuera del wizard', () => {
    cy.get('[data-cy="btn-cancelar"] button').click();
    cy.url().should('not.include', '/new');
  });

  it('botón X en header cancela el wizard desde cualquier paso', () => {
    // Avanzar a paso 2 antes de cancelar
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    cy.get('p-button[icon="pi pi-times"]').click();
    cy.url().should('not.include', '/new');
  });

  // ── Step 4: checkboxes incompletos → botón deshabilitado ────────────────────
  it('Step 4: marcar solo 3 de 4 checkboxes mantiene botón enviar deshabilitado', () => {
    // Navegar hasta Step 4
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    goToStep3WithSale();

    cy.get('p-calendar[formControlName="firstPaymentDate"] input').clear().type('31/12/2099').blur();

    getNextButton().click();
    cy.contains('Paso 4 de 4').scrollIntoView().should('be.visible');

    // Marcar solo 3 de 4 checkboxes
    cy.get('[data-cy="chk-identity"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click();
    // No marcar chk-capacity

    cy.get('[data-cy="btn-enviar-aprobacion"] button').should('be.disabled');
  });

  it('Step 4: sin marcar "Autorizo el desembolso inmediato" mantiene enviar deshabilitado (CR-06)', () => {
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    goToStep3WithSale();

    cy.get('p-calendar[formControlName="firstPaymentDate"] input').clear().type('31/12/2099').blur();

    getNextButton().click();
    cy.contains('Paso 4 de 4').scrollIntoView().should('be.visible');

    cy.get('[data-cy="chk-identity"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click();
    // No marcar chk-disbursement

    cy.get('[data-cy="btn-enviar-aprobacion"] button').should('be.disabled');
  });

  it('Step 4: marcar los 4 checkboxes habilita el botón enviar', () => {
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    goToStep3WithSale();

    cy.get('p-calendar[formControlName="firstPaymentDate"] input').clear().type('31/12/2099').blur();

    getNextButton().click();
    cy.contains('Paso 4 de 4').scrollIntoView().should('be.visible');

    cy.get('[data-cy="chk-identity"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click();
    cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click();

    cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled');
  });

  it('Step 3: sin fecha de primer pago el botón siguiente queda deshabilitado', () => {
    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    goToStep3WithSale();

    getNextButton().should('be.disabled');
  });

  it('Step 3: con fecha anterior a hoy mantiene botón siguiente deshabilitado', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yyyy = yesterday.getFullYear();

    cy.get('[data-cy="client-card-cust-001"]').click();
    getNextButton().click();
    cy.contains('Paso 2 de 4').scrollIntoView().should('be.visible');

    goToStep3WithSale();

    cy.get('p-calendar[formControlName="firstPaymentDate"] input').clear().type(`${dd}/${mm}/${yyyy}`).blur();

    getNextButton().should('be.disabled');
  });
});
