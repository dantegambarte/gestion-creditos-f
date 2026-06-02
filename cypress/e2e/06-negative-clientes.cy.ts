/**
 * SUITE REAL: Gestión de Clientes — Unhappy Paths (backend real).
 *
 * Reglas:
 * - Usa login real
 * - No mockea /api/customers*
 * - Verifica errores/validaciones con estado real de la UI
 */

describe('Gestión de Clientes real — Unhappy Paths', () => {
  /**
   * Espera a que la pantalla de clientes esté lista para interactuar.
   */
  const waitClientsReady = () => {
    cy.contains('.ff-list-header__title', 'Gestión de Clientes', { timeout: 20000 }).should('be.visible');
    cy.get('p-table', { timeout: 20000 }).should('be.visible');
  };

  /**
   * Devuelve el dialog visible de PrimeNG para evitar selectores frágiles.
   */
  const getVisibleDialog = () => cy.get('.p-dialog:visible', { timeout: 10000 }).first();

  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/clients');
    waitClientsReady();
  });

  // ── Búsqueda sin resultados ──────────────────────────────────────────────────
  it('búsqueda con string sin coincidencias → tabla muestra 0 filas', () => {
    const searchValue = `NO_MATCH_${Date.now()}`;
    cy.get('[data-cy="input-buscar-cliente"]').should('not.be.disabled');
    cy.get('[data-cy="input-buscar-cliente"]').clear().type(searchValue);
    cy.get('tbody tr').should('have.length', 0);
    cy.get('tbody tr[data-cy]').should('not.exist');
  });

  // ── Crear: campos requeridos vacíos ─────────────────────────────────────────
  it('crear cliente con campos vacíos muestra errores de validación', () => {
    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().find('input[formControlName="nombres"]').should('be.visible');

    getVisibleDialog().find('input[formControlName="nombres"]').click().blur();
    getVisibleDialog().find('input[formControlName="apellidos"]').click().blur();
    getVisibleDialog().find('input[formControlName="dni"]').click().blur();

    getVisibleDialog().contains('span', /obligatorio|requerido/i).should('exist');
    getVisibleDialog().find('p-button[label="Crear Cliente"]').should(
      'have.attr',
      'ng-reflect-disabled',
      'true',
    );
  });

  // ── Crear: DNI con caracteres inválidos ──────────────────────────────────────
  it('crear cliente con DNI no numérico muestra error de formato', () => {
    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente').should('be.visible');

    getVisibleDialog().find('input[formControlName="dni"]').click().type('ABCDE123');
    getVisibleDialog().find('input[formControlName="nombres"]').click();

    getVisibleDialog().find('.auth-error').should('exist');
  });

  // ── Crear: cancelar no persiste ──────────────────────────────────────────────
  it('cancelar creación no persiste cliente nuevo', () => {
    const stamp = Date.now().toString().slice(-6);
    const dni = `7${stamp}3`;

    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente').should('be.visible');

    getVisibleDialog().find('input[formControlName="nombres"]').clear().type(`Cancel${stamp}`);
    getVisibleDialog().find('input[formControlName="apellidos"]').clear().type('Cliente');
    getVisibleDialog().find('input[formControlName="dni"]').clear().type(dni);
    getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').clear().type(`381${stamp}`);
    getVisibleDialog().contains('button.p-button', 'Cancelar').click();

    cy.get('.p-dialog:visible').should('not.exist');
    cy.get('[data-cy="input-buscar-cliente"]').clear().type(dni);
    cy.get('tbody tr').should('have.length', 0);
  });

  // ── Crear: DNI duplicado real ────────────────────────────────────────────────
  it('crear cliente con DNI duplicado muestra error backend y mantiene modal abierto', () => {
    const stamp = Date.now().toString().slice(-6);
    const duplicateDni = `8${stamp}4`;

    cy.apiCreateCustomer({
      full_name: `Duplicado Neg ${stamp}`,
      dni: duplicateDni,
      address: 'Calle Duplicado 200',
      phone: `389${stamp}`,
    });

    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente').should('be.visible');

    getVisibleDialog().find('input[formControlName="nombres"]').clear().type('Duplicado');
    getVisibleDialog().find('input[formControlName="apellidos"]').clear().type('Negativo');
    getVisibleDialog().find('input[formControlName="dni"]').clear().type(duplicateDni);
    getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').clear();
    getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').type(`381${stamp}`).blur();
    getVisibleDialog().find('input[formControlName="direccion"]').clear();
    getVisibleDialog().find('input[formControlName="direccion"]').type(`Calle Negativa ${stamp}`);

    getVisibleDialog()
      .contains('button.p-button', 'Crear Cliente')
      .should('be.visible')
      .and('not.be.disabled')
      .click();

    cy.contains('.p-toast-message', 'Ya existe un cliente con ese DNI.', { timeout: 10000 }).should('be.visible');
    cy.get('.p-dialog:visible').should('exist');
  });
});
