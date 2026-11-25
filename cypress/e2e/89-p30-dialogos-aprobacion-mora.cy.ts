/**
 * P30 (#59, #61): diálogos de aprobación y mora consistentes.
 * - Doble click en aprobar → una sola aprobación; rechazo sin motivo real → bloqueado.
 * - Abrir el diálogo de mora para dos cuotas seguidas → el monto no se arrastra.
 * Specs stubbeados (sin backend real).
 */

const VIEWPORTS: { name: string; width: number; height: number; mobile: boolean }[] = [
  { name: 'desktop', width: 1280, height: 720, mobile: false },
  { name: 'mobile', width: 375, height: 667, mobile: true },
];

const PENDING_CREDIT = {
  id: 'CR-P30',
  type: 'LOAN',
  payment_condition: 'CREDIT',
  total_amount: 15000,
  installments_count: 6,
  payment_frequency: 'MONTHLY',
  interest_rate: 5,
  effective_rate: 5,
  total_to_return: null,
  status: 'PENDING_APPROVAL',
  created_at: '2026-11-20T10:00:00Z',
  approved_at: null,
  customer_id: 'cust-p30',
  customer_name: 'Lucía Pérez',
  customer_dni: '30111222',
  created_by_id: 'seller-1',
  created_by_name: 'Vendedor Uno',
  collector_name: null,
};

/**
 * Arma una cuota vencida en formato API.
 * @param id - ID de la cuota
 * @param name - nombre del cliente
 * @param penalty - mora ya aplicada (0 = sin aplicar)
 */
function overdue(id: string, name: string, penalty: number): Record<string, unknown> {
  return {
    id,
    credit_id: `cr-${id}`,
    installment_number: 1,
    due_date: '2026-10-01',
    amount_due: 1000,
    amount_paid: 0,
    penalty_amount: penalty,
    status: 'OVERDUE',
    created_at: '2026-09-01T00:00:00Z',
    credit_type: 'LOAN',
    customer_id: `c-${id}`,
    customer_name: name,
    customer_dni: '20000000',
    collector_id: null,
    collector_name: null,
  };
}

/** Stubea caja abierta y usuarios vacíos, comunes a ambas pantallas. */
function stubCommon(): void {
  cy.intercept('GET', '**/api/cash-sessions/active', {
    ok: true,
    data: { id: 'sess-1', status: 'OPEN' },
  });
  cy.intercept('GET', '**/api/users*', { ok: true, data: [] });
}

/** Stubea aprobaciones con un crédito pendiente. */
function stubApprovals(): void {
  stubCommon();
  cy.intercept('GET', '**/api/credits?*', { ok: true, data: [PENDING_CREDIT] }).as('approvals');
  cy.intercept('GET', '**/api/credits/CR-P30', { ok: true, data: PENDING_CREDIT });
}

/** Abre la acción de aprobar o rechazar de la fila según el viewport. */
function rowAction(mobile: boolean, kind: 'approve' | 'reject'): void {
  const cyId = mobile ? `admin-approvals-mobile-${kind}-action` : `admin-approvals-${kind}-action`;
  cy.get(`[data-cy="${cyId}"]:visible`).first().find('button').click();
}

describe('P30 — diálogos de aprobación y mora', () => {
  VIEWPORTS.forEach(({ name, width, height, mobile }) => {
    describe(name, () => {
      beforeEach(() => cy.viewport(width, height));

      it('doble click en confirmar aprobación dispara una sola request', () => {
        stubApprovals();
        let approveCalls = 0;
        cy.intercept('PATCH', '**/api/credits/CR-P30/approve', (req) => {
          approveCalls += 1;
          req.reply({ delay: 400, body: { ok: true, data: { ...PENDING_CREDIT, status: 'ACTIVE', installments: [], products: [], units: [] } } });
        }).as('approve');
        cy.loginAs('ADMIN', '/admin/approvals');
        cy.wait('@approvals');

        rowAction(mobile, 'approve');
        cy.get('[data-cy="admin-approvals-confirm-approve"] button')
          .should('be.enabled')
          .dblclick();
        cy.wait('@approve');
        cy.wait(600).then(() => expect(approveCalls).to.eq(1));
        cy.contains('.p-toast-message', 'Aprobado').should('be.visible');
      });

      it('rechazo con motivo de solo espacios queda bloqueado; con motivo real rechaza', () => {
        stubApprovals();
        cy.intercept('PATCH', '**/api/credits/CR-P30/reject', { ok: true, data: null }).as(
          'reject',
        );
        cy.loginAs('ADMIN', '/admin/approvals');
        cy.wait('@approvals');

        rowAction(mobile, 'reject');
        cy.get('[data-cy="admin-approvals-reject-reason"]').type('     ');
        cy.get('[data-cy="admin-approvals-confirm-reject"] button').should('be.disabled');

        cy.get('[data-cy="admin-approvals-reject-reason"]').clear().type('Documentación incompleta');
        cy.get('[data-cy="admin-approvals-confirm-reject"] button').should('be.enabled').click();
        cy.wait('@reject')
          .its('request.body')
          .should('deep.include', { rejection_reason: 'Documentación incompleta' });
      });

      it('el monto de mora no se arrastra entre dos cuotas y condonar sigue funcionando', () => {
        stubCommon();
        cy.intercept('GET', '**/api/installments?*', {
          ok: true,
          data: [overdue('i1', 'Ana Uno', 0), overdue('i2', 'Beto Dos', 0), overdue('i3', 'Caro Tres', 200)],
        }).as('overdue');
        cy.intercept({ url: '**/api/installments/i3/waive-penalty' }, {
          ok: true,
          data: { ...overdue('i3', 'Caro Tres', 0) },
        }).as('waive');
        cy.loginAs('ADMIN', '/admin/delinquency');
        cy.wait('@overdue');

        const applyButtons = mobile
          ? () => cy.get('[data-cy="delinquency-mobile-list"] [data-cy="delinquency-mobile-apply-action"]')
          : () => cy.get('[data-cy="delinquency-table"]').find('p-button:visible');

        applyButtons().filter(':contains("Aplicar mora")').eq(0).find('button').click();
        cy.get('[data-cy="delinquency-apply-dialog-amount"]').type('500');
        cy.get('[data-cy="delinquency-apply-dialog-close"]').click();

        applyButtons().filter(':contains("Aplicar mora")').eq(1).find('button').click();
        cy.get('[data-cy="delinquency-apply-dialog"]').should('contain.text', 'Beto Dos');
        cy.get('[data-cy="delinquency-apply-dialog-amount"]').should('have.value', '');
        cy.get('[data-cy="delinquency-apply-dialog-submit"] button').should('be.disabled');
        cy.get('[data-cy="delinquency-apply-dialog-close"]').click();

        applyButtons().filter(':contains("Condonar")').first().find('button').click();
        cy.wait('@waive');
      });
    });
  });
});
