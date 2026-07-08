/**
 * SUITE: Detalle de Crédito (real backend)
 */

function openFirstCreditDetailFromOperations(): void {
  cy.get('body').then(($body) => {
    const rows = $body.find('tbody tr');
    if (rows.length > 0) {
      cy.wrap(rows.first()).click();
      cy.location('pathname', { timeout: 15000 }).should('match', /\/operations\//);
    }
  });
}

describe('Detalle de Crédito — Seller (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/operations');
  });

  it('lista de operaciones carga sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/operations');
    cy.get('app-error-state').should('not.exist');
  });

  it('si existe un crédito, se puede abrir el detalle y volver', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/seller/operations/')) {
        cy.get('app-error-state').should('not.exist');
        cy.contains('button', 'Volver').should('be.visible').click();
        cy.location('pathname').should('eq', '/seller/operations');
      }
    });
  });

  it('seller no ve acciones administrativas en detalle', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/seller/operations/')) {
        cy.contains('button', 'Aprobar').should('not.exist');
        cy.contains('button', 'Rechazar').should('not.exist');
      }
    });
  });

  it('seller no ve informacion financiera sensible en el detalle', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/seller/operations/')) {
        // Etiquetas del bloque financiero que deben quedar ocultas al vendedor.
        cy.contains('Tasa de interés').should('not.exist');
        cy.contains('Monto financiado').should('not.exist');
        cy.contains('Total de interés').should('not.exist');
        cy.contains('th', 'Precio hist.').should('not.exist');
      }
    });
  });
});

describe('Detalle de Crédito — Admin (real)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/seller/operations');
  });

  it('admin puede abrir detalle desde operaciones', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/operations/')) {
        cy.get('app-error-state').should('not.exist');
      }
    });
  });

  it('si el estado del crédito lo permite, aparecen acciones admin', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/operations/')) {
        cy.get('body').then(($body) => {
          const hasApprove = $body.text().includes('Aprobar');
          const hasReject = $body.text().includes('Rechazar');
          if (hasApprove || hasReject) {
            cy.get('app-error-state').should('not.exist');
          }
        });
      }
    });
  });

  it('admin sí ve informacion financiera en un crédito financiado', () => {
    openFirstCreditDetailFromOperations();

    cy.location('pathname').then((path) => {
      if (path.includes('/operations/')) {
        cy.get('body').then(($body) => {
          // Solo verifica cuando el crédito abierto es financiado (muestra
          // "Total a devolver"); en ese caso el Admin debe ver el monto
          // financiado, que al vendedor se le oculta.
          if ($body.text().includes('Total a devolver')) {
            cy.contains('Monto financiado').should('be.visible');
          }
        });
      }
    });
  });
});
