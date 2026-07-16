const managementLogResponse = {
  ok: true,
  data: [
    {
      event_type: 'NO_PAYMENT',
      event_id: 'attempt-001',
      created_at: '2026-05-26T14:30:00.000Z',
      next_visit_date: null,
      reason: 'CLIENT_NO_MONEY',
      notes: 'Vuelve a pasar mañana',
      amount: null,
      payment_status: null,
      payment_method: null,
      is_reversal: false,
      admin_direct: false,
      rejection_reason: null,
      collector_name: 'Juan Pedraza',
      voided_at: null,
      voided_by_name: null,
    },
  ],
};

/**
 * Configura las respuestas mock necesarias para abrir una planilla de cobrador.
 */
function interceptCollectionSheetDetail(): void {
  cy.fixture('collection-sheet-detail.json').then((response) => {
    const firstItem = response.data.items[0];
    const extraItems = Array.from({ length: 18 }, (_, index) => ({
      ...firstItem,
      order_number: index + 3,
      installment_id: `inst-long-${index + 1}`,
      customer_name: `Cliente Panel ${index + 1}`,
      customer_dni: `900000${index + 1}`,
      customer_phone: `38155500${index + 1}`,
      collection_reference: `Cuota ${index + 1} de 18 · prueba de panel mobile`,
    }));
    response.data.items = [...response.data.items, ...extraItems];
    response.data.total_items = response.data.items.length;

    cy.intercept('GET', '**/api/collections/sheet-001', response).as(
      'collectionSheetDetail',
    );
  });
  cy.intercept('GET', '**/api/installments/inst-001/management-log', managementLogResponse).as(
    'managementLog',
  );
}

/**
 * Abre el detalle de planilla como cobrador en el viewport indicado.
 */
function visitCollectionSheetDetail(width: number, height: number): void {
  cy.viewport(width, height);
  interceptCollectionSheetDetail();
  cy.loginAs('COLLECTOR', '/collector/route/sheet-001');
  cy.wait('@collectionSheetDetail');
}

describe('Collector Sheet Detail — Payment Panel', () => {
  it('Desktop — abre el panel de cobro desde una fila y muestra acciones e historial', () => {
    visitCollectionSheetDetail(1280, 720);

    cy.get('[data-cy="sheet-detail-table"]').should('be.visible');
    cy.get('[data-cy="sheet-detail-table-row"]').first().click();

    cy.get('[data-cy="sheet-payment-panel"]').should('be.visible');
    cy.get('[data-cy="sheet-payment-panel-customer"]').should('contain', 'Ana García');
    cy.get('[data-cy="sheet-payment-panel-summary"]').within(() => {
      cy.contains('Cuota').should('be.visible');
      cy.contains('Saldo total').should('be.visible');
    });
    cy.contains('button', 'Registrar pre-carga').should('be.visible');
    cy.contains('button', 'No pagó').should('be.visible');
    cy.contains('button', 'No encontrado').should('be.visible');

    cy.get('[data-cy="sheet-payment-panel-toggle-log"]').click();
    cy.wait('@managementLog');
    cy.get('[data-cy="sheet-payment-panel-log-list"]').should('contain', 'No pagó');
  });

  it('Mobile — abre el panel desde una card sin overflow horizontal', () => {
    visitCollectionSheetDetail(375, 667);

    cy.get('[data-cy="sheet-detail-table"]').should('not.be.visible');
    cy.get('[data-cy="sheet-detail-mobile-list"]').should('be.visible');
    cy.get('[data-cy="sheet-detail-mobile-card"]')
      .eq(12)
      .scrollIntoView()
      .should('be.visible')
      .then(($card) => {
        const initialTop = $card[0].getBoundingClientRect().top;

        cy.wrap($card).click();

        cy.get('[data-cy="sheet-payment-panel"]').should('exist');
        cy.get('[data-cy="sheet-payment-panel-customer"]').should(
          'contain',
          'Cliente Panel 11',
        );

        cy.get('[data-cy="sheet-payment-panel-close"]').click({ force: true });
        cy.wrap(null).should(() => {
          expect($card[0].getBoundingClientRect().top).to.be.closeTo(
            initialTop,
            24,
          );
        });
      });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});
