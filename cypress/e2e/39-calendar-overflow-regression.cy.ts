/**
 * SUITE: Regresión — Calendarios con appendTo="body" (Grupo B QA)
 *
 * Cubre: CR-10, CL-05
 *
 * CR-10: p-calendar en step-conditions — iconDisplay="input" + readonlyInput
 *   bloqueaba clicks sobre fechas. Fix: removido iconDisplay="input"; el trigger
 *   es ahora un botón externo separado del input.
 *
 * CL-05: p-calendar en client-historial — sin appendTo="body", el panel era
 *   clipado por .tab-content { overflow-y: auto }. Fix: appendTo="body" + baseZIndex.
 *
 * Verificación: el panel de calendario se adjunta a <body>, es visible y
 *   permite seleccionar una fecha.
 */

const OPERATION_STUBS = {
  credits: { ok: true, data: [] },
  rates: { ok: true, data: [] },
  products: { ok: true, data: [] },
  customers: {
    ok: true,
    data: [
      {
        id: 'cust-001',
        full_name: 'Ana García',
        dni: '11223344',
        phone: '3811234567',
        email: 'ana@test.com',
        risk: 'LOW',
        active_credits_count: 0,
      },
    ],
  },
};

const CLIENT_STUB = {
  id: 'cl-001',
  full_name: 'Ana García',
  dni: '11223344',
  phone: '3811234567',
  email: 'ana@test.com',
  risk: 'LOW',
  active_credits_count: 0,
};

// ── CR-10 — Calendario primer pago en nueva operación ─────────────────────────
describe('CR-10 — Calendario primer pago no clipado y seleccionable', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);

    cy.intercept('GET', '**/api/credits*', { statusCode: 200, body: OPERATION_STUBS.credits }).as('credits');
    cy.intercept('GET', '**/api/rates*', { statusCode: 200, body: OPERATION_STUBS.rates }).as('rates');
    cy.intercept('GET', '**/api/products*', { statusCode: 200, body: OPERATION_STUBS.products }).as('products');
    cy.intercept('GET', '**/api/customers*', { statusCode: 200, body: OPERATION_STUBS.customers }).as('customers');

    cy.loginAs('SELLER', '/seller/operations/new');
  });

  it('panel de calendario se adjunta a body — no queda clipado', () => {
    // Navegar hasta el paso de Condiciones
    // Step 1: elegir tipo
    cy.contains('button', 'Venta').click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });

    // Step 2: elegir cliente
    cy.wait('@customers');
    cy.get('p-table tbody tr').first().click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });

    // Step 3: productos — saltar (préstamo personal para simplificar)
    cy.contains('button', 'Siguiente').click({ force: true });

    // Step 4: Condiciones — el calendario debe estar aquí
    cy.get('p-calendar').should('exist');

    // Abrir el calendario haciendo click en el ícono
    cy.get('p-calendar button.p-button').first().click({ force: true });

    // El panel debe estar en body (no dentro del componente)
    cy.get('body > .p-datepicker').should('be.visible');
  });

  it('clicking una fecha futura selecciona la fecha — CR-10', () => {
    cy.contains('button', 'Venta').click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });
    cy.wait('@customers');
    cy.get('p-table tbody tr').first().click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });
    cy.contains('button', 'Siguiente').click({ force: true });

    cy.get('p-calendar button.p-button').first().click({ force: true });
    cy.get('body > .p-datepicker').should('be.visible');

    // Click en una fecha que no esté deshabilitada
    cy.get('body > .p-datepicker .p-datepicker-calendar td:not(.p-datepicker-other-month):not(.p-disabled) span')
      .first()
      .click();

    // El panel se cierra al seleccionar
    cy.get('body > .p-datepicker').should('not.exist');

    // El input del calendario muestra la fecha seleccionada
    cy.get('p-calendar input').first().should('not.have.value', '');
  });
});

// ── CL-05 — Calendarios de período en historial de cliente ────────────────────
describe('CL-05 — Calendarios de período en historial de cliente (Admin)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);

    cy.intercept('GET', '**/api/clients/11223344', {
      statusCode: 200,
      body: { ok: true, data: CLIENT_STUB },
    }).as('clientDetail');

    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('credits');

    cy.loginAs('ADMIN', '/admin/clients/11223344');
    cy.wait('@clientDetail');
  });

  it('panel de calendario Desde se adjunta a body — no clipado por tab-content', () => {
    // Navegar al tab Historial
    cy.contains('.p-tabview-nav li', 'Historial').click();

    // Abrir el primer calendario (Período Desde)
    cy.get('p-calendar').first().find('button').click({ force: true });

    // Panel debe estar en body
    cy.get('body > .p-datepicker').should('be.visible');
  });

  it('panel de calendario Hasta se adjunta a body', () => {
    cy.contains('.p-tabview-nav li', 'Historial').click();

    // Abrir el segundo calendario (Período Hasta)
    cy.get('p-calendar').eq(1).find('button').click({ force: true });

    cy.get('body > .p-datepicker').should('be.visible');
  });

  it('dropdown de tipo de evento se adjunta a body', () => {
    cy.contains('.p-tabview-nav li', 'Historial').click();

    cy.get('.hist-filter-bar p-dropdown').click();

    cy.get('body > .p-dropdown-panel').should('be.visible');
  });
});
