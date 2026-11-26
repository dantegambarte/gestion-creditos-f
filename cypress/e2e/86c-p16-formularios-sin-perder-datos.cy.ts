/**
 * SUITE: P16 — formularios sin perder datos (#47, #48). Todo stubbeado con cy.intercept.
 *
 * Cubre en desktop y mobile (375x667):
 *  - Vaciar un campo opcional del cliente envía '' en el PUT.
 *  - El alta de cliente no ofrece "Teléfono Alterno".
 *  - Editar variante A y luego B muestra los valores de B.
 *  - En carga masiva, el error de la fila 3 queda marcado en esa fila.
 *
 *  - La ficha de cliente ruteada no muestra créditos REJECTED (#47).
 */

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

const CUSTOMER = {
  id: 'cust-001',
  full_name: 'Ana García',
  dni: '12345678',
  phone: '3811234567',
  email: 'ana@mail.com',
  address: 'Av. Principal 100',
  status: 'ACTIVE',
  collector_id: null,
  collector_name: null,
  portal_enabled: false,
  portal_is_temp_password: false,
  portal_failed_attempts: 0,
  portal_locked_at: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

const PRODUCT = {
  id: 'prod-001',
  title: 'Remera',
  description: 'Remera básica',
  model: null,
  brand_id: null,
  category_id: null,
  status: 'ACTIVE',
  created_at: '2024-01-01T00:00:00Z',
  available_count: 0,
  reserved_count: 0,
  sold_count: 0,
  variants: [],
};

/**
 * Arma una variante cruda como la devuelve el backend.
 * @param id - ID de la variante
 * @param color - Color de la variante
 * @param price - Precio actual
 */
function rawVariant(id: string, color: string, price: number) {
  return {
    id,
    product_id: 'prod-001',
    color,
    size: null,
    capacity: null,
    current_price: price,
    status: 'ACTIVE',
    available_count: 1,
    reserved_count: 0,
    sold_count: 0,
  };
}

/**
 * Stubbea producto y variantes y abre la pantalla de variantes como Admin.
 * @param variants - Variantes que devuelve el listado
 */
function openVariants(variants: unknown[]): void {
  cy.intercept('GET', '**/api/products/prod-001', {
    statusCode: 200,
    body: { ok: true, data: PRODUCT },
  });
  cy.intercept('GET', '**/api/product-variants*', {
    statusCode: 200,
    body: { ok: true, data: variants },
  }).as('getVariants');
  cy.loginAs('ADMIN', '/admin/products/prod-001/variants');
  cy.wait('@getVariants');
}

VIEWPORTS.forEach(({ name, width, height }) => {
  describe(`P16 formularios — ${name}`, () => {
    beforeEach(() => {
      cy.viewport(width, height);
    });

    it('vaciar la dirección del cliente envía cadena vacía en el PUT', () => {
      cy.intercept('GET', /\/api\/customers\/12345678/, {
        statusCode: 200,
        body: { ok: true, data: CUSTOMER },
      }).as('customerDetail');
      cy.intercept('GET', /\/api\/credits/, {
        statusCode: 200,
        body: { ok: true, data: [] },
      });
      cy.intercept('GET', '**/api/users*', {
        statusCode: 200,
        body: { ok: true, data: [] },
      });
      cy.intercept('PUT', '**/api/customers/cust-001', {
        statusCode: 200,
        body: { ok: true, data: { ...CUSTOMER, address: '' } },
      }).as('updateCustomer');

      cy.loginAs('ADMIN', '/seller/clients/12345678');
      cy.wait('@customerDetail');
      cy.get('[data-cy="seller-client-detail-edit-action"] button').click();
      cy.get('input[formControlName="address"]').clear();
      cy.get('[data-cy="seller-client-detail-save-action"] button').click();

      cy.wait('@updateCustomer')
        .its('request.body')
        .should((body) => {
          expect(body).to.have.property('address', '');
          expect(body).to.have.property('email', 'ana@mail.com');
        });
    });

    it('la ficha del cliente no muestra créditos REJECTED (#47)', () => {
      /**
       * Crédito crudo del listado con el estado y monto dados.
       * @param {string} id - id del crédito
       * @param {string} status - estado de backend
       * @param {number} total - monto total (identifica la fila en la UI)
       */
      const rawCredit = (id: string, status: string, total: number) => ({
        id,
        type: 'LOAN',
        total_amount: total,
        installments_count: 6,
        payment_frequency: 'WEEKLY',
        interest_rate: 10,
        status,
        created_at: '2026-02-01T00:00:00Z',
        approved_at: null,
        customer_id: 'cust-001',
        customer_name: 'Ana García',
        customer_dni: '12345678',
        created_by_id: 'usr-002',
        created_by_name: 'Maria Sanchez',
      });
      cy.intercept('GET', /\/api\/customers\/12345678/, {
        statusCode: 200,
        body: { ok: true, data: CUSTOMER },
      }).as('customerDetail');
      cy.intercept('GET', /\/api\/credits/, {
        statusCode: 200,
        body: {
          ok: true,
          data: [
            rawCredit('crd-active', 'ACTIVE', 111000),
            rawCredit('crd-rejected', 'REJECTED', 999000),
          ],
        },
      }).as('customerCredits');

      cy.loginAs('ADMIN', '/seller/clients/12345678');
      cy.wait('@customerDetail');
      cy.wait('@customerCredits');

      const container =
        width < 768
          ? '[data-cy="client-credits-history-mobile-card"]'
          : '[data-cy="client-credits-history-table"] tbody tr';
      cy.get(container).should('have.length', 1).first().scrollIntoView();
      cy.contains(container, /111[.,]000/).scrollIntoView().should('be.visible');
      cy.get('body')
        .invoke('text')
        .should('not.match', /999[.,]000/);
      cy.get('body').should('not.contain', 'Rechazado');
    });

    it('el alta de cliente no ofrece Teléfono Alterno', () => {
      cy.intercept('GET', /\/api\/customers(\?.*)?$/, {
        statusCode: 200,
        body: { ok: true, data: [] },
      }).as('listCustomers');
      cy.intercept('GET', '**/api/users*', {
        statusCode: 200,
        body: { ok: true, data: [] },
      });

      cy.loginAs('ADMIN', '/admin/clients');
      cy.wait('@listCustomers');
      cy.get('[data-cy="btn-nuevo-cliente"] button', { timeout: 15000 }).click({
        force: true,
      });

      cy.get('input[formControlName="telefonoPrincipal"]').should('exist');
      cy.get('input[formControlName="telefonoAlterno"]').should('not.exist');
      cy.contains('Teléfono Alterno').should('not.exist');
    });

    it('editar la variante A y luego la B muestra los valores de B', () => {
      openVariants([rawVariant('var-a', 'Rojo', 1000), rawVariant('var-b', 'Azul', 2500)]);

      const container = name === 'mobile' ? '[data-cy="product-variants-mobile-card"]' : 'tbody tr';
      const clickEdit = (color: string) =>
        cy.contains(container, color).contains('a', 'Editar').click({ force: true });

      clickEdit('Rojo');
      cy.get('input[formControlName="color"]').should('have.value', 'Rojo');

      clickEdit('Azul');
      cy.get('input[formControlName="color"]').should('have.value', 'Azul');
      cy.contains('Editar variante').should('exist');
    });

    it('en carga masiva el error de la fila 3 queda en la fila correcta', () => {
      openVariants([]);
      cy.intercept('POST', '**/api/product-variants', (req) => {
        if (req.body.color === 'Verde') {
          req.reply({ statusCode: 409, body: { ok: false, message: 'Variante duplicada' } });
        } else {
          req.reply({
            statusCode: 201,
            body: { ok: true, data: rawVariant('new', req.body.color, 100) },
          });
        }
      }).as('createVariant');

      cy.contains('button', 'Nueva variante').click({ force: true });
      cy.contains('button', 'Ingresar múltiples').click();

      const colorInputs = 'input[placeholder="Ej: Negro"]';
      cy.get(colorInputs).then(($inputs) => {
        for (let i = $inputs.length; i < 3; i += 1) {
          cy.contains('button', '+ Agregar fila').click();
        }
      });

      ['Rojo', 'Azul', 'Verde'].forEach((color, index) => {
        cy.get(colorInputs).eq(index).type(color);
        cy.get('p-inputnumber[mode="currency"] input').eq(index).type('100');
      });

      cy.contains('button', /Confirmar 3 variantes/).click();
      cy.wait(['@createVariant', '@createVariant', '@createVariant']);

      cy.get(colorInputs).should('have.length', 1);
      cy.get(colorInputs).eq(0).should('have.value', 'Verde').and('have.class', 'ng-invalid');
      cy.contains('small', 'Variante duplicada').should('be.visible');
    });
  });
});
