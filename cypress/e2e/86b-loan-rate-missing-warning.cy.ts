/**
 * SUITE STUB: Aviso de tasa inexistente en préstamo (#51 · P14).
 *
 * Cuando el préstamo elegido no tiene una tasa activa aplicable, el paso de
 * condiciones debe avisar (`msg-loan-rate-missing`) en lugar de simular al 0%.
 * Todo el backend se stubea con cy.intercept; no requiere API real.
 */

const NEW_OP_URL = '/admin/operations/new';

const CUSTOMERS_STUB = {
  ok: true,
  data: [
    {
      id: 'cust-p14',
      full_name: 'Ana García',
      dni: '11223344',
      phone: '3811234567',
      email: 'ana@test.com',
      status: 'ACTIVE',
      active_credits_count: 0,
      risk: 'LOW',
      collector_id: null,
      collector_name: null,
      address: null,
      portal_enabled: false,
      portal_is_temp_password: false,
      portal_failed_attempts: 0,
      portal_locked_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
};

/**
 * Construye una tasa de préstamo en formato API (snake_case).
 * @param {boolean} active - Si la tasa está activa.
 * @returns {object} Tasa cruda tal como la devuelve el backend.
 */
function loanRate(active: boolean): object {
  return {
    id: active ? 'rate-active' : 'rate-inactive',
    payment_frequency: 'MONTHLY',
    installments_count: 6,
    min_amount: 0,
    max_amount: null,
    rate: 0.3,
    active,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

/**
 * Stubea el backend y abre el wizard de nueva operación como ADMIN.
 * @param {object[]} rates - Tasas que devuelve GET /interest-rates.
 */
function openWizard(rates: object[]): void {
  cy.intercept('GET', '**/api/credits*', { ok: true, data: [] });
  cy.intercept('GET', '**/api/products*', { ok: true, data: [] });
  cy.intercept('GET', '**/api/product-units*', { ok: true, data: [] });
  cy.intercept('GET', '**/api/customers*', CUSTOMERS_STUB);
  cy.intercept('GET', '**/api/interest-rates*', { ok: true, data: rates });
  cy.loginAs('ADMIN', NEW_OP_URL);
}

/**
 * Pulsa el botón "Siguiente" visible: el de desktop o el del header mobile.
 */
function clickNext(): void {
  cy.get('[data-cy="btn-siguiente"] button, [data-cy="btn-siguiente-mobile"] button')
    .filter(':visible')
    .first()
    .should('not.be.disabled')
    .click();
}

/**
 * Recorre tipo préstamo → cliente → monto → condiciones y elige 6 cuotas.
 */
function goToConditionsAndPickInstallments(): void {
  cy.get('[data-cy="btn-type-loan"]', { timeout: 20000 }).click();
  cy.get('[data-cy="client-card-cust-p14"]', { timeout: 20000 }).click();
  clickNext();
  cy.get('p-inputNumber[formControlName="totalAmount"] input')
    .clear()
    .type('50000')
    .blur();
  clickNext();
  cy.get('[data-cy="ddl-installments"] .p-dropdown', { timeout: 15000 })
    .first()
    .click();
  cy.get('.p-dropdown-panel .p-dropdown-item').first().click();
}

const viewports: { name: string; apply: () => void }[] = [
  { name: 'desktop', apply: () => cy.viewport(1280, 800) },
  { name: 'mobile', apply: () => cy.viewport(375, 667) },
];

viewports.forEach(({ name, apply }) => {
  describe(`#51 — aviso de tasa inexistente en préstamo (${name})`, () => {
    beforeEach(() => apply());

    it('muestra el aviso cuando la única tasa aplicable está inactiva', () => {
      openWizard([loanRate(false)]);
      goToConditionsAndPickInstallments();
      cy.get('[data-cy="msg-loan-rate-missing"]')
        .should('be.visible')
        .and('contain.text', 'No hay una tasa activa configurada');
    });

    it('no muestra el aviso cuando existe una tasa activa aplicable', () => {
      openWizard([loanRate(true)]);
      goToConditionsAndPickInstallments();
      cy.get('[data-cy="ddl-installments"]').should('be.visible');
      cy.get('[data-cy="msg-loan-rate-missing"]').should('not.exist');
    });
  });
});
