const portalSummaryResponse = {
  ok: true,
  data: {
    total_owed: 180000,
    paid_count: 4,
    pending_count: 8,
    overdue_count: 1,
    status_indicator: 'YELLOW',
    total_paid_amount: 92000,
    pending_penalty_amount: 4500,
    active_credits: 2,
    settled_credits: 1,
    total_installments_count: 12,
    upcoming_installments: [
      {
        id: 'inst-mobile-1',
        installment_number: 5,
        due_date: '2099-08-10',
        amount_due: 24000,
        amount_paid: 0,
        penalty_amount: 0,
        status: 'PENDING',
        credit_id: 'credit-mobile-1',
        credit_type: 'SALE',
        credit_installments_count: 12,
        credit_name: 'Moto 110cc',
      },
      {
        id: 'inst-mobile-2',
        installment_number: 3,
        due_date: '2099-08-17',
        amount_due: 18500,
        amount_paid: 0,
        penalty_amount: 0,
        status: 'PENDING',
        credit_id: 'credit-mobile-2',
        credit_type: 'LOAN',
        credit_installments_count: 8,
        credit_name: 'Préstamo personal',
      },
    ],
  },
};

const portalCreditsResponse = {
  ok: true,
  data: [
    {
      id: 'credit-mobile-1',
      type: 'SALE',
      credit_name: 'Moto 110cc',
      total_amount: 288000,
      total_to_return: 288000,
      installments_count: 12,
      installment_amount: 24000,
      payment_frequency: 'MONTHLY',
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00.000Z',
      approved_at: '2026-01-02T00:00:00.000Z',
      settled_at: null,
      total_installments: 12,
      paid_installments: 4,
      next_due_date: '2099-08-10',
      next_due_amount: 24000,
      pending_penalty: 0,
      has_overdue: false,
      overdue_installments: 0,
    },
    {
      id: 'credit-mobile-2',
      type: 'LOAN',
      credit_name: 'Préstamo personal',
      total_amount: 148000,
      total_to_return: 148000,
      installments_count: 8,
      installment_amount: 18500,
      payment_frequency: 'WEEKLY',
      status: 'ACTIVE',
      created_at: '2026-01-03T00:00:00.000Z',
      approved_at: '2026-01-04T00:00:00.000Z',
      settled_at: null,
      total_installments: 8,
      paid_installments: 2,
      next_due_date: '2099-08-17',
      next_due_amount: 18500,
      pending_penalty: 4500,
      has_overdue: true,
      overdue_installments: 1,
    },
  ],
};

const portalCreditDetailResponse = {
  ok: true,
  data: {
    id: 'credit-mobile-1',
    type: 'SALE',
    credit_name: 'Moto 110cc',
    total_amount: 288000,
    total_to_return: 288000,
    installments_count: 2,
    installment_amount: 144000,
    payment_frequency: 'MONTHLY',
    status: 'ACTIVE',
    created_at: '2026-01-01T00:00:00.000Z',
    approved_at: '2026-01-02T00:00:00.000Z',
    settled_at: null,
    total_installments: 2,
    paid_installments: 1,
    next_due_date: '2099-08-10',
    next_due_amount: 144000,
    pending_penalty: 0,
    has_overdue: false,
    overdue_installments: 0,
    down_payment: 0,
    down_payment_method: null,
    prepaid_installments: 0,
    interest_rate: null,
    installments: [
      {
        id: 'portal-inst-paid',
        installment_number: 1,
        due_date: '2099-07-10',
        amount_due: 144000,
        amount_paid: 144000,
        penalty_amount: 0,
        status: 'PAID',
      },
      {
        id: 'portal-inst-pending',
        installment_number: 2,
        due_date: '2099-08-10',
        amount_due: 144000,
        amount_paid: 0,
        penalty_amount: 0,
        status: 'PENDING',
      },
    ],
  },
};

function toBase64Url(value: object): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function visitPortalWithSession(path: string): void {
  const token = [
    toBase64Url({ alg: 'HS256', typ: 'JWT' }),
    toBase64Url({
      sub: 'cust-mobile-ux',
      aud: 'portal-cliente',
      full_name: 'Cliente Mobile',
      dni: '40567890',
      portal_is_temp_password: false,
    }),
    'sig',
  ].join('.');

  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('sgcf_portal_token', token);
      win.localStorage.setItem(
        'sgcf_portal_customer',
        JSON.stringify({
          id: 'cust-mobile-ux',
          fullName: 'Cliente Mobile',
          dni: '40567890',
          portalIsTempPassword: false,
        }),
      );
    },
  });
}

describe('Portal Cliente — Mobile UX', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('Login Responsivo — no desborda y sus inputs evitan zoom iOS', () => {
    cy.clearAllLocalStorage();
    cy.visit('/portal/login');

    cy.get('[data-cy="portal-login-card"]').should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });

    cy.get('#dni')
      .should('be.visible')
      .then(($input) => {
        const styles = getComputedStyle($input[0]);
        expect(parseFloat(styles.fontSize)).to.be.at.least(16);
        expect($input[0].getBoundingClientRect().height).to.be.at.least(44);
      });

    cy.get('p-password input')
      .should('be.visible')
      .then(($input) => {
        const styles = getComputedStyle($input[0]);
        expect(parseFloat(styles.fontSize)).to.be.at.least(16);
        expect($input[0].getBoundingClientRect().height).to.be.at.least(44);
      });
  });

  it('Skeletons y Dashboard — muestra loaders app-like y luego cards móviles accionables', () => {
    cy.intercept(
      { method: 'GET', url: '**/api/portal/me', times: 1 },
      {
        delayMs: 2000,
        statusCode: 200,
        body: portalSummaryResponse,
      },
    ).as('portalSummary');

    visitPortalWithSession('/portal/dashboard');

    cy.get('[data-cy="portal-dashboard-skeleton"]').should('be.visible');
    cy.get('[data-cy="portal-dashboard-skeleton"] .p-skeleton').should(
      'have.length.at.least',
      4,
    );

    cy.wait('@portalSummary');
    cy.get('[data-cy="portal-dashboard-skeleton"]').should('not.exist');
    cy.get('[data-cy="portal-dashboard-installment-card"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    cy.intercept(
      { method: 'GET', url: '**/api/portal/credits', times: 1 },
      {
        delayMs: 1200,
        statusCode: 200,
        body: portalCreditsResponse,
      },
    ).as('portalCredits');

    visitPortalWithSession('/portal/credits');

    cy.get('[data-cy="portal-credits-skeleton-list"]').should('be.visible');
    cy.get('[data-cy="portal-credit-card-skeleton"] .p-skeleton').should(
      'have.length.at.least',
      9,
    );

    cy.wait('@portalCredits');
    cy.get('[data-cy="portal-credits-skeleton-list"]').should('not.exist');
    cy.get('[data-cy="portal-credits-back-action"]')
      .should('be.visible')
      .then(($back) => {
        expect($back[0].getBoundingClientRect().left).to.be.lessThan(40);
      });
    cy.get('[data-cy="portal-credits-card"]')
      .first()
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-cy="portal-credit-card-badges"]')
      .first()
      .should('be.visible');
    cy.get('[data-cy="portal-credit-pay-cta"]').first().should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });

  it('Detalle de crédito — cronograma usa cards móviles sin tabla visible', () => {
    cy.intercept('GET', '**/api/portal/credits/credit-mobile-1', portalCreditDetailResponse).as(
      'portalCreditDetail',
    );

    visitPortalWithSession('/portal/credits/credit-mobile-1');
    cy.wait('@portalCreditDetail');

    cy.get('[data-cy="portal-credit-detail-installments-table"]').should('not.be.visible');
    cy.get('[data-cy="portal-credit-detail-installment-mobile-card"]')
      .should('have.length', 2)
      .first()
      .should('contain.text', 'Cuota N° 1')
      .and('contain.text', 'PAGADO');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(win.innerWidth);
    });
  });
});
