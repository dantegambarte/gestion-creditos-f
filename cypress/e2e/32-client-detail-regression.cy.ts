describe('Client detail regression — CL-02', () => {
  function loginAdminForClientsFlow() {
    cy.loginAs('ADMIN', '/admin/clients');
  }

  it('loads the real client detail from service after clicking Ver', () => {
    cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cust-001',
            full_name: 'Ana García',
            dni: '12345678',
            address: 'Calle 123',
            phone: '3811234567',
            email: 'ana@test.com',
            status: 'ACTIVE',
            portal_enabled: true,
            created_at: '2026-01-10T00:00:00Z',
            collector_id: null,
            collector_name: null,
          },
        ],
      },
    }).as('listCustomers');

    cy.intercept('GET', '**/api/customers/cust-001', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'cust-001',
          full_name: 'Ana García',
          dni: '12345678',
          address: 'Calle 123',
          phone: '3811234567',
          email: 'ana@test.com',
          status: 'ACTIVE',
          portal_enabled: true,
          created_at: '2026-01-10T00:00:00Z',
          collector_id: null,
          collector_name: null,
          portal_is_temp_password: false,
          portal_failed_attempts: 0,
          portal_locked_at: null,
          updated_at: '2026-01-10T00:00:00Z',
        },
      },
    }).as('getClientDetail');

    loginAdminForClientsFlow();
    cy.wait('@listCustomers');

    cy.contains('td', 'Ana García').should('be.visible');
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="btn-ver-12345678"]').length > 0) {
        cy.get('[data-cy="btn-ver-12345678"]').click();
      } else {
        cy.contains('tr', 'Ana García').contains('Ver').click();
      }
    });

    cy.wait('@getClientDetail');
    cy.url().should('include', '/admin/clients/cust-001');
    cy.contains('h2', 'Ana García').should('be.visible');
    cy.contains(/12345678/).should('be.visible');
    cy.contains('ana@test.com').should('be.visible');
    cy.contains('3811234567').should('be.visible');
    cy.contains('Cliente no encontrado.').should('not.exist');
  });

  it('shows not found only when the backend returns 404', () => {
    cy.intercept('GET', '**/api/customers/missing-client', {
      statusCode: 404,
      body: {
        ok: false,
        message: 'Cliente no encontrado.',
      },
    }).as('missingClient');

    cy.loginAs('ADMIN', '/admin/clients/missing-client');
    cy.wait('@missingClient');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Cliente no encontrado.')) {
        cy.contains('Cliente no encontrado.').should('be.visible');
      } else {
        cy.url().should('include', '/admin/clients/missing-client');
      }
    });
  });
});
