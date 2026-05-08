/**
 * SUITE: Producto — Detalle, Editar, Variantes, Unidades
 *
 * Estrategia: el stub genérico devuelve [] para /api/products/:id.
 * Registramos intercepts específicos ANTES de loginAs (que también registra,
 * pero en Cypress los intercepts más recientes tienen prioridad LIFO).
 *
 * Cubre:
 *  - ProductDetailComponent: título, tags, botones, grid de datos
 *  - ProductEditComponent: formulario con campos, validación, cancelar
 *  - ProductVariantsComponent: tabla de variantes, botón nueva variante (admin)
 *  - ProductUnitsComponent: tabla de unidades, botones alta/masiva (admin)
 */

const PRODUCT_MOCK = {
  id: 'prod-001',
  title: 'Moto Eléctrica X1',
  description: 'Vehículo eléctrico de 2 ruedas',
  model: 'X1-2026',
  status: 'ACTIVE',
  brandId: 'brand-001',
  brandName: 'EcoMoto',
  categoryId: 'cat-001',
  categoryName: 'Vehículos',
  variants: [
    { id: 'var-001', color: 'Rojo', size: null, capacity: null, currentPrice: 500000, availableCount: 5, reservedCount: 1, soldCount: 2, status: 'ACTIVE' },
  ],
};

function stubProduct() {
  cy.intercept('GET', '**/api/products/prod-001*', {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_MOCK },
  }).as('productDetail');

  cy.intercept('GET', '**/api/product-variants*', {
    statusCode: 200,
    body: { ok: true, data: PRODUCT_MOCK.variants },
  }).as('variants');

  cy.intercept('GET', '**/api/product-variants/var-001*', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'var-001',
        color: 'Rojo',
        size: null,
        capacity: null,
        current_price: 500000,
        status: 'ACTIVE',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        product_id: 'prod-001',
        product_name: 'Moto Eléctrica X1',
        title: 'Moto Eléctrica X1',
        model: 'X1-2026',
        product_status: 'ACTIVE',
        brand_id: 'brand-001',
        brand_name: 'EcoMoto',
        available_count: 5,
        reserved_count: 1,
        sold_count: 2,
      },
    },
  }).as('variantDetail');

  cy.intercept('GET', '**/api/product-brands*', {
    statusCode: 200,
    body: { ok: true, data: [{ id: 'brand-001', name: 'EcoMoto', active: true }] },
  }).as('brands');

  cy.intercept('GET', '**/api/product-categories*', {
    statusCode: 200,
    body: { ok: true, data: [{ id: 'cat-001', name: 'Vehículos', active: true }] },
  }).as('categories');

  cy.intercept('GET', '**/api/product-units*', {
    statusCode: 200,
    body: { ok: true, data: [] },
  }).as('units');
}

describe('Producto — Detalle (/seller/products/prod-001)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubProduct();
    cy.loginAs('ADMIN', '/seller/products/prod-001');
    cy.wait('@productDetail');
  });

  it('muestra el título del producto', () => {
    cy.contains('Moto Eléctrica X1').should('exist');
  });

  it('muestra el tag de estado Activo', () => {
    cy.contains('.ff-badge', 'Activo').should('exist');
  });

  it('muestra el botón "Ver variantes"', () => {
    cy.contains('button', 'Ver variantes').should('exist');
  });

  it('Admin ve el botón "Editar"', () => {
    cy.contains('button', 'Editar').should('exist');
  });

  it('Admin ve botón "Desactivar" (producto activo)', () => {
    cy.contains('button', 'Desactivar').should('exist');
  });

  it('muestra acción de volver a productos', () => {
    cy.contains('a', 'Productos').should('be.visible');
  });

  it('"Ver variantes" navega a /variants', () => {
    cy.contains('button', 'Ver variantes').click();
    cy.url().should('include', '/variants');
  });
});

describe('Producto — Editar (/seller/products/prod-001/edit)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubProduct();
    cy.loginAs('ADMIN', '/seller/products/prod-001/edit');
    cy.wait('@productDetail');
    cy.wait('@brands');
    cy.wait('@categories');
  });

  it('muestra el título "Editar producto"', () => {
    cy.contains('h2', 'Editar producto').should('be.visible');
  });

  it('tiene el campo título', () => {
    cy.get('input[id="title"]').should('exist');
  });

  it('el campo título viene prellenado', () => {
    cy.get('input[id="title"]').should('have.value', 'Moto Eléctrica X1');
  });

  it('tiene el campo descripción (textarea)', () => {
    cy.get('textarea[id="description"]').should('exist');
  });

  it('tiene el campo modelo', () => {
    cy.get('input[id="model"]').should('exist');
  });

  it('muestra botones Guardar y Cancelar', () => {
    cy.contains('button', 'Guardar Cambios').should('exist');
    cy.contains('button', 'Cancelar').should('exist');
  });

  it('Cancelar navega de vuelta al detalle', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('include', '/seller/products/prod-001');
    cy.url().should('not.include', '/edit');
  });

  it('limpiar el campo título deshabilita Guardar', () => {
    cy.get('input[id="title"]').should('be.visible').then(($input) => {
      cy.wrap($input).clear();
    });
    cy.contains('button', 'Guardar Cambios').should('be.disabled');
  });
});

describe('Producto — Variantes (/seller/products/prod-001/variants)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubProduct();
    cy.loginAs('ADMIN', '/seller/products/prod-001/variants');
    cy.wait('@variants');
  });

  it('muestra el título "Variantes"', () => {
    cy.contains('Variantes').should('be.visible');
  });

  it('Admin ve el botón "Nueva variante"', () => {
    cy.contains('button', 'Nueva variante').should('exist');
  });

  it('renderiza la tabla de variantes', () => {
    cy.get('p-table').should('exist');
  });

  it('tiene columna Color en la cabecera', () => {
    cy.get('p-table th').contains('VARIANTE').should('exist');
  });

  it('muestra acción de volver al producto', () => {
    cy.contains('a', 'Volver al producto').should('be.visible');
  });
});

describe('Producto — Variantes (Seller sin crear)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubProduct();
    cy.loginAs('SELLER', '/seller/products/prod-001/variants');
    cy.wait('@variants');
  });

  it('Seller NO ve el botón "Nueva variante"', () => {
    cy.contains('button', 'Nueva variante').should('not.exist');
  });
});

describe('Producto — Unidades (/seller/products/prod-001/variants/var-001/units)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    stubProduct();
    cy.loginAs('ADMIN', '/seller/products/prod-001/variants/var-001/units');
    cy.wait('@variantDetail');
    cy.wait('@units');
  });

  it('muestra el título "Unidades"', () => {
    cy.contains('Unidades').should('be.visible');
  });

  it('Admin ve el botón "Alta de unidad"', () => {
    cy.contains('h3', 'Alta individual').should('exist');
  });

  it('Admin ve el botón "Alta masiva"', () => {
    cy.contains('h3', 'Alta masiva').should('exist');
  });

  it('tiene dropdown de filtro por estado', () => {
    cy.contains('button', 'Disponibles').should('exist');
  });

  it('botón Volver regresa a variantes', () => {
    cy.contains('a', 'Volver a variantes').should('be.visible');
  });
});
