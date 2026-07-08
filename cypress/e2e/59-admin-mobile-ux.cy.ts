const ADMIN_APPROVALS_URL = '/admin/approvals';

const usersResponse = {
  ok: true,
  data: [
    {
      id: 'usr-mobile-ux-1',
      full_name: 'QA Mobile Admin',
      fullName: 'QA Mobile Admin',
      dni: '45999111',
      email: 'qa.mobile.admin@finflow.test',
      address: 'Calle Mobile 123',
      role: 'ADMIN',
      status: 'ACTIVE',
      is_temp_password: false,
      isTempPassword: false,
      failed_attempts: 0,
      failedAttempts: 0,
      locked_at: null,
      lockedAt: null,
      last_login_at: '2026-06-20T12:00:00.000Z',
      lastLoginAt: '2026-06-20T12:00:00.000Z',
      created_at: '2026-06-01T12:00:00.000Z',
      createdAt: '2026-06-01T12:00:00.000Z',
    },
    {
      id: 'usr-mobile-ux-2',
      full_name: 'Cobrador Mobile',
      fullName: 'Cobrador Mobile',
      dni: '45999222',
      email: 'cobrador.mobile@finflow.test',
      address: 'Calle Mobile 456',
      role: 'COLLECTOR',
      status: 'ACTIVE',
      is_temp_password: true,
      isTempPassword: true,
      failed_attempts: 0,
      failedAttempts: 0,
      locked_at: null,
      lockedAt: null,
      last_login_at: null,
      lastLoginAt: null,
      created_at: '2026-06-02T12:00:00.000Z',
      createdAt: '2026-06-02T12:00:00.000Z',
    },
  ],
};

/**
 * Obtiene el token interno real desde localStorage.
 */
const getAuthToken = (): Cypress.Chainable<string> => {
  return cy.window().then((win) => {
    const token = win.localStorage.getItem('sgcf_token');
    expect(token, 'token sgcf_token').to.be.a('string').and.not.be.empty;
    return token as string;
  });
};

/**
 * Crea una operación préstamo real para garantizar una aprobación pendiente.
 */
const createRealPendingLoan = (): Cypress.Chainable<string> => {
  cy.loginReal('ADMIN', '/admin/operations/new');
  cy.intercept('POST', '/api/credits').as('createMobileApprovalCredit');
  cy.get('[data-cy="btn-type-loan"]', { timeout: 20000 }).click({
    force: true,
  });
  cy.contains('Paso 2 de 5', { timeout: 20000 }).should('be.visible');

  cy.contains('[data-cy^="client-card-"]', 'ACTIVO', { timeout: 20000 })
    .should('be.visible')
    .click({ force: true });
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('p-inputNumber[formControlName="totalAmount"] input')
    .clear()
    .type('67000')
    .blur();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('[data-cy="ddl-installments"] .p-dropdown')
    .first()
    .click({ force: true });
  cy.get('.p-dropdown-panel .p-dropdown-item').first().click({ force: true });
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

  cy.get('[data-cy="chk-identity"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-conditions"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-disbursement"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="chk-capacity"] .p-checkbox-box').click({ force: true });
  cy.get('[data-cy="btn-enviar-aprobacion"] button')
    .should('not.be.disabled')
    .click();

  cy.contains('.p-toast-message', 'Operación enviada', {
    timeout: 20000,
  }).should('be.visible');
  return cy.wait('@createMobileApprovalCredit').then((interception) => {
    const createdId = interception.response?.body?.data?.id as
      | string
      | undefined;
    expect(createdId, 'id crédito pendiente mobile').to.be.a('string').and.not
      .be.empty;
    return createdId as string;
  });
};

/**
 * Garantiza caja operativa abierta en la jornada actual — aprobar un LOAN
 * desembolsa el préstamo desde la caja activa, sin ella responde 409.
 * No falla si ya existe una (409 ACTIVE_SESSION_IN_BUSINESS_DAY).
 */
const ensureCashSessionOpen = (): Cypress.Chainable<void> => {
  return cy.getAuthToken('ADMIN').then((token) =>
    cy
      .apiRequest('POST', '/cash-sessions', { opening_amount: 100000000 }, token)
      .then((res) => {
        expect(
          [201, 409],
          'abrir caja operativa (nueva o ya existente)',
        ).to.include(res.status);
      }),
  );
};

/**
 * Garantiza que Aprobaciones tenga al menos una card accionable en mobile.
 */
const ensureMobileApprovalCard = (): Cypress.Chainable<void> => {
  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_APPROVALS_URL);

  return ensureCashSessionOpen().then(() =>
    cy.get('body', { timeout: 20000 }).then(($body) => {
      if ($body.find('[data-cy="admin-approvals-mobile-card"]').length > 0) {
        return;
      }

      return createRealPendingLoan().then(() => {
        cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);
        cy.get('[data-cy="admin-approvals-mobile-card"]', {
          timeout: 20000,
        }).should('have.length.greaterThan', 0);
      });
    }),
  );
};

describe('Admin Backoffice — Mobile UX', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('Aprobaciones — usa cards mobile, búsqueda responsiva y aprueba desde mobile', () => {
    cy.loginReal('ADMIN', ADMIN_APPROVALS_URL);
    ensureMobileApprovalCard().then(() => {
      cy.get('[data-cy="admin-approvals-search-input"]')
        .should('be.visible')
        .then(($input) => {
          const rect = $input[0].getBoundingClientRect();
          const styles = getComputedStyle($input[0]);
          const viewportWidth = $input[0].ownerDocument.defaultView?.innerWidth ?? 375;
          expect(rect.width).to.be.greaterThan(viewportWidth * 0.7);
          expect(parseFloat(styles.fontSize)).to.be.at.least(16);
        });

      cy.get('[data-cy="admin-approvals-type-filter"]').click();
      cy.get('.p-dropdown-panel .p-dropdown-item').contains('Préstamo').click();
      cy.get('[data-cy="admin-approvals-type-filter"] .p-dropdown-clear-icon')
        .should('be.visible')
        .then(($clear) => {
          const rect = $clear[0].getBoundingClientRect();
          expect(rect.width).to.be.at.least(32);
          expect(rect.height).to.be.at.least(32);
        });

      cy.get('[data-cy="admin-approvals-page"] table').should('not.be.visible');
      cy.get('[data-cy="admin-approvals-mobile-card"]')
        .first()
        .should('be.visible');
      cy.contains('[data-cy="admin-approvals-mobile-card"] button', 'Rechazar')
        .first()
        .should('have.class', 'ff-reject-action')
        .then(($button) => {
          expect(getComputedStyle($button[0]).backgroundColor).to.not.eq('rgb(220, 38, 38)');
        });

      cy.get('[data-cy="admin-approvals-back-top-action"]').should('not.exist');
      cy.get('[data-cy="admin-approvals-mobile-card"]').then(($cards) => {
        if ($cards.length > 5) {
          cy.get('.ff-shell__main').scrollTo(0, 700);
          cy.get('[data-cy="admin-approvals-back-top-action"]').should('be.visible').then(($button) => {
            const rect = $button[0].getBoundingClientRect();
            const viewportWidth = $button[0].ownerDocument.defaultView?.innerWidth ?? 375;
            expect(rect.right).to.be.greaterThan(viewportWidth - 72);
          }).click();
          cy.get('[data-cy="admin-approvals-search-input"]').should('be.visible');
        }
      });

      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as(
        'approveMobileCredit',
      );
      cy.get('[data-cy="admin-approvals-mobile-approve-action"]')
        .first()
        .click();
      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', {
        timeout: 10000,
      }).should('be.visible');
      cy.contains('.p-dialog button', 'Confirmar Aprobación').click();

      cy.wait('@approveMobileCredit', { timeout: 30000 }).then(
        (interception) => {
          expect(interception.response?.statusCode).to.eq(200);
        },
      );
    });
  });

  it('Skeletons en Usuarios — aparecen con delay y luego renderizan cards finales', () => {
    let releaseUsers: () => void;
    const usersGate = new Promise<void>((resolve) => {
      releaseUsers = resolve;
    });

    cy.intercept({ method: 'GET', url: '**/api/users*', times: 1 }, (req) => {
      req.reply(async () => {
        await usersGate;
        return {
          statusCode: 200,
          body: usersResponse,
        };
      });
    }).as('usersDelayed');

    cy.loginReal('ADMIN', '/admin/users');

    cy.get('[data-cy="admin-users-search-input"]')
      .should('be.visible')
      .then(($input) => {
        const rect = $input[0].getBoundingClientRect();
        const styles = getComputedStyle($input[0]);
        const viewportWidth = $input[0].ownerDocument.defaultView?.innerWidth ?? 375;
        expect(rect.width).to.be.greaterThan(viewportWidth * 0.7);
        expect(parseFloat(styles.fontSize)).to.be.at.least(16);
      });
    cy.get('[data-cy="admin-users-mobile-skeleton-list"]').should('be.visible');
    cy.get('[data-cy="admin-users-mobile-skeleton-card"] .p-skeleton').should(
      'have.length.at.least',
      8,
    );

    cy.then(() => releaseUsers());
    cy.wait('@usersDelayed');
    cy.get('[data-cy="admin-users-mobile-skeleton-list"]').should('not.exist');
    cy.get('[data-cy="admin-users-page"] table').should('not.be.visible');
    cy.get('[data-cy="admin-users-mobile-card"]').should(
      'have.length.at.least',
      2,
    );
    cy.get('[data-cy="admin-users-mobile-view-detail-action"]')
      .first()
      .should('be.visible');

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });
  });
});
