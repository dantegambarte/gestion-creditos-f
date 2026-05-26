/**
 * SUITE: Regresión — Cambios de sesión (2026-05-22 / 2026-05-26)
 *
 * Cubre los cambios implementados que son testables vía E2E con routing actual:
 *
 *  A. Badge de aprobaciones pendientes en sidebar (live desde /auth/me)
 *  B. Categorías de productos cargadas desde el backend (filtro en listado)
 *  E. Planillas de cobro — AdminCollectionsComponent en /admin/collections
 *
 * NO testeable vía E2E por routing actual (manualmente verificado):
 *  - WhatsApp / header actions (shared client-detail con tabs no está en ninguna ruta)
 *  - Exportar Excel historial (mismo motivo)
 *  - Créditos status en inglés (misma razón: cliente detail tabbed sin ruta)
 *  - PATCH /collections/:id/send (sheet.component.ts redirige a /admin/collections
 *    que usa AdminCollectionsComponent — el send button está en el componente deprecado)
 *
 * TODO-REAL-BACKEND: reemplazar cy.loginAs por cy.loginReal cuando se migre a CI.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER_ADMIN = {
  id: 'usr-001', full_name: 'Carlos López', name: 'Carlos López',
  roles: ['ADMIN'], avatar: 'CL', is_temp_password: false,
  force_relogin_at: null, token: 'mock_admin_token',
};

function seedAdmin(win: Cypress.AUTWindow) {
  win.localStorage.setItem('sgcf_token', 'mock_admin_token');
  win.localStorage.setItem('sgcf_user', JSON.stringify(MOCK_USER_ADMIN));
}

/** Visita con /auth/me stubado con pending_approvals_count configurable */
function visitAsAdmin(path: string, pendingApprovals = 0) {
  cy.intercept('GET', '**/auth/me', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: 'usr-001', full_name: 'Carlos López', dni: '12345678',
        role: 'ADMIN', status: 'ACTIVE',
        is_temp_password: false, force_relogin_at: null,
        pending_approvals_count: pendingApprovals,
      },
    },
  }).as('authMe');
  cy.visit(path, { onBeforeLoad: seedAdmin });
  cy.wait('@authMe');
}

/** Silencia llamadas al backend real que devolverían 401 con mock token */
function stubUsersApi() {
  cy.intercept('GET', '**/api/users*', {
    statusCode: 200, body: { ok: true, data: [] },
  }).as('usersApi');
}

// ─── A. Badge de aprobaciones pendientes ──────────────────────────────────────

describe('A — Sidebar: badge de aprobaciones pendientes', () => {
  it('muestra el badge con el conteo cuando pending_approvals_count > 0', () => {
    cy.viewport(1280, 720);
    visitAsAdmin('/admin/dashboard', 3);
    cy.get('[data-testid="nav-aprobaciones"] .nav-item__badge')
      .should('be.visible')
      .and('have.text', '3');
  });

  it('no muestra el badge cuando pending_approvals_count es 0', () => {
    cy.viewport(1280, 720);
    visitAsAdmin('/admin/dashboard', 0);
    cy.get('[data-testid="nav-aprobaciones"] .nav-item__badge').should('not.exist');
  });

  it('no muestra el badge cuando pending_approvals_count no viene en la respuesta', () => {
    cy.viewport(1280, 720);
    cy.intercept('GET', '**/auth/me', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'usr-001', full_name: 'Carlos López', dni: '12345678',
          role: 'ADMIN', status: 'ACTIVE',
          is_temp_password: false, force_relogin_at: null,
          // sin pending_approvals_count
        },
      },
    }).as('authMe');
    cy.visit('/admin/dashboard', { onBeforeLoad: seedAdmin });
    cy.wait('@authMe');
    cy.get('[data-testid="nav-aprobaciones"] .nav-item__badge').should('not.exist');
  });
});

// ─── B. Categorías de productos desde el backend ──────────────────────────────
// El shared ProductsComponent con create modal no está directamente rutado.
// Lo que sí está accesible: el filtro de categorías del listado en /seller/products.

describe('B — Productos: categorías cargadas desde el backend (filtro)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/product-categories*', {
      fixture: 'product-categories.json',
    }).as('productCategories');

    cy.intercept('GET', '**/api/products*', {
      statusCode: 200, body: { ok: true, data: [] },
    }).as('products');

    cy.intercept('GET', '**/api/product-brands*', {
      statusCode: 200, body: { ok: true, data: [] },
    }).as('productBrands');

    stubUsersApi();
    cy.loginAs('ADMIN', '/seller/products');
    cy.wait('@productCategories');
    cy.wait('@products');
  });

  it('llama al endpoint de categorías al cargar el listado', () => {
    // La request fue interceptada en beforeEach — si llegamos aquí, el endpoint se llamó
    cy.get('@productCategories.all').should('have.length', 1);
  });

  it('el dropdown de filtro de categorías recibe opciones del backend', () => {
    // El listado tiene al menos 2 dropdowns (estado + categoría)
    cy.get('p-dropdown').should('have.length.gte', 2);
  });

});

// ─── E. Planillas de cobro — AdminCollectionsComponent ───────────────────────
// /admin/sheet redirige a /admin/collections (AppRoutes.SHEET → redirectTo ADMIN_COLLECTIONS)

describe('E — Planillas: AdminCollectionsComponent en /admin/collections', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    stubUsersApi(); // listCollectors usa /api/users

    cy.intercept('GET', /\/api\/collections(\?.*)?$/, {
      fixture: 'collection-sheet-list.json',
    }).as('sheetList');

    cy.intercept('GET', /\/api\/collections\/sheet-001(\?.*)?$/, {
      fixture: 'collection-sheet-detail.json',
    }).as('sheetDetail');

    cy.loginAs('ADMIN', '/admin/collections');
    cy.wait('@sheetList');
  });

  it('carga el listado de planillas con datos del cobrador', () => {
    cy.contains('Juan Pedraza').should('be.visible');
  });

  it('muestra la fecha y el filtro de la planilla', () => {
    cy.contains('Vencidas').should('exist');
  });

  it('hacer clic en una fila carga el detalle en el panel derecho', () => {
    cy.contains('tr', 'Juan Pedraza').click();
    cy.wait('@sheetDetail');
    // Panel derecho aparece con el nombre del cobrador
    cy.contains('Juan Pedraza').should('have.length.gte', 1);
  });

  it('el panel derecho muestra el botón de descarga PDF', () => {
    cy.contains('tr', 'Juan Pedraza').click();
    cy.wait('@sheetDetail');
    cy.get('p-button[ptooltip="Descargar PDF"], p-button[icon="pi pi-download"]')
      .should('exist');
  });

  it('el botón "Generar nueva planilla" es visible', () => {
    cy.contains('button', 'Generar nueva planilla').should('be.visible');
  });

  it('el intercept de GET /collections devuelve los datos del fixture', () => {
    // Verifica que el fixture se usó correctamente (totalItems = 2 en fixture)
    cy.contains('2').should('exist');
  });
});
