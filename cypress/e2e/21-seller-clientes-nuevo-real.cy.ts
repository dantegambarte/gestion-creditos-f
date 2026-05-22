/**
 * SUITE REAL: Seller — Lista y creación de clientes contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core /api/customers*
 * - Verifica alta real y persistencia en listado + reload
 */

describe('Seller clientes real', () => {
  /**
   * Arma un set de datos únicos para alta de cliente real.
   */
  const buildCustomerData = () => {
    const stamp = Date.now().toString().slice(-6);
    const letters = stamp
      .split('')
      .map((digit) => String.fromCharCode(65 + Number(digit)))
      .join('');
    return {
      fullName: `Seller E2E ${letters}`,
      dni: `7${stamp}2`,
      phone: `383${stamp}`,
    };
  };

  /**
   * Espera componentes base de la lista de seller.
   */
  const waitSellerListReady = () => {
    cy.get('[data-cy="seller-clients-table"], p-table', { timeout: 20000 }).should('be.visible');
  };

  /**
   * Escribe en un input reconsultando el DOM para evitar detached elements.
   */
  const typeStable = (selector: string, value: string) => {
    cy.get(selector, { timeout: 15000 }).should('be.visible').clear();
    cy.get(selector, { timeout: 15000 }).should('be.visible').type(value);
  };

  it('crea cliente real desde /seller/clients/new y persiste en listado', () => {
    const data = buildCustomerData();

    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/clients/new');
    cy.location('pathname', { timeout: 15000 }).should('not.eq', '/change-password');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/clients/new');

    cy.contains('h2', 'Nuevo cliente', { timeout: 15000 }).should('be.visible');
    typeStable('input[formControlName="fullName"]', data.fullName);
    typeStable('input[formControlName="dni"]', data.dni);
    typeStable('input[formControlName="address"]', `Calle ${data.dni}`);
    typeStable('input[formControlName="phone"]', data.phone);
    typeStable('input[formControlName="email"]', `seller.${data.dni}@e2e.local`);
    cy.contains('button', 'Registrar cliente').click();

    cy.contains('.p-toast-message', 'Cliente registrado correctamente.', { timeout: 15000 }).should('be.visible');
    cy.location('pathname', { timeout: 15000 }).should('match', /^\/seller\/clients\/[^/]+$/);

    cy.visit('/seller/clients');
    waitSellerListReady();

    typeStable('[data-cy="seller-clients-search-input"]', data.dni);
    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).within(() => {
      cy.contains(data.phone).should('be.visible');
    });

    cy.reload();
    waitSellerListReady();
    typeStable('[data-cy="seller-clients-search-input"]', data.dni);
    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).should('be.visible');
  });
});
