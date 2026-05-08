/**
 * SUITE: Portal Cliente — Dashboard y Créditos (UI actual)
 */

const PORTAL_SESSION = {
  token:
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LTAwMSIsImZ1bGxfbmFtZSI6IkFuYSBHYXJjw61hIiwiZG5pIjoiMTIzNDU2NzgiLCJwb3J0YWxfaXNfdGVtcF9wYXNzd29yZCI6ZmFsc2V9.sig',
  customer: {
    id: 'cust-001',
    fullName: 'Ana García',
    dni: '12345678',
    portalIsTempPassword: false,
  },
};

const SUMMARY = {
  total_owed: 150000,
  paid_count: 8,
  pending_count: 2,
  overdue_count: 0,
  status_indicator: 'GREEN',
  total_paid_amount: 95000,
  pending_penalty_amount: 0,
  upcoming_installments: [],
};

const CREDITS = [
  {
    id: 'cred-1',
    type: 'SALE',
    total_amount: 120000,
    installments_count: 12,
    payment_frequency: 'WEEKLY',
    status: 'ACTIVE',
    created_at: '2026-01-10T00:00:00Z',
    approved_at: '2026-01-11T00:00:00Z',
    total_installments: 12,
    paid_installments: 5,
    next_due_date: '2026-06-01T00:00:00Z',
    next_due_amount: 10000,
    pending_penalty: 0,
    has_overdue: false,
  },
];

describe('Portal Cliente — Dashboard y Créditos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/portal/me', {
      statusCode: 200,
      body: { ok: true, data: SUMMARY },
    }).as('portalSummary');

    cy.intercept('GET', '**/api/portal/credits', {
      statusCode: 200,
      body: { ok: true, data: CREDITS },
    }).as('portalCredits');
  });

  it('muestra dashboard real con saludo y saldo total', () => {
    cy.loginPortalAs('/portal/dashboard', PORTAL_SESSION);
    cy.wait('@portalCredits');

    cy.contains('Hola, Ana').should('be.visible');
    cy.contains('Saldo total de créditos').should('be.visible');
    cy.contains('Créditos activos').should('be.visible');
  });

  it('desde dashboard navega a detalle por CTA "Ver detalle"', () => {
    cy.intercept('GET', '**/api/portal/credits/cred-1', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          ...CREDITS[0],
          installments: [
            {
              id: 'inst-1',
              installment_number: 1,
              due_date: '2026-01-17T00:00:00Z',
              amount_due: 10000,
              amount_paid: 10000,
              penalty_amount: 0,
              status: 'PAID',
            },
          ],
        },
      },
    }).as('portalCreditDetail');

    cy.loginPortalAs('/portal/credits', PORTAL_SESSION);
    cy.wait('@portalCredits');

    cy.get('[data-cy="portal-credits-card"]').first().click();
    cy.url().should('include', '/portal/credits/cred-1');
    cy.wait('@portalCreditDetail');
    cy.contains('h2', 'Detalle del crédito').should('be.visible');
  });

  it('muestra vista real de /portal/credits como tarjetas', () => {
    cy.loginPortalAs('/portal/credits', PORTAL_SESSION);
    cy.wait('@portalCredits');

    cy.contains('h2', 'Mis créditos').should('be.visible');
    cy.contains('Venta en cuotas').should('be.visible');
    cy.get('p-tag').should('contain', 'Activo');
  });
});
