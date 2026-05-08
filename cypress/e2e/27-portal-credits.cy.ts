/**
 * SUITE: Portal Cliente — Créditos y Detalle de Crédito
 *
 * El portal usa autenticación propia (portal-login), no la del sistema interno.
 * Usamos cy.loginPortalAs para inyectar el contrato real de storage portal
 * e interceptamos sólo los endpoints que cada caso necesita.
 *
 * Rutas: /portal/credits  ·  /portal/credits/:id
 *
 * Cubre:
 *  - Lista de créditos: título, tarjetas de crédito, estado vacío
 *  - Detalle de crédito: cabecera, tipo, monto, tabla de cuotas
 *  - Botón Volver en el detalle
 */

const PORTAL_SESSION = {
  token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LTAwMSIsImZ1bGxfbmFtZSI6IkFuYSBHYXJjw61hIiwiZG5pIjoiMTIzNDU2NzgiLCJwb3J0YWxfaXNfdGVtcF9wYXNzd29yZCI6ZmFsc2V9.sig',
  customer: {
    id: 'cust-001',
    fullName: 'Ana García',
    dni: '12345678',
    portalIsTempPassword: false,
  },
};

const PORTAL_CREDITS_MOCK = [
  {
    id: 'crd-p01',
    type: 'SALE',
    status: 'ACTIVE',
    totalAmount: 120000,
    installmentsCount: 10,
    paymentFrequency: 'WEEKLY',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'crd-p02',
    type: 'LOAN',
    status: 'SETTLED',
    totalAmount: 50000,
    installmentsCount: 6,
    paymentFrequency: 'MONTHLY',
    createdAt: '2025-06-01T00:00:00Z',
  },
];

const PORTAL_CREDIT_DETAIL_MOCK = {
  id: 'crd-p01',
  type: 'SALE',
  status: 'ACTIVE',
  totalAmount: 120000,
  installmentsCount: 10,
  paymentFrequency: 'WEEKLY',
  createdAt: '2026-01-10T00:00:00Z',
  installments: [
    { id: 'inst-p01', installmentNumber: 1, dueDate: '2026-01-17T00:00:00Z', amountDue: 12000, status: 'PAID', paidAt: '2026-01-17T10:00:00Z', paidAmount: 12000 },
    { id: 'inst-p02', installmentNumber: 2, dueDate: '2026-01-24T00:00:00Z', amountDue: 12000, status: 'PENDING', paidAt: null, paidAmount: null },
  ],
};

function setupPortalSession() {
  cy.intercept('GET', /\/api\/portal\/me/, {
    statusCode: 200,
    body: { ok: true, data: { id: 'cust-001', full_name: 'Ana García', dni: '12345678' } },
  }).as('portalMe');

  cy.intercept('GET', /\/api\/portal\/credits$/, {
    statusCode: 200,
    body: { ok: true, data: PORTAL_CREDITS_MOCK },
  }).as('portalCredits');
}

function setupPortalCreditsList() {
  cy.intercept('GET', /\/api\/portal\/credits$/, {
    statusCode: 200,
    body: { ok: true, data: PORTAL_CREDITS_MOCK },
  }).as('portalCredits');
}

describe('Portal — Lista de Créditos (/portal/credits)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    setupPortalSession();

    cy.loginPortalAs('/portal/credits', PORTAL_SESSION);
  });

  it('muestra el título "Mis créditos"', () => {
    cy.get('[data-cy="portal-credits-title"]').should('be.visible');
  });

  it('renderiza al menos una tarjeta de crédito o skeleton', () => {
    cy.get('p-skeleton, [data-cy="portal-credits-card"]').should('exist');
  });

  it('muestra crédito tipo Venta en cuotas', () => {
    cy.contains('Venta en cuotas').should('exist');
  });

  it('muestra crédito tipo Préstamo', () => {
    cy.contains('Préstamo').should('exist');
  });

  it('muestra tags de estado', () => {
    cy.get('p-tag').should('have.length.gte', 1);
  });

  it('clic en un crédito navega al detalle', () => {
    cy.get('[data-cy="portal-credits-card"]').first().click();
    cy.url().should('include', '/portal/credits/');
  });
});

describe('Portal — Detalle de Crédito (/portal/credits/:id)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', /\/api\/portal\/me/, {
      statusCode: 200,
      body: { ok: true, data: { id: 'cust-001', full_name: 'Ana García', dni: '12345678' } },
    }).as('portalMe');

    cy.intercept('GET', /\/api\/portal\/credits\/crd-p01/, {
      statusCode: 200,
      body: { ok: true, data: PORTAL_CREDIT_DETAIL_MOCK },
    }).as('portalCreditDetail');

    setupPortalCreditsList();

    cy.loginPortalAs('/portal/credits/crd-p01', PORTAL_SESSION);

    cy.wait('@portalCreditDetail');
  });

  it('muestra el título "Detalle del crédito"', () => {
    cy.get('[data-cy="portal-credit-detail-title"]').should('be.visible');
  });

  it('muestra el tipo de crédito', () => {
    cy.contains('Venta en cuotas').should('exist');
  });

  it('muestra el monto total', () => {
    cy.contains('Monto total').should('exist');
  });

  it('muestra la frecuencia de pago', () => {
    cy.contains('Frecuencia').should('exist');
  });

  it('muestra el tag de estado', () => {
    cy.get('p-tag').should('exist');
  });

  it('muestra la tabla de cuotas', () => {
    cy.get('[data-cy="portal-credit-detail-installments-title"]').should('exist');
  });

  it('muestra filas de cuotas en la tabla', () => {
    cy.get('[data-cy="portal-credit-detail-installments-table"] tbody tr').should('have.length.gte', 1);
  });

  it('botón Volver navega a la lista de créditos', () => {
    cy.get('[data-cy="portal-credit-detail-back-action"]').click();
    cy.wait('@portalCredits');
    cy.url().should('include', '/portal/credits');
    cy.url().should('not.include', '/crd-p01');
    cy.url().should('not.include', '/portal/login');
    cy.url().should('not.include', '/login');
  });
});

describe('Portal — Lista de Créditos vacía', () => {
  it('muestra el mensaje de sin créditos', () => {
    cy.intercept('GET', /\/api\/portal\/credits/, {
      statusCode: 200,
      body: { ok: true, data: [] },
    }).as('emptyCredits');

    cy.loginPortalAs('/portal/credits', PORTAL_SESSION);

    cy.wait('@emptyCredits');
    cy.get('[data-cy="portal-credits-empty-state"]').should('be.visible');
  });
});
