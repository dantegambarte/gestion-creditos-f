/**
 * SUITE REAL: Gestión de Clientes (Admin) contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core /api/customers*
 * - Verifica persistencia real en listado + búsqueda + reload
 *
 * Cubre:
 * - CU03 principal: crear + editar cliente con persistencia cruzada
 * - CU03 alternativo: intento de crear con DNI duplicado → error 409
 * - Acceso por rol: Seller ve tabla sin botones de edición
 */

describe('Gestión de Clientes real — Admin', () => {
  before(() => {
    // Establece la conexión del browser con el dev server antes del primer test.
    // Previene ECONNREFUSED en Windows cuando localhost resuelve a ::1 (IPv6)
    // pero Cypress intenta 127.0.0.1 (IPv4) en la primera visita del spec.
    cy.visit('/login');
  });

  /**
   * Genera datos únicos para evitar colisiones con ejecuciones anteriores.
   */
  const buildCustomerData = () => {
    const stamp = Date.now().toString().slice(-6);
    // nombre solo acepta letras (Validators.pattern /^[a-zA-Z...]+$/)
    const letters = 'ABCDEFGHIJ';
    const stampLetters = stamp.split('').map(d => letters[+d]).join('');
    return {
      nombre: `Test${stampLetters}`,
      apellido: 'Cliente',
      dni: `6${stamp}1`,
      telefonoInicial: `381${stamp}`,
      telefonoEditado: `382${stamp}`,
      direccion: 'Calle Test 123',
      fullName: `Test${stampLetters} Cliente`,
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

  /**
   * Hace click en el botón principal del modal re-consultando el DOM visible.
   * Evita referencias stale cuando PrimeNG/Angular re-renderiza durante actionability.
   * @param {string} label - Texto exacto del botón a presionar.
   */
  const clickVisibleDialogButton = (label: string) => {
    cy.contains('.p-dialog:visible button.p-button', label, { timeout: 10000 })
      .should('be.visible')
      .and('not.be.disabled');

    cy.contains('.p-dialog:visible button.p-button', label, { timeout: 10000 }).click();
  };

  it('CU03 principal: crea y edita cliente real con persistencia cruzada', () => {
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
    getVisibleDialog().find('input[formControlName="direccion"]').clear().type(data.direccion);
    clickVisibleDialogButton('Crear Cliente');

    cy.contains('.p-toast-message', 'Cliente guardado correctamente.', { timeout: 15000 }).should('be.visible');
    cy.get('.p-dialog:visible').should('not.exist');

    cy.get('[data-cy="input-buscar-cliente"]').clear().type(data.dni);
    cy.contains('tbody tr', data.fullName, { timeout: 15000 }).should('be.visible');
    cy.contains('tbody tr', data.fullName).within(() => {
      cy.contains(data.telefonoInicial).should('be.visible');
      cy.get('[data-cy^="btn-editar-"]').click();
    });

    // Esperar a que el edit dialog esté listo y el form pre-poblado.
    // Las assertions de nombre/apellido también sirven de timing: Angular necesita
    // un tick para re-bindear el nuevo editForm y actualizar [disabled]="editForm.invalid".
    cy.contains('.p-dialog:visible .p-dialog-title', 'Editar Cliente', { timeout: 10000 }).should('be.visible');
    cy.get('.p-dialog:visible input[formControlName="nombre"]', { timeout: 5000 }).should('have.value', data.nombre);
    cy.get('.p-dialog:visible input[formControlName="apellido"]').should('have.value', data.apellido);

    cy.get('.p-dialog:visible input[formControlName="phone"]').clear().type(data.telefonoEditado);
    clickVisibleDialogButton('Guardar Cambios');

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

  it('CU03 alternativo: DNI duplicado muestra error y mantiene el modal abierto', () => {
    const stamp = Date.now().toString().slice(-6);
    const duplicateDni = `5${stamp}9`;

    cy.apiCreateCustomer({
      full_name: `Duplicado ${stamp}`,
      dni: duplicateDni,
      address: 'Calle Duplicado 100',
      phone: `380${stamp}`,
    });

    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/clients');
    waitClientsReady();

    cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
    getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente', { timeout: 10000 }).should('be.visible');

    getVisibleDialog().find('input[formControlName="nombres"]').clear().type('Dup');
    getVisibleDialog().find('input[formControlName="apellidos"]').clear().type('Cliente');
    getVisibleDialog().find('input[formControlName="dni"]').clear().type(duplicateDni);
    getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').clear().type(`381${stamp}`);
    getVisibleDialog().find('input[formControlName="direccion"]').clear().type('Calle Dup 100');
    clickVisibleDialogButton('Crear Cliente');

    cy.contains('.p-toast-message', 'Ya existe un cliente con ese DNI.', { timeout: 10000 }).should('be.visible');
    cy.get('.p-dialog:visible').should('exist');
  });

  // ── Regresión: Tabla y filtros ────────────────────────────────────────────────
  describe('Tabla y filtros', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.loginReal('ADMIN', '/admin/clients');
      waitClientsReady();
      cy.get('tbody tr', { timeout: 15000 }).should('have.length.gte', 1);
    });

    it('la tabla tiene las columnas: DNI, Nombre, Teléfono, Créditos, Riesgo, Acciones', () => {
      const cols = ['DNI', 'Nombre', 'Teléfono', 'Créditos', 'Riesgo', 'Acciones'];
      cols.forEach((col) => {
        cy.get('p-table th').contains(col).should('exist');
      });
    });

    it('muestra badge .ff-badge en la primera fila', () => {
      cy.get('tbody tr').first().find('.ff-badge').should('exist');
    });

    it('filtra clientes al escribir en el campo de búsqueda', () => {
      cy.get('[data-cy="input-buscar-cliente"]').should('not.be.disabled');
      cy.get('tbody tr').its('length').then((total) => {
        cy.get('[data-cy="input-buscar-cliente"]').type('zzz_no_existe_xyz');
        cy.get('tbody tr').should('have.length.lte', total);
      });
    });

    it('limpiar búsqueda restaura la lista completa', () => {
      cy.get('tbody tr').its('length').then((total) => {
        cy.get('[data-cy="input-buscar-cliente"]').type('zzz').clear();
        cy.get('tbody tr').should('have.length', total);
      });
    });

    it('el dropdown de filtro tiene las opciones: Todos, Al día, Mora leve, Mora alta', () => {
      cy.get('[data-cy="dropdown-filtro-clientes"]').click();
      cy.contains('.p-dropdown-item', 'Todos').should('be.visible');
      cy.contains('.p-dropdown-item', 'Al día').should('be.visible');
      cy.contains('.p-dropdown-item', 'Mora leve').should('be.visible');
      cy.contains('.p-dropdown-item', 'Mora alta').should('exist');
      cy.get('body').click(0, 0);
    });

    it('clic en btn-ver navega a la ruta de detalle del cliente', () => {
      cy.get('tbody tr').first().find('[data-cy^="btn-ver-"]').click();
      cy.url().should('match', /\/clients\/[^/]+$/);
    });
  });

  // ── Regresión: Modal Editar Cliente ──────────────────────────────────────────
  describe('Modal Editar Cliente — estructura', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.loginReal('ADMIN', '/admin/clients');
      waitClientsReady();
      cy.get('tbody tr', { timeout: 15000 }).should('have.length.gte', 1);
      cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
      cy.contains('.p-dialog:visible .p-dialog-title', 'Editar Cliente', { timeout: 10000 }).should('be.visible');
      // Barrera Angular: espera a que el form esté pre-poblado antes de interactuar
      cy.get('.p-dialog:visible input[formControlName="nombre"]', { timeout: 5000 }).should('not.have.value', '');
    });

    it('el formulario de edición tiene campos nombre, apellido y phone', () => {
      getVisibleDialog().find('input[formControlName="nombre"]').should('exist');
      getVisibleDialog().find('input[formControlName="apellido"]').should('exist');
      getVisibleDialog().find('input[formControlName="phone"]').should('exist');
    });

    it('el botón "Guardar Cambios" no está deshabilitado con el formulario pre-poblado', () => {
      cy.contains('.p-dialog:visible button.p-button', 'Guardar Cambios', { timeout: 5000 })
        .should('not.be.disabled');
    });
  });

  // ── Regresión: Modal Crear Cliente ────────────────────────────────────────────
  describe('Modal Crear Cliente — validaciones', () => {
    beforeEach(() => {
      cy.viewport(1280, 720);
      cy.loginReal('ADMIN', '/admin/clients');
      waitClientsReady();
      cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({ force: true });
      getVisibleDialog().contains('.p-dialog-title', 'Crear Cliente', { timeout: 10000 }).should('be.visible');
    });

    it('muestra los campos del formulario de creación', () => {
      getVisibleDialog().find('input[formControlName="nombres"]').should('exist');
      getVisibleDialog().find('input[formControlName="apellidos"]').should('exist');
      getVisibleDialog().find('input[formControlName="dni"]').should('exist');
      getVisibleDialog().find('input[formControlName="telefonoPrincipal"]').should('exist');
      getVisibleDialog().find('input[formControlName="email"]').should('exist');
      getVisibleDialog().find('input[formControlName="direccion"]').should('exist');
    });

    it('el botón "Crear Cliente" está deshabilitado con el formulario vacío', () => {
      cy.contains('.p-dialog:visible button.p-button', 'Crear Cliente', { timeout: 5000 })
        .should('be.disabled');
    });

    it('muestra errores de validación al tocar un campo vacío', () => {
      getVisibleDialog().find('input[formControlName="nombres"]').click().blur();
      cy.get('.p-dialog:visible .auth-error').should('exist');
    });

    it('el botón Cancelar cierra el modal sin crear', () => {
      cy.contains('.p-dialog:visible button', 'Cancelar').click();
      cy.get('.p-dialog:visible').should('not.exist');
    });
  });
});

describe('Gestión de Clientes real — Seller', () => {
  before(() => {
    cy.visit('/login');
  });

  it('Seller ve la tabla de clientes sin botones de edición', () => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/clients');
    cy.get('p-table', { timeout: 20000 }).should('be.visible');
    cy.get('[data-cy^="btn-editar-"]').should('not.exist');
  });
});
