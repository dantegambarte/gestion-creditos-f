/**
 * SUITE REAL: Gestión de Clientes (Admin) contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core /api/customers*
 * - Verifica persistencia real en listado + búsqueda + reload
 */

describe('Gestión de Clientes real — Admin', () => {
  /**
   * Genera datos únicos para evitar colisiones con ejecuciones anteriores.
   */
  const buildCustomerData = () => {
    const stamp = Date.now().toString().slice(-6);
    return {
      nombre: `E2E${stamp}`,
      apellido: 'Cliente',
      dni: `6${stamp}1`,
      telefonoInicial: `381${stamp}`,
      telefonoEditado: `382${stamp}`,
      fullName: `E2E${stamp} Cliente`,
    };
  };

  /**
   * Espera a que la pantalla de clientes esté lista para interactuar.
   */
  const waitClientsReady = () => {
    cy.contains('.ff-list-header__title', 'Gestión de Clientes', { timeout: 20000 }).should('be.visible');
    cy.get('p-table', { timeout: 20000 }).should('be.visible');
  };

  /**
   * Devuelve el dialog visible de PrimeNG para evitar supuestos frágiles de header/markup.
   */
  const getVisibleDialog = () => cy.get('.p-dialog:visible', { timeout: 10000 }).first();

  it('crea y edita cliente real con persistencia cruzada', () => {
    const data = buildCustomerData();

    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/clients');
    waitClientsReady();

    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente', { timeout: 10000 }).should('be.visible');
    getVisibleDialog().find('input[formControlName="nombres"]').should('be.visible');

    getVisibleDialog().find('input[formControlName="nombres"]').clear().type(data.nombre);
    getVisibleDialog().find('input[formControlName="apellidos"]').clear().type(data.apellido);
    getVisibleDialog().find('input[formControlName="dni"]').clear().type(data.dni);
    getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').clear().type(data.telefonoInicial);
    cy.contains('p-dialog:visible button', 'Crear Cliente').click();

    cy.contains('.p-toast-message', 'Cliente guardado correctamente.', { timeout: 15000 }).should('be.visible');
    cy.get('.p-dialog:visible').should('not.exist');

    cy.get('[data-cy="input-buscar-cliente"]').clear().type(data.dni);
    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).should('be.visible');
    cy.contains('tbody tr', data.fullName).within(() => {
      cy.contains(data.telefonoInicial).should('be.visible');
      cy.get('[data-cy^="btn-editar-"]').click();
    });

    getVisibleDialog().within(() => {
      cy.get('input[formControlName="telefonoPrincipal"]').clear().type(data.telefonoEditado);
      cy.get('p-button[label="Guardar Cambios"] button').click();
    });

    cy.contains('.p-toast-message', 'Modificación Exitosa.', { timeout: 15000 }).should('be.visible');
    cy.get('.p-dialog:visible').should('not.exist');

    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).within(() => {
      cy.contains(data.telefonoEditado).should('be.visible');
    });

    cy.reload();
    waitClientsReady();
    cy.get('[data-cy="input-buscar-cliente"]').clear().type(data.dni);
    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).within(() => {
      cy.contains(data.telefonoEditado).should('be.visible');
    });
  });
});
