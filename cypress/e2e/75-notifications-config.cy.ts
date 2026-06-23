/**
 * SUITE: Admin — Configuración — Notificaciones (Sistema de Notificaciones)
 *
 * Cubre:
 *  - Guardar preferencias persiste y refleja al recargar (PUT real por tipo).
 *  - El toggle de WhatsApp deshabilitado no dispara ninguna request de red.
 *  - Repetido en mobile (375x667) por regla obligatoria del CLAUDE.md de frontend.
 */

const BASE_PREFERENCES = [
  { type: 'MORA', enabled: true, email_enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'INSTALLMENT_DUE', enabled: true, email_enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'APPROVAL_REQUEST', enabled: true, email_enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'CASH_REGISTER', enabled: true, email_enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'NEW_CUSTOMER', enabled: false, email_enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'WEEKLY_REPORT', enabled: false, email_enabled: false, frequency: 'WEEKLY', updated_at: '2026-01-01T00:00:00Z' },
];

const mockPreferences = (prefs: typeof BASE_PREFERENCES) => {
  cy.intercept('GET', '**/api/notifications/preferences', {
    statusCode: 200,
    body: { ok: true, data: prefs },
  }).as('getPreferences');
};

const mockHistory = () => {
  cy.intercept('GET', '**/api/notifications?*', {
    statusCode: 200,
    body: { ok: true, data: { items: [], total: 0, page: 1, limit: 10 } },
  }).as('historyList');
};

const mockUnreadCount = () => {
  cy.intercept('GET', '**/api/notifications/unread-count', {
    statusCode: 200,
    body: { ok: true, data: { count: 0 } },
  }).as('unreadCount');
};

describe('Admin — Configuración — Notificaciones (Desktop)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    mockPreferences(BASE_PREFERENCES);
    mockHistory();
    mockUnreadCount();
    cy.loginAs('ADMIN', '/admin/config/notifications');
    cy.wait('@getPreferences');
  });

  it('renderiza las 6 preferencias reales desde el backend', () => {
    cy.get('[data-cy="notif-setting-MORA"]').should('be.visible');
    cy.get('[data-cy="notif-setting-WEEKLY_REPORT"]').scrollIntoView().should('be.visible');
  });

  it('guardar preferencias persiste y refleja al recargar', () => {
    // Cypress usa el intercept MÁS RECIENTE cuando varios matchean la misma request:
    // el genérico va PRIMERO para que el específico de NEW_CUSTOMER (registrado después) tenga prioridad.
    cy.intercept('PUT', '**/api/notifications/preferences/*', {
      statusCode: 200,
      body: { ok: true, data: {}, message: 'Preferencia actualizada correctamente.' },
    }).as('updateGeneric');

    cy.intercept('PUT', '**/api/notifications/preferences/NEW_CUSTOMER', (req) => {
      expect(req.body.enabled).to.equal(true);
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: { ...BASE_PREFERENCES[4], enabled: true },
          message: 'Preferencia actualizada correctamente.',
        },
      });
    }).as('updateNewCustomer');

    cy.get('[data-cy="notif-toggle-push-NEW_CUSTOMER"]').click();
    cy.get('[data-cy="notif-save-btn"]').click();

    cy.wait('@updateNewCustomer');

    // Recargar con preferencias ya persistidas (NEW_CUSTOMER ahora enabled=true).
    const updatedPrefs = BASE_PREFERENCES.map((p) =>
      p.type === 'NEW_CUSTOMER' ? { ...p, enabled: true } : p,
    );
    mockPreferences(updatedPrefs);
    cy.reload();
    cy.wait('@getPreferences');

    cy.get('[data-cy="notif-setting-NEW_CUSTOMER"]')
      .find('[data-cy="notif-toggle-push-NEW_CUSTOMER"] .p-inputswitch')
      .should('have.class', 'p-inputswitch-checked');
  });

  it('el toggle de WhatsApp deshabilitado no dispara ninguna request de red', () => {
    cy.intercept('PUT', '**/whatsapp*').as('whatsappRequest');
    cy.intercept('POST', '**/whatsapp*').as('whatsappPost');

    cy.get('[data-cy="notif-toggle-whatsapp"]').find('.p-inputswitch').should('have.class', 'p-disabled');
    cy.get('[data-cy="notif-toggle-whatsapp"]').click({ force: true });

    cy.get('@whatsappRequest.all').should('have.length', 0);
    cy.get('@whatsappPost.all').should('have.length', 0);
  });
});

describe('Admin — Configuración — Notificaciones (Mobile 375x667)', () => {
  beforeEach(() => {
    cy.viewport(375, 667);
    mockPreferences(BASE_PREFERENCES);
    mockHistory();
    mockUnreadCount();
    cy.loginAs('ADMIN', '/admin/config/notifications');
    cy.wait('@getPreferences');
  });

  it('renderiza las 6 preferencias reales desde el backend en mobile', () => {
    cy.get('[data-cy="notif-setting-MORA"]').should('be.visible');
    cy.get('[data-cy="notif-setting-WEEKLY_REPORT"]').scrollIntoView().should('be.visible');
  });

  it('guardar preferencias persiste en mobile', () => {
    cy.intercept('PUT', '**/api/notifications/preferences/*', {
      statusCode: 200,
      body: { ok: true, data: {}, message: 'Preferencia actualizada correctamente.' },
    }).as('updateGeneric');

    cy.get('[data-cy="notif-toggle-push-NEW_CUSTOMER"]').click();
    cy.get('[data-cy="notif-save-btn"]').click();
    cy.wait('@updateGeneric');
  });

  it('el toggle de WhatsApp deshabilitado no dispara ninguna request de red en mobile', () => {
    cy.intercept('PUT', '**/whatsapp*').as('whatsappRequest');

    cy.get('[data-cy="notif-toggle-whatsapp"]').find('.p-inputswitch').should('have.class', 'p-disabled');
    cy.get('[data-cy="notif-toggle-whatsapp"]').click({ force: true });

    cy.get('@whatsappRequest.all').should('have.length', 0);
  });
});
