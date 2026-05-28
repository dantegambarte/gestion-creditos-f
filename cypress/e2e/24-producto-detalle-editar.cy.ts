/**
 * SUITE: Producto — Detalle/Editar/Variantes/Unidades (real backend)
 */

function openFirstProductDetailIfExists(): void {
  cy.get('body').then(($body) => {
    const rows = $body.find('p-table tbody tr');
    if (rows.length > 0) {
      cy.wrap(rows.first()).click();
      cy.location('pathname', { timeout: 15000 }).should('match', /^\/seller\/products\//);
    }
  });
}

describe('Producto — Detalle y Edición (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/seller/products');
  });

  it('listado de productos carga sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/products');
    cy.get('app-error-state').should('not.exist');
  });

  it('si hay producto, abre detalle y muestra acciones base', () => {
    openFirstProductDetailIfExists();
    cy.location('pathname').then((path) => {
      if (/\/seller\/products\/.+/.test(path)) {
        cy.get('app-error-state').should('not.exist');
        cy.contains('button', /editar|variantes/i).should('exist');
      }
    });
  });

  it('si hay producto, editar y cancelar vuelve al detalle', () => {
    openFirstProductDetailIfExists();
    cy.location('pathname').then((path) => {
      if (/\/seller\/products\/.+/.test(path)) {
        cy.contains('button', 'Editar').click();
        cy.location('pathname').should('include', '/edit');
        cy.contains('button', 'Cancelar').click();
        cy.location('pathname').should('match', /^\/seller\/products\//);
      }
    });
  });
});

describe('Producto — Variantes y Unidades (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/seller/products');
  });

  it('si hay producto, navega a variantes', () => {
    openFirstProductDetailIfExists();
    cy.location('pathname').then((path) => {
      if (/\/seller\/products\/.+/.test(path)) {
        cy.contains('button', 'Ver variantes').click();
        cy.location('pathname').should('include', '/variants');
      }
    });
  });

  it('en variantes, seller no ve creación', () => {
    cy.loginReal('SELLER', '/seller/products');
    openFirstProductDetailIfExists();
    cy.location('pathname').then((path) => {
      if (/\/seller\/products\/.+/.test(path)) {
        cy.contains('button', 'Ver variantes').click();
        cy.location('pathname').should('include', '/variants');
        cy.contains('button', 'Nueva variante').should('not.exist');
      }
    });
  });
});
