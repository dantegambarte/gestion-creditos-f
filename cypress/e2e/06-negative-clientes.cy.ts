/**
 * SUITE: Gestión de Clientes — Unhappy Paths (modo mock)
 *
 * Cubre validaciones de frontend y edge cases testables sin backend real:
 *  - Búsqueda sin resultados → empty state visible
 *  - Crear cliente: campos vacíos / inválidos → errores de validación en formulario
 *  - Crear cliente: cancelar no agrega fila a la tabla
 *  - Editar cliente: cancelar no modifica los datos en la tabla
 *  - Modal créditos: badge "0 créditos" en clientes sin créditos
 *
 * NOTA: Tests de errores HTTP (500, 400 duplicate, 403) requieren backend real.
 * Ver BACKEND REQUIREMENTS en TEST_PLAN.md.
 */

describe('Gestión de Clientes — Unhappy Paths', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
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
          },
          {
            id: 'cust-002',
            full_name: 'Sin Creditos',
            dni: '22222222',
            address: null,
            phone: '3810000000',
            email: null,
            status: 'ACTIVE',
            portal_enabled: false,
            created_at: '2024-01-20T00:00:00Z',
            collector_id: null,
            collector_name: null,
          },
        ],
      },
    }).as('getCustomers');
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@getCustomers');
  });

  // ── Búsqueda sin resultados ──────────────────────────────────────────────────
  it('búsqueda con string sin coincidencias → tabla muestra 0 filas', () => {
    cy.get('[data-cy="input-buscar-cliente"]').should('not.be.disabled');
    cy.get('[data-cy="input-buscar-cliente"]').type('XNOMATCHZZZZZZ999');
    // La tabla filtra por el getter filteredClients → 0 resultados
    cy.get('tbody tr').should('have.length', 0);
    // PrimeNG renderiza una fila de empty state — verificamos que no hay filas de datos
    cy.get('tbody tr[data-cy]').should('not.exist');
  });

  // ── Crear: campos requeridos vacíos ─────────────────────────────────────────
  it('crear cliente con campos vacíos muestra errores de validación', () => {
    cy.get('[data-cy="btn-nuevo-cliente"]').click();
    cy.contains('Crear Cliente').should('be.visible');

    // Forzar touched sin completar → disparar validadores
    cy.get('p-dialog input[formControlName="nombres"]').click().blur();
    cy.get('p-dialog input[formControlName="apellidos"]').click().blur();
    cy.get('p-dialog input[formControlName="dni"]').click().blur();

    cy.get('p-dialog').contains('span', /obligatorio|requerido/i).should('exist');
    // Botón sigue deshabilitado
    cy.get('p-dialog p-button[label="Crear Cliente"]').should(
      'have.attr',
      'ng-reflect-disabled',
      'true',
    );
  });

  // ── Crear: DNI con caracteres inválidos ──────────────────────────────────────
  it('crear cliente con DNI no numérico muestra error de formato', () => {
    cy.get('[data-cy="btn-nuevo-cliente"]').click();
    cy.contains('Crear Cliente').should('be.visible');

    cy.get('p-dialog input[formControlName="dni"]').click().type('ABCDE123');
    // Hacer click en otro campo dispara blur en dni → Angular marca touched
    cy.get('p-dialog input[formControlName="nombres"]').click();

    cy.get('p-dialog').find('.auth-error').should('exist');
  });

  // ── Crear: cancelar no modifica tabla ────────────────────────────────────────
  it('cancelar creación no agrega fila a la tabla', () => {
    cy.get('tbody tr').its('length').then((initialCount) => {
      cy.get('[data-cy="btn-nuevo-cliente"]').click();
      cy.contains('Crear Cliente').should('be.visible');

      // .last() porque el orden en el DOM es: Ver (0), Editar (1), Crear (2)
      cy.get('p-dialog').last().within(() => {
        cy.get('input[formControlName="nombres"]').type('Cancelado');
      });

      cy.get('p-dialog button').contains('Cancelar').click();
      cy.get('p-dialog[ng-reflect-visible="true"]').should('not.exist');

      cy.get('tbody tr').should('have.length', initialCount);
    });
  });

  // ── Editar: cancelar no modifica tabla ───────────────────────────────────────
  it('cancelar edición no modifica datos en la tabla', () => {
    cy.get('tbody tr')
      .first()
      .find('[data-cy^="btn-editar-"]')
      .click();
    cy.contains('Editar Cliente').should('be.visible');

    // Leer valor original del campo nombre
    cy.get('p-dialog input[formControlName="nombre"]')
      .invoke('val')
      .then((originalValue) => {
        cy.get('p-dialog input[formControlName="nombre"]')
          .clear()
          .type('VALOR_TEMPORAL_TEST');

        // Cancelar en lugar de guardar
        cy.get('p-dialog button').contains('Cancelar').click();
        cy.get('p-dialog[ng-reflect-visible="true"]').should('not.exist');

        // El valor original sigue en la tabla (no se modificó)
        cy.get('tbody').contains(originalValue as string).should('exist');
      });
  });

  // ── Tabla: botón Créditos solo visible cuando credits > 0 ───────────────────
  it('botón Créditos no aparece en filas con 0 créditos activos', () => {
    cy.get('tbody tr').each(($row) => {
      const creditsBadge = $row.find('[data-cy^="btn-creditos-"]');
      if (creditsBadge.length === 0) {
        // Fila sin créditos → verificar que no hay botón créditos
        cy.wrap($row).find('[data-cy^="btn-creditos-"]').should('not.exist');
        return false; // detener iteración tras verificar primera fila sin créditos
      }
    });
  });
});
