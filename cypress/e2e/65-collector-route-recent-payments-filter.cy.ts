/**
 * SUITE: Collector — Mi Ruta pide solo los cobros de la planilla actual (#65)
 *
 * Cubre:
 *  - GET /payments sale con created_from = día de la planilla actual (filtro en backend)
 *  - Sin planilla actual no se piden cobros (antes descargaba todos los pagos)
 *  - Desktop y mobile (375x667)
 *
 * Planillas y cobros se stubbean para que la ventana sea determinística.
 */

/**
 * Fecha local de hoy en ISO (yyyy-mm-dd).
 * @returns {string} fecha local de hoy
 */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Planilla cruda mínima de hoy, generada al mediodía local.
 * @returns {object} planilla como la devuelve el backend
 */
function rawSheetToday() {
  const created = new Date();
  created.setHours(12, 0, 0, 0);
  return {
    id: 'sheet-65',
    sheet_date: todayIso(),
    filter_used: 'TODAY_AND_OVERDUE',
    status: 'ACTIVE',
    created_at: created.toISOString(),
    sent_at: null,
    collector_id: 'col-1',
    collector_name: 'Cobrador',
    total_items: 0,
    generated_by_name: 'Admin',
  };
}

const VIEWPORTS: Array<[string, number, number]> = [
  ['desktop', 1280, 720],
  ['mobile', 375, 667],
];

VIEWPORTS.forEach(([label, width, height]) => {
  describe(`Collector — Mi Ruta filtra cobros por fecha de registro (${label})`, () => {
    beforeEach(() => {
      cy.viewport(width, height);
      cy.loginReal('COLLECTOR', '/collector/route');
    });

    it('pide /payments con created_from del día de la planilla actual', () => {
      cy.intercept('GET', '**/collections', {
        statusCode: 200,
        body: { ok: true, data: [rawSheetToday()] },
      }).as('sheets');
      cy.intercept('GET', '**/payments*', { statusCode: 200, body: { ok: true, data: [] } }).as(
        'payments',
      );
      cy.visit('/collector/route');
      cy.wait('@sheets');
      cy.wait('@payments').then(({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('created_from')).to.eq(todayIso());
      });
      cy.get('[data-cy="collector-route-collection-summary"]').should('be.visible');
    });

    it('sin planilla actual no pide cobros', () => {
      let paymentsCalls = 0;
      cy.intercept('GET', '**/collections', { statusCode: 200, body: { ok: true, data: [] } }).as(
        'sheets',
      );
      cy.intercept('GET', '**/payments*', (req) => {
        paymentsCalls += 1;
        req.reply({ statusCode: 200, body: { ok: true, data: [] } });
      });
      cy.visit('/collector/route');
      cy.wait('@sheets');
      cy.contains('Mi Ruta').should('exist');
      cy.then(() => expect(paymentsCalls).to.eq(0));
    });
  });
});
