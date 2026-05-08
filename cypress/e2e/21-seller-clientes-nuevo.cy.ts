/**
 * SUITE: Seller — Lista y Creación de Clientes (ClientsListComponent / ClientCreateComponent)
 *
 * Difiere de 04-clientes.cy.ts que cubre el componente compartido /admin/clients.
 * Aquí cubrimos las rutas /seller/clients y /seller/clients/new.
 */

describe('Seller — Lista de Clientes (/seller/clients)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cust-1',
            full_name: 'Cliente Demo',
            dni: '44556677',
            address: 'Av Siempre Viva 123',
            phone: '+5491112345678',
            email: 'cliente@demo.com',
            status: 'ACTIVE',
            portal_enabled: true,
            created_at: '2026-02-01T00:00:00Z',
            collector_id: 'usr-003',
            collector_name: 'Juan Pedraza',
          },
        ],
      },
    }).as('customersList');

    cy.loginAs('SELLER', '/seller/clients');
    cy.wait('@customersList');
  });

  it('renderiza sin error', () => {
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra campo de búsqueda', () => {
    cy.get('[data-cy="seller-clients-search-input"]').should('exist');
  });

  it('muestra dropdown de filtro por Estado', () => {
    cy.get('[data-cy="seller-clients-status-filter"]').should('exist');
  });

  it('botón "Nuevo cliente" visible para SELLER', () => {
    cy.get('[data-cy="seller-clients-create-cta"]').should('exist');
  });

  it('clic en "Nuevo cliente" navega a /seller/clients/new', () => {
    cy.get('[data-cy="seller-clients-create-cta"]').click();
    cy.url().should('include', '/clients/new');
  });

  it('muestra tabla, vacío o loading (no error)', () => {
    cy.get('[data-cy="seller-clients-table"]').should('be.visible');
    cy.contains('td', 'Cliente Demo').should('be.visible');
  });
});

describe('Seller — Crear Cliente (/seller/clients/new)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/users*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'usr-003',
            full_name: 'Juan Pedraza',
            dni: '11223344',
            role: 'COLLECTOR',
            status: 'ACTIVE',
            is_temp_password: false,
            failed_attempts: 0,
            locked_at: null,
            last_login_at: null,
            created_at: '2025-01-01T00:00:00Z',
          },
        ],
      },
    }).as('collectors');

    cy.intercept('POST', '**/api/customers', {
      statusCode: 201,
      body: {
        ok: true,
        data: {
          id: 'cust-new-1',
          full_name: 'Cliente Test E2E',
          dni: '55556666',
          address: null,
          phone: null,
          email: null,
          status: 'ACTIVE',
          portal_enabled: false,
          created_at: '2026-05-05T00:00:00Z',
          collector_id: null,
          collector_name: null,
          portal_is_temp_password: false,
          portal_failed_attempts: 0,
          portal_locked_at: null,
          updated_at: '2026-05-05T00:00:00Z',
        },
      },
    }).as('createCustomer');

    cy.loginAs('SELLER', '/seller/clients/new');
    cy.wait('@collectors');
  });

  it('muestra el título "Nuevo cliente"', () => {
    cy.contains('h2', 'Nuevo cliente').should('be.visible');
  });

  it('tiene campo fullName', () => {
    cy.get('input[id="fullName"]').should('exist');
  });

  it('tiene campo DNI', () => {
    cy.get('input[id="dni"]').should('exist');
  });

  it('tiene campo dirección', () => {
    cy.get('input[id="address"]').should('exist');
  });

  it('tiene campo teléfono', () => {
    cy.get('input[id="phone"]').should('exist');
  });

  it('tiene campo email', () => {
    cy.get('input[id="email"]').should('exist');
  });

  it('botón "Registrar cliente" deshabilitado con formulario vacío', () => {
    cy.contains('button', 'Registrar cliente').should('have.attr', 'disabled');
  });

  it('tocar campo fullName sin completar muestra error', () => {
    cy.get('input[id="fullName"]').click().blur();
    cy.get('small.text-red-500').should('exist');
  });

  it('email inválido muestra error', () => {
    cy.get('input[id="email"]').type('noesemail').blur();
    cy.get('small.text-red-500').should('exist');
  });

  it('botón Cancelar navega de vuelta a la lista', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('include', '/seller/clients');
    cy.url().should('not.include', '/new');
  });

  it('formulario mínimo válido habilita "Registrar cliente"', () => {
    cy.get('input[id="fullName"]').type('Cliente Test E2E');
    cy.get('input[id="dni"]').type('55556666');
    cy.contains('button', 'Registrar cliente').should('not.have.attr', 'disabled');
  });

  it('envía alta y muestra toast de éxito', () => {
    cy.get('input[id="fullName"]').type('Cliente Test E2E');
    cy.get('input[id="dni"]').type('55556666');
    cy.contains('button', 'Registrar cliente').click();

    cy.wait('@createCustomer');
    cy.contains('.p-toast-message', 'Cliente registrado correctamente').should('be.visible');
  });
});
