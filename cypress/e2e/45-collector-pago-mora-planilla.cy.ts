/**
 * SUITE: Collector — Pago de cuota con mora acumulada desde la planilla (P11, #45)
 *
 * Cubre:
 *  - El diálogo de cobro usa el saldo VIVO (con mora) y no el snapshot de la planilla
 *  - Pagar el saldo vivo completo es pago total: no pide ni envía next_visit_date
 *  - Pago parcial sigue exigiendo próxima visita
 *  - Cuota sin mora: pagar el saldo completo sigue siendo total
 *  - Desktop y mobile (375x667)
 *
 * El detalle de planilla y el POST /payments se stubbean: la mora generada
 * después de armar la planilla no se puede fabricar de forma determinística
 * contra el backend real.
 */

const SHEET_ID = 'sheet-p11';

/**
 * Fecha local de hoy en ISO (la planilla sólo es operable si es del día).
 * @returns {string} yyyy-mm-dd en hora local
 */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Arma un ítem crudo de planilla: snapshot 1000 y capa viva configurable.
 * @param {string} id - installment_id
 * @param {number} liveDue - amount_due vivo (con mora)
 * @param {number} livePenalty - mora viva
 * @returns {object} ítem crudo como lo devuelve el backend
 */
function rawItem(id: string, liveDue: number, livePenalty: number) {
  return {
    order_number: 1,
    planned_amount: 1000,
    inclusion_criteria: 'OVERDUE',
    inclusion_reason: null,
    op_priority: 2,
    remaining_amount: 1000,
    antecedent_id: null,
    antecedent_type: null,
    antecedent_date: null,
    antecedent_notes: null,
    next_visit_date: null,
    has_pending_payment: false,
    installment_id: id,
    installment_number: 2,
    due_date: '2026-01-10',
    amount_due: 1000,
    amount_paid: 0,
    penalty_amount: 0,
    installment_status: 'OVERDUE',
    credit_id: `credit-${id}`,
    credit_type: 'LOAN',
    collection_reference: 'Cuota 2 de 6 · préstamo de $6.000',
    customer_name: `Cliente ${id}`,
    customer_phone: null,
    customer_address: 'Calle 123',
    customer_dni: '30111222',
    management_status: 'PENDING',
    additional_installments_count: 0,
    live: {
      installment_status: 'OVERDUE',
      amount_due: liveDue,
      amount_paid: 0,
      penalty_amount: livePenalty,
      credit_pending_balance: liveDue,
      has_pending_payment: false,
      today_attempt_id: null,
      today_attempt_type: null,
      renewable: false,
    },
  };
}

/**
 * Stubbea el detalle de planilla y el alta de pago; devuelve el alias del POST.
 * @param {object} item - ítem crudo a mostrar en la planilla
 */
function stubSheet(item: ReturnType<typeof rawItem>): void {
  cy.intercept('GET', `**/collections/${SHEET_ID}`, {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        id: SHEET_ID,
        sheet_date: todayIso(),
        filter_used: 'TODAY_AND_OVERDUE',
        status: 'ACTIVE',
        created_at: `${todayIso()}T08:00:00.000Z`,
        sent_at: null,
        collector_id: 'col-1',
        collector_name: 'Cobrador',
        total_items: 1,
        generated_by_name: 'Admin',
        items: [item],
      },
    },
  }).as('sheet');
  cy.intercept('POST', '**/payments', {
    statusCode: 201,
    body: {
      ok: true,
      data: {
        id: 'pay-1',
        installment_id: item.installment_id,
        amount_received: 0,
        payment_method: 'CASH',
        status: 'PENDING',
        created_at: new Date().toISOString(),
      },
    },
  }).as('createPayment');
}

/**
 * Abre el diálogo de cobro de la única cuota (botón desktop o mobile).
 */
function openPaymentDialog(): void {
  cy.visit(`/collector/route/${SHEET_ID}`);
  cy.wait('@sheet');
  cy.contains('button:visible', 'Registrar cobro').first().click();
  cy.get('.p-dialog:visible').should('contain.text', 'Registrar Cobro');
}

/**
 * Escribe el monto en efectivo dentro del diálogo.
 * @param {number} amount - monto a tipear
 */
function typeCash(amount: number): void {
  cy.get('.p-dialog:visible p-inputnumber input')
    .first()
    .clear()
    .type(String(amount))
    .blur();
}

const VIEWPORTS: Array<[string, number, number]> = [
  ['desktop', 1280, 720],
  ['mobile', 375, 667],
];

VIEWPORTS.forEach(([label, width, height]) => {
  describe(`Collector — Pago con mora desde la planilla (${label})`, () => {
    beforeEach(() => {
      cy.viewport(width, height);
      cy.loginReal('COLLECTOR', '/collector/route');
    });

    it('muestra el saldo vivo con mora y paga el total sin next_visit_date', () => {
      stubSheet(rawItem('inst-mora', 1200, 200));
      openPaymentDialog();
      cy.get('.p-dialog:visible').should('contain.text', '1.200');
      typeCash(1200);
      cy.get('.p-dialog:visible')
        .contains('Próxima visita')
        .should('not.exist');
      cy.get('.p-dialog:visible').contains('button', 'Confirmar').click();
      cy.wait('@createPayment').then(({ request }) => {
        expect(request.body.amount_cash).to.eq(1200);
        expect(request.body).not.to.have.property('next_visit_date');
      });
    });

    it('pagar el snapshot viejo con mora es parcial y exige próxima visita', () => {
      stubSheet(rawItem('inst-mora', 1200, 200));
      openPaymentDialog();
      typeCash(1000);
      cy.get('.p-dialog:visible').should('contain.text', 'Próxima visita');
      cy.get('.p-dialog:visible')
        .contains('button', 'Confirmar')
        .should('be.disabled');
    });

    it('cuota sin mora: pagar el saldo completo sigue siendo total', () => {
      stubSheet(rawItem('inst-ok', 1000, 0));
      openPaymentDialog();
      typeCash(1000);
      cy.get('.p-dialog:visible')
        .contains('Próxima visita')
        .should('not.exist');
      cy.get('.p-dialog:visible').contains('button', 'Confirmar').click();
      cy.wait('@createPayment')
        .its('request.body')
        .should('not.have.property', 'next_visit_date');
    });
  });
});
