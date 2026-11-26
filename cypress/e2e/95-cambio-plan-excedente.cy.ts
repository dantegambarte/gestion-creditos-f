// #95 — Cambio de plan con excedente: el cliente elige saldo a favor o
// devolución antes de confirmar. API stubeada (contrato backend #86).

const CREDIT_ID = 'credit-p95-1';

const creditDetailResponse = {
  ok: true,
  data: {
    id: CREDIT_ID,
    type: 'LOAN',
    total_amount: 180000,
    installments_count: 6,
    payment_frequency: 'MONTHLY',
    interest_rate: 0.4,
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    approved_at: '2026-01-02T00:00:00.000Z',
    customer_id: 'cust-p95-1',
    customer_name: 'Cliente Excedente',
    customer_dni: '40555777',
    created_by_id: 'seller-p95-1',
    created_by_name: 'Vendedor P95',
    rejection_reason: null,
    notes: null,
    approved_by: 'admin-p95-1',
    customer_phone: '11-5000-0095',
    financed_amount: 180000,
    down_payment: 0,
    down_payment_method: null,
    down_payment_transfer_reference: null,
    prepaid_installments: 0,
    prepaid_installments_method: null,
    prepaid_installments_transfer_reference: null,
    settled_at: null,
    settlement_amount: null,
    settlement_type: null,
    refinanced_from_credit_id: null,
    refinancing_chain: null,
    products: [],
    units: [],
    installments: [
      {
        id: 'inst-p95-1',
        installment_number: 1,
        due_date: '2026-02-01',
        amount_due: 42000,
        amount_paid: 42000,
        penalty_amount: 0,
        status: 'PAID',
      },
      {
        id: 'inst-p95-2',
        installment_number: 2,
        due_date: '2026-03-01',
        amount_due: 42000,
        amount_paid: 0,
        penalty_amount: 0,
        status: 'PENDING',
      },
    ],
  },
};

/** Simulación base del backend; `excessAmount > 0` exige destino. */
function simulation(excessAmount: number) {
  return {
    currentPlan: { installments: 6, rate: 40 },
    newPlan: { installments: 2, rate: 10 },
    totalPaid: 200000,
    newCreditTotal: 198000,
    newBalance: excessAmount > 0 ? 0 : 50000,
    survivingInstallmentId: excessAmount > 0 ? null : 'inst-p95-2',
    cancelledInstallments: [3, 4, 5, 6],
    creditWillBeSettled: excessAmount > 0,
    excessAmount,
    requiresExcessDisposition: excessAmount > 0,
  };
}

/** Abre el diálogo de cambio de plan con la simulación indicada. */
function openDialog(excessAmount: number) {
  cy.intercept('GET', `**/api/credits/${CREDIT_ID}`, creditDetailResponse).as('creditDetail');
  cy.intercept('GET', `**/api/credits/${CREDIT_ID}/plan-change/simulate`, {
    ok: true,
    data: simulation(excessAmount),
  }).as('simulate');
  cy.intercept('POST', `**/api/credits/${CREDIT_ID}/plan-change`, {
    ok: true,
    data: {
      ...simulation(excessAmount),
      excessDisposition: excessAmount > 0 ? 'REFUND' : null,
      plan_change_id: 'pc-p95',
      executed_at: '2026-11-26T00:00:00Z',
      message: 'Plan cambiado.',
    },
  }).as('execute');

  cy.loginAs('ADMIN', `/admin/operations/${CREDIT_ID}`);
  cy.wait('@creditDetail');
  cy.contains('button', /Cambiar plan/)
    .scrollIntoView()
    .click();
  cy.wait('@simulate');
  cy.get('.p-dialog:visible').should('contain', 'Cambio de plan');
}

/** Ejecuta los casos en el viewport actual. */
function cases() {
  it('sin excedente el flujo no cambia y no envía excess_disposition', () => {
    openDialog(0);
    cy.get('[data-cy="plan-change-excess"]').should('not.exist');
    cy.get('[data-cy="plan-change-confirm"] button').should('be.enabled').click();
    cy.wait('@execute').its('request.body').should('not.have.property', 'excess_disposition');
  });

  it('con excedente exige elegir destino y envía el valor elegido', () => {
    openDialog(2000);
    cy.get('[data-cy="plan-change-excess"]').scrollIntoView().should('be.visible');
    cy.get('[data-cy="plan-change-excess-amount"]').should('contain', '2.000');
    cy.get('[data-cy="plan-change-confirm"] button').should('be.disabled');

    cy.get('[data-cy="excess-refund"]').scrollIntoView().click();
    cy.get('[data-cy="excess-refund"]').should('have.attr', 'aria-checked', 'true');
    cy.get('[data-cy="plan-change-confirm"] button').should('be.enabled').click();
    cy.wait('@execute').its('request.body').should('have.property', 'excess_disposition', 'REFUND');
  });

  it('muestra un mensaje claro ante 422 EXCESS_DISPOSITION_REQUIRED', () => {
    openDialog(2000);
    cy.intercept('POST', `**/api/credits/${CREDIT_ID}/plan-change`, {
      statusCode: 422,
      body: {
        ok: false,
        message: 'Indicá excess_disposition: CREDIT_BALANCE o REFUND',
        code: 'EXCESS_DISPOSITION_REQUIRED',
      },
    }).as('execute422');
    cy.get('[data-cy="excess-credit-balance"]').scrollIntoView().click();
    cy.get('[data-cy="plan-change-confirm"] button').click();
    cy.wait('@execute422');
    cy.get('.p-toast-message:visible')
      .should('contain', 'saldo a favor o devolución')
      .and('not.contain', 'excess_disposition');
  });
}

describe('#95 Cambio de plan con excedente — Desktop', () => {
  beforeEach(() => cy.viewport(1280, 800));
  cases();
});

describe('#95 Cambio de plan con excedente — Mobile (375x667)', () => {
  beforeEach(() => cy.viewport(375, 667));
  cases();

  it('el diálogo con excedente no desborda el viewport', () => {
    openDialog(2000);
    cy.get('.p-dialog:visible').then(($d) => {
      cy.window().then((win) => {
        expect($d[0].getBoundingClientRect().width).to.be.lte(win.innerWidth);
        expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
      });
    });
  });
});
