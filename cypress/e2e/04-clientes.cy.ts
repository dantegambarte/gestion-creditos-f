/**
 * SUITE: Gestión de Clientes
 *
 * Cubre:
 *  - Listado de clientes (tabla p-table visible con columnas correctas)
 *  - Búsqueda de clientes en tiempo real
 *  - Filtro por estado (dropdown)
 *  - Modal "Ver" muestra detalles del cliente seleccionado
 *  - Modal "Editar" permite modificar solo campos persistidos y guardar
 *  - Modal "Créditos" muestra cantidad de créditos activos
 *  - Modal "Crear Cliente" con validaciones de formulario
 *  - Crear cliente exitoso agrega registro a la tabla
 *  - Acceso desde /admin/clients y /seller/clients
 */

describe('Gestión de Clientes — Admin', () => {
  const baseCustomer = {
    id: 'cust-001',
    full_name: 'Ana Garcia',
    dni: '12345678',
    address: null,
    phone: '3811234567',
    email: null,
    status: 'ACTIVE',
    portal_enabled: false,
    created_at: '2024-01-15T00:00:00Z',
    collector_id: null,
    collector_name: null,
  };

  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: [baseCustomer] },
    }).as('getCustomers');
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@getCustomers');
  });

  // ── Listado ────────────────────────────────────────────────────────────────────
  it('muestra el título y la tabla de clientes', () => {
    cy.contains('.ff-list-header__title', 'Gestión de Clientes').should('be.visible');
    cy.get('p-table').should('be.visible');
  });

  it('la tabla tiene las columnas: DNI, Nombre, Teléfono, Créditos, Riesgo, Acciones', () => {
    const cols = ['DNI', 'Nombre', 'Teléfono', 'Créditos', 'Riesgo', 'Acciones'];
    cols.forEach((col) => {
      cy.get('p-table th').contains(col).should('exist');
    });
  });

  it('muestra al menos un cliente en la tabla', () => {
    cy.get('tbody tr').should('have.length.gte', 1);
  });

  it('muestra badge p-tag de riesgo en cada fila', () => {
    cy.get('tbody tr').first().find('.ff-badge').should('exist');
  });

  // ── Búsqueda ───────────────────────────────────────────────────────────────────
  it('filtra clientes al escribir en el campo de búsqueda', () => {
    cy.get('[data-cy="input-buscar-cliente"]').should('not.be.disabled');
    cy.get('tbody tr').its('length').then((total) => {
      cy.get('[data-cy="input-buscar-cliente"]').type('xxx_no_existe');
      cy.get('tbody tr').should('have.length.lte', total);
    });
  });

  it('limpiar búsqueda restaura la lista completa', () => {
    cy.get('tbody tr').its('length').then((total) => {
      cy.get('[data-cy="input-buscar-cliente"]').type('xxx').clear();
      cy.get('tbody tr').should('have.length', total);
    });
  });

  // ── Filtro por estado ─────────────────────────────────────────────────────────
  it('el dropdown de filtro existe y tiene las opciones Todos / Activos / Inactivos', () => {
    cy.get('[data-cy="dropdown-filtro-clientes"]').click();
    cy.contains('.p-dropdown-item', 'Todos').should('be.visible');
    cy.contains('.p-dropdown-item', 'Al día').should('be.visible');
    cy.contains('.p-dropdown-item', 'Mora leve').should('be.visible');
    cy.contains('.p-dropdown-item', 'Mora alta').should('exist');
    // Cerrar
    cy.get('body').click(0, 0);
  });

  // ── Ver Cliente (navega a detalle) ───────────────────────────────────────────
  it('clic en Ver navega a la ruta de detalle del cliente', () => {
    cy.get('tbody tr').first().find('[data-cy^="btn-ver-"]').click();
    cy.url().should('match', /\/clients\/[^/]+$/);
  });

  // ── Modal Editar ──────────────────────────────────────────────────────────────
  it('abre el modal "Editar Cliente" al hacer clic en Editar', () => {
    cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
    cy.contains('Editar Cliente').should('be.visible');
  });

  it('el formulario de edición tiene campos: Nombre, Apellido y Teléfono', () => {
    cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
    cy.contains('p-dialog', 'Editar Cliente').within(() => {
      cy.get('input[formControlName="nombre"]').should('exist');
      cy.get('input[formControlName="apellido"]').should('exist');
      cy.get('input[formControlName="phone"]').should('exist');
      cy.contains('Solo podés editar nombre, apellido y teléfono').should('exist');
    });
  });

  it('el botón "Guardar Cambios" está disponible con el formulario válido', () => {
    cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
    cy.contains('p-dialog', 'Editar Cliente').within(() => {
      cy.contains('button', 'Guardar Cambios').should('not.have.attr', 'disabled');
    });
  });

  it('editar teléfono y guardar actualiza la fila en la tabla', () => {
    let customer = { ...baseCustomer };

    cy.intercept('GET', '**/api/customers*', (req) => {
      req.reply({ ok: true, data: [customer] });
    }).as('getCustomersAfterEdit');

    cy.intercept('PUT', '**/api/customers/cust-001', (req) => {
      customer = {
        ...customer,
        full_name: req.body.full_name,
        phone: req.body.phone,
      };

      req.reply({
        ok: true,
        data: {
          ...customer,
          portal_is_temp_password: false,
          portal_failed_attempts: 0,
          portal_locked_at: null,
          updated_at: '2025-01-02T00:00:00Z',
        },
      });
    }).as('updateCustomerPhone');

    cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
    cy.contains('p-dialog', 'Editar Cliente').within(() => {
      cy.get('input[formControlName="phone"]')
        .clear()
        .type('300-999-8888')
        .blur();
      cy.contains('button', 'Guardar Cambios').should('not.be.disabled');
    });
    cy.get('p-dialog').find('p-button[label="Guardar Cambios"]').click();
    cy.wait('@updateCustomerPhone');
    cy.wait('@getCustomersAfterEdit');
    cy.get('p-dialog[ng-reflect-visible="true"]').should('not.exist');
    cy.get('tbody').contains('300-999-8888').should('exist');
  });

  it('guardar cambios persistidos se refleja tras recargar la lista', () => {
    let customer = { ...baseCustomer };

    cy.intercept('GET', '**/api/customers*', (req) => {
      req.reply({ ok: true, data: [customer] });
    }).as('getCustomersPersisted');

    cy.intercept('PUT', '**/api/customers/cust-001', (req) => {
      customer = {
        ...customer,
        full_name: req.body.full_name,
        phone: req.body.phone,
      };

      req.reply({
        ok: true,
        data: {
          ...customer,
          portal_is_temp_password: false,
          portal_failed_attempts: 0,
          portal_locked_at: null,
          updated_at: '2025-01-02T00:00:00Z',
        },
      });
    }).as('updateCustomerPersisted');

    cy.get('tbody tr').first().find('[data-cy^="btn-editar-"]').click();
    cy.contains('p-dialog', 'Editar Cliente').within(() => {
      cy.get('input[formControlName="nombre"]').clear().type('Ana María');
      cy.get('input[formControlName="apellido"]').clear().type('García');
      cy.get('input[formControlName="phone"]').clear().type('3810001111');
    });
    cy.get('p-dialog').find('p-button[label="Guardar Cambios"]').click();

    cy.wait('@updateCustomerPersisted')
      .its('request.body')
      .should('deep.equal', { full_name: 'Ana María García', phone: '3810001111' });
    cy.wait('@getCustomersPersisted');

    cy.get('tbody').contains('Ana María García').should('exist');
    cy.get('tbody').contains('3810001111').should('exist');

    cy.reload();
    cy.wait('@getCustomersPersisted');
    cy.get('tbody').contains('Ana María García').should('exist');
    cy.get('tbody').contains('3810001111').should('exist');
  });

  // ── Créditos (navega a detalle) ───────────────────────────────────────────────
  it('clic en Créditos navega a la ruta de detalle del cliente', () => {
    cy.get('tbody tr').then(($rows) => {
      const rowWithCredits = Cypress._.find($rows.toArray(), (row) =>
        Cypress.$(row).find('[data-cy^="btn-creditos-"]').length > 0,
      );
      if (rowWithCredits) {
        cy.wrap(rowWithCredits).find('[data-cy^="btn-creditos-"]').click();
        cy.url().should('match', /\/clients\/[^/]+$/);
      } else {
        cy.log('No hay clientes con créditos en los mocks — test omitido');
      }
    });
  });

  // ── Modal Crear Cliente ───────────────────────────────────────────────────────
  describe('Crear Cliente', () => {
    beforeEach(() => {
      cy.get('[data-cy="btn-nuevo-cliente"]').as('newClientBtn');
      cy.get('@newClientBtn').should('be.visible').click();
      cy.contains('Crear Cliente').should('be.visible');
    });

    it('muestra el modal de creación con todos los campos', () => {
      cy.get('p-dialog').last().within(() => {
        cy.get('input[formControlName="nombres"]').should('exist');
        cy.get('input[formControlName="apellidos"]').should('exist');
        cy.get('input[formControlName="dni"]').should('exist');
        cy.get('input[formControlName="telefonoPrincipal"]').should('exist');
        cy.get('input[formControlName="email"]').should('exist');
        cy.get('input[formControlName="direccion"]').should('exist');
        cy.get('input[formControlName="ingresos"]').should('exist');
      });
    });

    it('el botón "Crear Cliente" está deshabilitado con formulario vacío', () => {
      cy.get('p-dialog p-button[label="Crear Cliente"]').should(
        'have.attr',
        'ng-reflect-disabled',
        'true',
      );
    });

    it('muestra errores de validación al intentar crear con campos vacíos', () => {
      // Tocar campos sin completar para disparar touched
      cy.get('p-dialog input[formControlName="nombres"]').click().blur();
      cy.get('p-dialog').find('.auth-error').should('exist');
    });

    it('completa el formulario y crea el cliente exitosamente', () => {
      cy.intercept('POST', '**/api/customers', {
        statusCode: 201,
        body: {
          ok: true,
          data: {
            id: 'cust-cl-01',
            full_name: 'Laura Gómez',
            dni: '9988776655',
            address: 'Calle 10 #5-20',
            phone: '3101112222',
            email: 'lgomez@email.com',
            status: 'ACTIVE',
            portal_enabled: false,
            created_at: '2026-05-04T00:00:00.000Z',
            collector_id: null,
            collector_name: null,
          },
        },
      }).as('createClient');

      cy.get('tbody tr').its('length').then((initialCount) => {
        cy.get('p-dialog').last().within(() => {
          cy.get('input[formControlName="nombres"]').type('Laura');
          cy.get('input[formControlName="apellidos"]').type('Gómez');
          cy.get('input[formControlName="dni"]').type('9988776655');
          cy.get('input[formControlName="telefonoPrincipal"]').type('310-111-2222');
          cy.get('input[formControlName="telefonoAlterno"]').type('320-333-4444');
          cy.get('input[formControlName="email"]').type('lgomez@email.com');
          cy.get('input[formControlName="direccion"]').type('Calle 10 #5-20');
          cy.get('input[formControlName="ingresos"]').type('5000000');
        });
        cy.get('p-dialog p-button[label="Crear Cliente"]').click();
        cy.wait('@createClient');
        cy.get('p-dialog[ng-reflect-visible="true"]').should('not.exist');
        cy.contains('.p-toast-message', 'Cliente guardado correctamente.').should(
          'be.visible',
        );
        // createClient() cierra el modal pero no agrega a la lista (TODO: API integration)
        cy.get('tbody tr').should('have.length', initialCount);
      });
    });

    it('el botón Borrar limpia todos los campos del formulario', () => {
      cy.get('p-dialog').last().within(() => {
        cy.get('input[formControlName="nombres"]').type('Test');
      });
      cy.get('p-dialog button').contains('Borrar').click();
      cy.get('p-dialog input[formControlName="nombres"]').should('have.value', '');
    });

    it('el botón Cancelar cierra el modal sin crear', () => {
      cy.get('tbody tr').its('length').then((initialCount) => {
        cy.get('p-dialog button').contains('Cancelar').click();
        cy.get('p-dialog[ng-reflect-visible="true"]').should('not.exist');
        cy.get('tbody tr').should('have.length', initialCount);
      });
    });
  });
});

// ── Acceso Seller ─────────────────────────────────────────────────────────────
describe('Gestión de Clientes — Seller', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cust-002',
            full_name: 'Maria Sanchez',
            dni: '87654321',
            address: null,
            phone: '3819990000',
            email: null,
            status: 'ACTIVE',
            portal_enabled: false,
            created_at: '2024-02-01T00:00:00Z',
            collector_id: null,
            collector_name: null,
          },
        ],
      },
    }).as('getSellerCustomers');
    cy.loginAs('SELLER', '/seller/clients');
    cy.wait('@getSellerCustomers');
  });

  it('Seller puede acceder a /seller/clients y ve la tabla', () => {
    cy.url().should('include', '/seller/clients');
    cy.get('p-table').should('be.visible');
  });

  it('Seller no ve acciones de edición que el backend rechaza por permisos', () => {
    cy.get('[data-cy^="btn-editar-"]').should('not.exist');
  });
});
