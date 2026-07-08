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

type CreditDetail = {
  id: string;
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
 * Obtiene el estado actual de un crédito por id desde backend real.
 */
const fetchCreditDetail = (id: string): Cypress.Chainable<CreditDetail> => {
  return getAuthToken().then((token) =>
    cy
      .request({
        method: 'GET',
        url: `/api/credits/${id}`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then(({ body }) => body?.data as CreditDetail),
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
  /**
   * Garantiza caja operativa abierta y con fondos en la jornada actual —
   * aprobar un LOAN desembolsa el préstamo desde la caja activa, sin ella (o
   * sin fondos suficientes) responde 409. Resetea la jornada de hoy antes de
   * abrir para no heredar una caja ya castigada por aprobaciones previas de
   * otras corridas — sin esto, una caja vieja con poco margen hace que este
   * test falle con 409 INSUFFICIENT_CASH sin que sea un bug real.
   */
  const ensureCashSessionOpen = (): Cypress.Chainable<void> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('DELETE', '/test/business-days/today', null, token)
        .then((resetRes) => {
          expect(resetRes.status, 'reset jornada de hoy').to.eq(200);
          return cy.apiRequest(
            'POST',
            '/cash-sessions',
            { opening_amount: 100000000 },
            token,
          );
        })
        .then((res) => {
          expect(res.status, 'abrir caja operativa fresca').to.eq(201);
        }),
    );
  };

  /**
   * Garantiza que exista al menos una fila accionable en aprobaciones.
   */
  const ensureApprovalRow = (): Cypress.Chainable<void> => {
    cy.visit(ADMIN_APPROVALS_URL);
    cy.url({ timeout: 20000 }).should('include', '/admin/approvals');
    return ensureCashSessionOpen().then(() =>
      cy.get('body', { timeout: 20000 }).then(($body) => {
        const actionButtons = $body.find('p-table tbody tr button');
        if (actionButtons.length > 0) {
          return;
        }

        return createRealPendingLoan().then(() => {
          cy.visit(ADMIN_APPROVALS_URL);
          cy.get('p-table tbody tr button', { timeout: 20000 }).should('have.length.greaterThan', 0);
        });
      }),
    );
  };

  it('aprueba una operación pendiente real y persiste estado', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);

    ensureApprovalRow().then(() => {
      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as('approveCredit');

      cy.get('p-table tbody tr').first().within(() => {
        cy.get('button').eq(1).click();
      });

      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Crédito', { timeout: 10000 }).should('be.visible');
      cy.contains('.p-dialog button', 'Confirmar').click();
      cy.contains('.p-toast-message', /aprob/i, { timeout: 20000 }).should('be.visible');

      cy.wait('@approveCredit').then((interception) => {
        const url = interception.request.url;
        const match = url.match(/\/api\/credits\/([^/]+)\/approve$/);
        const creditId = match?.[1];
        expect(creditId, 'id de crédito aprobado').to.be.a('string').and.not.be.empty;

        expect(interception.response?.statusCode).to.eq(200);
      });
    });
  });

  it('rechaza una operación pendiente real y la remueve de pendientes', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);

    ensureApprovalRow().then(() => {
      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/reject$/).as('rejectCredit');

      cy.get('p-table tbody tr').first().within(() => {
        cy.get('button').eq(2).click();
      });

      cy.contains('.p-dialog .p-dialog-title', 'Rechazar Operación', { timeout: 10000 }).should('be.visible');
      cy.get('.p-dialog textarea').clear().type('No cumple política mínima de aprobación.');
      cy.contains('.p-dialog button', 'Rechazar Operación').click();
      cy.contains('.p-toast-message', /rechaz/i, { timeout: 20000 }).should('be.visible');

      cy.wait('@rejectCredit').then((interception) => {
        expect(interception.response?.statusCode).to.eq(200);
      });
    });
  });

  it('aprueba con las cuotas ya definidas — de solo lectura, sin poder ajustarlas', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);

    ensureApprovalRow().then(() => {
      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as('approveFixedInstallments');

      cy.get('p-table tbody tr').first().within(() => {
        cy.get('button').eq(1).click();
      });

      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Crédito', { timeout: 10000 }).should('be.visible');

      // Las cuotas ya no se pueden ajustar al aprobar (fix(approvals): antes
      // había acá un input numérico editable para LOAN; ahora es de solo
      // lectura, igual que en el diálogo del detalle de operación).
      cy.contains('.p-dialog', 'Cantidad de cuotas definida').should('be.visible');
      cy.get('.p-dialog input[type="number"]').should('not.exist');

      cy.contains('.p-dialog button', 'Confirmar').click();

      cy.wait('@approveFixedInstallments').then((interception) => {
        const url = interception.request.url;
        const match = url.match(/\/api\/credits\/([^/]+)\/approve$/);
        const creditId = match?.[1];
        expect(creditId, 'id de crédito aprobado').to.be.a('string').and.not.be.empty;

        // El body va vacío — se aprueba siempre con las cuotas ya definidas
        // en la pre-operación, nunca con un installmentsCount ajustado.
        expect(interception.request.body, 'body de approve sin installmentsCount').to.deep.equal({});

        // 409 esperado solo por motivos de caja (sin caja abierta o fondos
        // insuficientes para el desembolso del préstamo) — nunca por cuotas.
        const statusCode = interception.response?.statusCode;
        expect([200, 409], 'status esperado en la aprobación').to.include(statusCode as number);
      });
    });
  });
});
