/**
 * P29 (#40, #49, #54, #64): los errores se ven y nunca se muestra un éxito falso.
 * - Aprobaciones con 500 → estado de error con "Reintentar"; con 200 → lista normal.
 * - Aviso de mora y recuperar contraseña → sin endpoint, avisan en vez de simular éxito.
 * Specs stubbeados (sin backend real).
 */

const VIEWPORTS: { name: string; width: number; height: number; mobile: boolean }[] = [
  { name: 'desktop', width: 1280, height: 720, mobile: false },
  { name: 'mobile', width: 375, height: 667, mobile: true },
];

const PENDING_CREDIT = {
  id: 'CR-P29',
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
  customer_id: 'cust-p29',
  customer_name: 'Lucía Pérez',
  customer_dni: '30111222',
  created_by_id: 'seller-1',
  created_by_name: 'Vendedor Uno',
  collector_name: null,
};

const OVERDUE = {
  id: 'i1',
  credit_id: 'cr-i1',
  installment_number: 1,
  due_date: '2026-10-01',
  amount_due: 1000,
  amount_paid: 0,
  penalty_amount: 0,
  status: 'OVERDUE',
  created_at: '2026-09-01T00:00:00Z',
  credit_type: 'LOAN',
  customer_id: 'c-i1',
  customer_name: 'Ana Uno',
  customer_dni: '20000000',
  collector_id: null,
  collector_name: null,
};

/** Stubea caja abierta y usuarios vacíos. */
function stubCommon(): void {
  cy.intercept('GET', '**/api/cash-sessions/active', {
    ok: true,
    data: { id: 'sess-1', status: 'OPEN' },
  });
  cy.intercept('GET', '**/api/users*', { ok: true, data: [] });
}

describe('P29 — errores visibles', () => {
  VIEWPORTS.forEach(({ name, width, height, mobile }) => {
    describe(name, () => {
      beforeEach(() => cy.viewport(width, height));

      it('aprobaciones: 500 muestra error con reintento y 200 recupera la lista', () => {
        stubCommon();
        let fail = true;
        cy.intercept('GET', '**/api/credits?*', (req) => {
          if (fail) {
            req.reply({ statusCode: 500, body: { ok: false, message: 'boom' } });
          } else {
            req.reply({ ok: true, data: [PENDING_CREDIT] });
          }
        }).as('approvals');
        cy.loginAs('ADMIN', '/admin/approvals');
        cy.wait('@approvals');
        cy.get('[data-cy="admin-approvals-error"]')
          .should('be.visible')
          .and('contain.text', 'No se pudieron cargar las aprobaciones pendientes.')
          .and('not.contain.text', 'boom');
        cy.then(() => {
          fail = false;
        });
        cy.get('[data-cy="error-state-retry"] button').should('be.visible').click();
        cy.wait('@approvals');
        cy.get('[data-cy="admin-approvals-error"]').should('not.exist');
        cy.get('[data-cy="admin-approvals-page"]')
          .find(':visible')
          .filter(':contains("Lucía Pérez")')
          .should('have.length.greaterThan', 0);
      });

      it('aviso de mora: no muestra "Aviso enviado" sin backend', () => {
        stubCommon();
        cy.intercept('GET', '**/api/installments?*', { ok: true, data: [OVERDUE] }).as('overdue');
        cy.loginAs('ADMIN', '/admin/delinquency');
        cy.wait('@overdue');
        const container = mobile ? 'delinquency-mobile-list' : 'delinquency-table';
        cy.get(`[data-cy="${container}"] [data-cy="delinquency-notify-action"] button`)
          .first()
          .scrollIntoView()
          .click();
        cy.get('.p-toast-message:visible')
          .should('contain.text', 'Aviso no enviado')
          .and('not.contain.text', 'Aviso enviado.');
        if (mobile) {
          cy.get('.p-toast-message:visible').invoke('outerHeight').should('be.lte', 200);
        }
      });

      it('recuperar contraseña: avisa que no se envió ningún email', () => {
        cy.visit('/forgot-password');
        cy.get('input[formControlName="email"]').type('juan@mail.com');
        cy.get('button[type="submit"]').click();
        cy.get('[data-cy="forgot-password-unavailable"]')
          .should('be.visible')
          .and('contain.text', 'No se envió ningún email');
        cy.contains('¡Email enviado!').should('not.exist');
      });
    });
  });
});
