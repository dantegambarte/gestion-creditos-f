/**
 * SUITE: Detalle de Crédito (real backend)
 *
 * Precondición: el seed debe tener al menos una operación visible para el rol.
 * Si no hay filas, el helper falla explícitamente en vez de dejar pasar el test.
 */

/**
 * Abre el detalle del primer crédito del listado; falla si no hay filas o no navega.
 * @param {RegExp} detailPath - patrón de la ruta de detalle esperada
 */
function openFirstCreditDetailFromOperations(detailPath: RegExp): void {
  cy.get('tbody tr', { timeout: 15000 })
    .should('have.length.greaterThan', 0, 'precondición: hay operaciones en el seed')
    .first()
    .click();
  cy.location('pathname', { timeout: 15000 }).should('match', detailPath);
  cy.get('app-error-state').should('not.exist');
}

const SELLER_DETAIL = /^\/seller\/operations\/[^/]+$/;

describe('Detalle de Crédito — Seller (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/operations');
  });

  it('lista de operaciones carga sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/operations');
    cy.get('app-error-state').should('not.exist');
  });

  it('se puede abrir el detalle de un crédito y volver', () => {
    openFirstCreditDetailFromOperations(SELLER_DETAIL);
    cy.contains('button', 'Volver').should('be.visible').click();
    cy.location('pathname').should('eq', '/seller/operations');
  });

  it('seller no ve acciones administrativas en detalle', () => {
    openFirstCreditDetailFromOperations(SELLER_DETAIL);
    cy.contains('button', 'Volver').should('be.visible');
    cy.contains('button', 'Aprobar').should('not.exist');
    cy.contains('button', 'Rechazar').should('not.exist');
  });

  it('seller no ve informacion financiera sensible en el detalle', () => {
    openFirstCreditDetailFromOperations(SELLER_DETAIL);
    cy.contains('button', 'Volver').should('be.visible');
    // Etiquetas del bloque financiero que deben quedar ocultas al vendedor.
    cy.contains('Tasa de interés').should('not.exist');
    cy.contains('Monto financiado').should('not.exist');
    cy.contains('Total de interés').should('not.exist');
    cy.contains('th', 'Precio hist.').should('not.exist');
  });
});

describe('Detalle de Crédito — Admin (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/seller/operations');
  });

  it('admin puede abrir detalle desde operaciones', () => {
    openFirstCreditDetailFromOperations(SELLER_DETAIL);
    cy.contains('button', 'Volver').should('be.visible');
  });

  it('admin sí ve informacion financiera en un crédito financiado', function () {
    openFirstCreditDetailFromOperations(SELLER_DETAIL);
    cy.contains('button', 'Volver').should('be.visible');
    cy.get('body').then(($body) => {
      // Sólo aplica a créditos financiados ("Total a devolver"); si el primero
      // no lo es, se marca como pendiente explícitamente en vez de pasar vacío.
      if (!$body.text().includes('Total a devolver')) {
        this.skip();
      }
      cy.contains('Monto financiado').should('be.visible');
    });
  });
});
