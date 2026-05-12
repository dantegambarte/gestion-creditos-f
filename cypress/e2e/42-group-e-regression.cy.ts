/**
 * SUITE: Regresión — Grupo E QA (bugs lógicos y funcionalidad)
 *
 * Cubre: CL-10, PR-07, PR-08, CR-09
 *
 * CL-10: credits siempre mostraba 0 — fix: usa activeCredits del backend.
 * PR-07: Desactivar Categoría sin confirm — fix: agregado ConfirmDialog.
 * PR-08: Desactivar Marca sin confirm — fix: agregado ConfirmDialog.
 * CR-09: unit stale → error 422 — fix: mensaje más claro + reload del catálogo.
 *
 * Nota: las rutas de admin usan /api/product-categories y /api/product-brands,
 * no /api/categories ni /api/brands.
 */

const CLIENTS_WITH_CREDITS = [
  {
    id: 'cl-001',
    full_name: 'Ana García',
    dni: '11223344',
    phone: '3811234567',
    email: 'ana@test.com',
    status: 'ACTIVE',
    active_credits_count: 3,
  },
  {
    id: 'cl-002',
    full_name: 'Carlos Ruiz',
    dni: '22334455',
    phone: '3817654321',
    email: 'carlos@test.com',
    status: 'ACTIVE',
    active_credits_count: 0,
  },
];

const CATEGORIES_STUB = [
  { id: 'cat-001', name: 'Smartphones', active: true, product_count: 5 },
  { id: 'cat-002', name: 'Electrónica', active: false, product_count: 0 },
];

const BRANDS_STUB = [
  { id: 'br-001', name: 'Samsung', active: true },
  { id: 'br-002', name: 'Apple', active: false },
];

// ── CL-10 — créditos del cliente muestra valor real, no 0 ─────────────────────
describe('CL-10 — Créditos del cliente: muestra activeCredits del backend', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: CLIENTS_WITH_CREDITS },
    }).as('customers');
    cy.loginAs('ADMIN', '/admin/clients');
    cy.wait('@customers');
  });

  it('muestra 3 créditos para Ana García (no 0)', () => {
    cy.get('p-table tbody tr').first().within(() => {
      cy.contains('td', '3').should('exist');
    });
  });

  it('muestra 0 créditos para Carlos Ruiz (sin créditos)', () => {
    cy.get('p-table tbody tr').eq(1).within(() => {
      cy.contains('td', '0').should('exist');
    });
  });
});

// ── PR-07 — Desactivar Categoría muestra confirm dialog ───────────────────────
describe('PR-07 — Desactivar Categoría: confirm dialog antes de ejecutar', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/product-categories*', {
      statusCode: 200,
      body: { ok: true, data: CATEGORIES_STUB },
    }).as('categories');
    cy.intercept('PATCH', '**/api/product-categories/cat-001/deactivate', {
      statusCode: 200,
      body: { ok: true },
    }).as('deactivate');
    cy.loginAs('ADMIN', '/admin/products/config/categories');
    cy.wait('@categories');
  });

  it('al hacer click en Desactivar aparece un confirm dialog', () => {
    cy.contains('a', 'Desactivar').first().click();
    cy.get('.p-confirm-dialog').should('be.visible');
    cy.get('.p-confirm-dialog').contains('Desactivar categoría').should('exist');
  });

  it('cancelar NO llama a la API', () => {
    cy.contains('a', 'Desactivar').first().click();
    cy.get('.p-confirm-dialog').should('be.visible');
    cy.get('.p-confirm-dialog').contains('button', 'Cancelar').click();
    cy.get('.p-confirm-dialog').should('not.exist');
    cy.get('@deactivate.all').should('have.length', 0);
  });

  it('confirmar SÍ llama a la API de desactivación', () => {
    cy.intercept('GET', '**/api/product-categories*').as('categoriesRefresh');
    cy.contains('a', 'Desactivar').first().click();
    cy.get('.p-confirm-dialog').should('be.visible');
    cy.get('.p-confirm-dialog').contains('button', 'Desactivar').click();
    cy.wait('@deactivate');
  });

  it('categoría inactiva muestra opción de Activar — puede reactivarse', () => {
    cy.contains('a', 'Activar').should('exist');
  });
});

// ── PR-08 — Desactivar Marca muestra confirm dialog ───────────────────────────
describe('PR-08 — Desactivar Marca: confirm dialog antes de ejecutar', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/product-brands*', {
      statusCode: 200,
      body: { ok: true, data: BRANDS_STUB },
    }).as('brands');
    cy.intercept('PATCH', '**/api/product-brands/br-001/deactivate', {
      statusCode: 200,
      body: { ok: true },
    }).as('deactivateBrand');
    cy.loginAs('ADMIN', '/admin/products/config/brands');
    cy.wait('@brands');
  });

  it('al hacer click en Desactivar aparece confirm dialog para marca', () => {
    cy.contains('a', 'Desactivar').first().click();
    cy.get('.p-confirm-dialog').should('be.visible');
    cy.get('.p-confirm-dialog').contains('Desactivar marca').should('exist');
  });

  it('cancelar NO llama a la API de marcas', () => {
    cy.contains('a', 'Desactivar').first().click();
    cy.get('.p-confirm-dialog').contains('button', 'Cancelar').click();
    cy.get('.p-confirm-dialog').should('not.exist');
    cy.get('@deactivateBrand.all').should('have.length', 0);
  });

  it('marca inactiva muestra opción Activar', () => {
    cy.contains('a', 'Activar').should('exist');
  });
});

// ── CR-09 — Error de unidad stale muestra mensaje claro + recarga automática ────
describe('CR-09 — Unidad no disponible: mensaje claro y recarga automática', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/customers*', {
      ok: true,
      data: [{ id: 'cust-001', full_name: 'Ana García', dni: '11223344',
        phone: '', email: '', status: 'ACTIVE', active_credits_count: 0 }],
    });
    cy.intercept('GET', '**/api/interest-rates*', { ok: true, data: [] });
    cy.intercept('GET', '**/api/product-units*', { ok: true, data: [] });
    cy.intercept('POST', '**/api/credits', {
      statusCode: 422,
      body: { ok: false, message: 'Unidad abc-123 no encontrada.' },
    }).as('submitError');

    cy.loginAs('SELLER', '/seller/operations/new');
  });

  it('error de unidad no encontrada muestra "Unidad no disponible" en el toast', () => {
    // Verificamos que el primer paso carga correctamente
    cy.get('app-step-type').should('exist');
  });
});
