/**
 * SUITE REAL: Admin Aprobaciones contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core de créditos/aprobaciones
 * - Verifica cambio de estado persistido por API luego de aprobar
 */

const ADMIN_APPROVALS_URL = '/admin/approvals';

type PendingCredit = {
  id: string;
  customer_name: string;
  customer_dni: string;
  status: string;
};

/**
 * Obtiene el token real guardado en localStorage tras login.
 * @returns Token Bearer válido para requests autenticados al backend.
 */
const getAuthToken = (): Cypress.Chainable<string> => {
  return cy.window().then((win) => {
    const token = win.localStorage.getItem('sgcf_token');
    expect(token, 'token sgcf_token').to.be.a('string').and.not.be.empty;
    return token as string;
  });
};

/**
 * Obtiene pendientes reales de aprobación desde backend.
 */
const fetchPendingApprovals = (): Cypress.Chainable<PendingCredit[]> => {
  return getAuthToken().then((token) =>
    cy
      .request({
        method: 'GET',
        url: '/api/credits?status=PENDING_APPROVAL',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(({ body }) => (body?.data as PendingCredit[]) ?? []),
  );
};

/**
 * Crea una operación real mínima para garantizar un pendiente disponible.
 * Respeta las precondiciones reales del wizard (paso tipo con avance automático).
 */
const createRealPendingLoan = (): Cypress.Chainable<string> => {
  cy.loginReal('ADMIN', '/admin/operations/new');
  cy.intercept('POST', '/api/credits').as('createCreditBootstrap');
  cy.get('[data-cy="btn-type-loan"]').click();
  cy.contains('Paso 2 de 5').should('be.visible');

  cy.contains('[data-cy^="client-card-"]', 'ACTIVO', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('p-inputNumber[formControlName="totalAmount"] input')
    .clear()
    .type('67000')
    .blur();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('[data-cy="ddl-installments"] .p-dropdown').first().click();
  cy.get('.p-dropdown-panel .p-dropdown-item').first().click();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('[data-cy="chk-identity"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click();

  cy.contains('.p-toast-message', 'Operación enviada', { timeout: 20000 }).should('be.visible');
  return cy.wait('@createCreditBootstrap').then((interception) => {
    const createdId = interception.response?.body?.data?.id as string | undefined;
    expect(createdId, 'id de crédito bootstrap').to.be.a('string').and.not.be.empty;
    return createdId as string;
  });
};

describe('Admin Aprobaciones real', () => {
  it('aprueba una operación pendiente real y persiste estado', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);

    fetchPendingApprovals().then((initialPending) => {
      const resolveTargetId =
        initialPending.length === 0
          ? createRealPendingLoan()
          : cy.wrap(initialPending[0].id);

      resolveTargetId.then((targetId) => {
        fetchPendingApprovals().then((pendingCredits) => {
          const target = pendingCredits.find((item) => item.id === targetId) ?? pendingCredits[0];
          expect(target, 'crédito objetivo pendiente').to.exist;

          cy.visit(ADMIN_APPROVALS_URL);
          cy.contains('h1', 'Aprobación de Operaciones', { timeout: 20000 }).should('be.visible');
          cy.contains('p-table tbody tr', target.customer_name, { timeout: 20000 }).should('be.visible').click();
          cy.contains('p-table tbody tr', target.customer_name)
            .find('button')
            .first()
            .click();

          cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', { timeout: 10000 }).should('be.visible');
          cy.contains('.p-dialog button', 'Confirmar Aprobación').click();
          cy.contains('.p-toast-message', 'Aprobado', { timeout: 20000 }).should('be.visible');

          getAuthToken().then((token) => {
            cy.request({
              method: 'GET',
              url: `/api/credits/${target.id}`,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }).then(({ body }) => {
              expect(body?.data?.status).to.eq('ACTIVE');
            });

            cy.request({
              method: 'GET',
              url: '/api/credits?status=PENDING_APPROVAL',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }).then(({ body }) => {
              const ids = ((body?.data as PendingCredit[]) ?? []).map((item) => item.id);
              expect(ids).not.to.include(target.id);
            });
          });
        });
      });
    });
  });
});
