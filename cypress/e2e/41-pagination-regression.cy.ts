/**
 * SUITE: Regresión — Paginación (Grupo D QA)
 *
 * Cubre: CR-17, CL-08
 *
 * Root cause: p-table en operations.component y clients.component
 *   no tenía [paginator]="true". Se mostraban todos los registros sin
 *   paginación. Fix: agregado paginator con rows=10.
 *
 * Verificación: el paginador existe en el DOM y navegar a la página 2
 *   muestra el rango correcto de registros.
 */

/** Genera N operaciones de stub */
function makeOperations(n: number) {
  const frequencies = ['MONTHLY', 'WEEKLY', 'BIWEEKLY'];
  return Array.from({ length: n }, (_, i) => ({
    id: `op-${i + 1}`,
    customer_name: `Cliente ${i + 1}`,
    customer_dni: `${10000000 + i}`,
    type: i % 2 === 0 ? 'SALE' : 'LOAN',
    total_amount: 50000 + i * 1000,
    installments_count: 6,
    payment_frequency: frequencies[i % 3],
    interest_rate: 10,
    status: 'ACTIVE',
    created_at: '2026-05-01T10:00:00Z',
  }));
}

/** Genera N clientes de stub */
function makeClients(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `cl-${i + 1}`,
    full_name: `Cliente Apellido ${i + 1}`,
    dni: `${20000000 + i}`,
    phone: `381${String(i).padStart(7, '0')}`,
    email: `cliente${i + 1}@test.com`,
    risk: 'LOW',
    active_credits_count: 0,
    status: 'ACTIVE',
  }));
}

// ── CR-17 — Paginación de operaciones (Seller) ────────────────────────────────
describe('CR-17 — Paginación de operaciones (Seller)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: { ok: true, data: makeOperations(25) },
    }).as('operations');
    cy.loginAs('SELLER', '/seller/operations');
    cy.wait('@operations');
  });

  it('el paginador existe en la tabla de operaciones', () => {
    cy.get('.p-paginator').should('exist').and('be.visible');
  });

  it('inicialmente muestra 10 registros (primera página)', () => {
    cy.get('p-table tbody tr').should('have.length', 10);
  });

  it('navegar a la página 2 muestra los siguientes 10 registros', () => {
    cy.get('.p-paginator').contains('button', '2').click();
    cy.get('p-table tbody tr').should('have.length', 10);
    // El primer cliente de la pág 2 debe ser el 11
    cy.get('p-table tbody tr').first().should('contain', 'Cliente 11');
  });

  it('la última página muestra los registros restantes (25 total → pág 3 = 5)', () => {
    cy.get('.p-paginator .p-paginator-last').click();
    cy.get('p-table tbody tr').should('have.length', 5);
  });

  it('el informe de página muestra el rango correcto', () => {
    cy.get('.p-paginator-current').should('contain', '1–10 de 25');
  });
});

// ── CL-08 — Paginación de clientes (Seller/Collector) ─────────────────────────
describe('CL-08 — Paginación de clientes (Seller)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: { ok: true, data: makeClients(22) },
    }).as('customers');
    cy.loginAs('SELLER', '/seller/clients');
    cy.wait('@customers');
  });

  it('el paginador existe en la tabla de clientes', () => {
    cy.get('.p-paginator').should('exist').and('be.visible');
  });

  it('inicialmente muestra 10 clientes (primera página)', () => {
    cy.get('p-table tbody tr').should('have.length', 10);
  });

  it('navegar a la página 2 muestra los siguientes 10 clientes', () => {
    cy.get('.p-paginator').contains('button', '2').click();
    cy.get('p-table tbody tr').should('have.length', 10);
  });

  it('la última página muestra los 2 clientes restantes (22 total → pág 3 = 2)', () => {
    cy.get('.p-paginator .p-paginator-last').click();
    cy.get('p-table tbody tr').should('have.length', 2);
  });

  it('el informe de página muestra el rango correcto', () => {
    cy.get('.p-paginator-current').should('contain', '1–10 de 22');
  });

  it('cambiar a 25 filas muestra todos los registros en una sola página', () => {
    cy.get('.p-paginator .p-dropdown').click();
    // El dropdown del paginator NO usa appendTo="body", el panel está en el DOM normal
    cy.get('.p-dropdown-panel').contains('.p-dropdown-item', '25').click();
    cy.get('p-table tbody tr').should('have.length', 22);
  });
});
