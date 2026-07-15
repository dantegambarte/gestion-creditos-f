/**
 * SUITE: Admin — Configuración — Notificaciones (Sistema de Notificaciones)
 *
 * Cubre:
 *  - Guardar preferencias persiste y refleja al recargar (PUT real por tipo).
 *  - Repetido en mobile (375x667) por regla obligatoria del CLAUDE.md de frontend.
 */

type PreferenceMock = {
  type: string;
  enabled: boolean;
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  updated_at: string;
};

const BASE_PREFERENCES: PreferenceMock[] = [
  { type: 'MORA', enabled: true, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'INSTALLMENT_DUE', enabled: true, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'APPROVAL_REQUEST', enabled: true, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'CASH_REGISTER', enabled: true, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
  { type: 'NEW_CUSTOMER', enabled: false, frequency: 'INSTANT', updated_at: '2026-01-01T00:00:00Z' },
];
const HISTORY_TITLE = 'Recordatorio de cierre de caja pendiente de confirmación';

const mockPreferences = (prefs: PreferenceMock[]) => {
  cy.intercept('GET', '**/api/notifications/preferences', {
    statusCode: 200,
    body: { ok: true, data: prefs },
  }).as('getPreferences');
};

const mockHistory = () => {
  cy.intercept('GET', '**/api/notifications?*', {
    statusCode: 200,
    body: {
      ok: true,
      data: {
        items: [
          {
            id: 'notif-history-1',
            type: 'CASH_REGISTER',
            title: HISTORY_TITLE,
            message: 'Mensaje de prueba',
            read_at: null,
            entity_type: null,
            entity_id: null,
            created_at: '2026-07-14T21:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      },
    },
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

  it('renderiza las 5 preferencias reales desde el backend', () => {
    cy.get('[data-cy^="notif-setting-"]').should('have.length', 5);
    cy.get('[data-cy="notif-setting-MORA"]').should('be.visible');
    cy.get('[data-cy="notif-setting-NEW_CUSTOMER"]').scrollIntoView().should('be.visible');
    cy.get('[data-cy="notif-save-btn"] button').should('be.disabled');
    cy.get('[data-cy="notif-history-mobile-list"]').should('not.exist');
    cy.contains('span', /^Recordatorio/).should(
      'have.attr',
      'title',
      HISTORY_TITLE,
    );
  });

  it('ignora preferencias desconocidas para evitar filas vacías', () => {
    mockPreferences([
      ...BASE_PREFERENCES,
      {
        type: 'UNKNOWN_LEGACY',
        enabled: true,
        frequency: 'INSTANT',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ]);

    cy.reload();
    cy.wait('@getPreferences');

    cy.get('[data-cy^="notif-setting-"]').should('have.length', 5);
    cy.get('[data-cy="notif-setting-UNKNOWN_LEGACY"]').should('not.exist');
  });

  it('guardar preferencias persiste y refleja al recargar', () => {
    cy.intercept('PUT', '**/api/notifications/preferences/*', (req) => {
      throw new Error(`No se esperaba PUT por tipo: ${req.url}`);
    }).as('unexpectedSingleUpdate');

    cy.intercept('PATCH', '**/api/notifications/preferences', (req) => {
      expect(req.body.preferences).to.deep.equal([
        { type: 'NEW_CUSTOMER', enabled: true },
      ]);
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: [{ ...BASE_PREFERENCES[4], enabled: true }],
          message: 'Preferencias actualizadas correctamente.',
        },
      });
    }).as('updatePreferences');

    cy.get('[data-cy="notif-toggle-push-NEW_CUSTOMER"]').click();
    cy.get('[data-cy="notif-save-btn"] button').should('not.be.disabled');
    cy.get('[data-cy="notif-save-btn"]').click();

    cy.wait('@updatePreferences');
    cy.get('[data-cy="notif-save-btn"] button').should('be.disabled');

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

  it('renderiza las 5 preferencias reales desde el backend en mobile', () => {
    cy.get('[data-cy^="notif-setting-"]').should('have.length', 5);
    cy.get('[data-cy="notif-setting-MORA"]').should('be.visible');
    cy.get('[data-cy="notif-setting-NEW_CUSTOMER"]').scrollIntoView().should('be.visible');
    cy.get('[data-cy="notif-save-btn"] button').should('be.disabled');

    cy.get('[data-cy="notif-info-panels"]').then(($panels) => {
      cy.get('[data-cy="notif-setting-NEW_CUSTOMER"]').then(($lastSetting) => {
        const panelsRect = $panels[0].getBoundingClientRect();
        const settingRect = $lastSetting[0].getBoundingClientRect();
        expect(panelsRect.top).to.be.gte(settingRect.bottom - 1);
      });
    });

    cy.window().then((win) => {
      expect(win.document.documentElement.scrollWidth).to.be.lte(
        win.innerWidth,
      );
    });

    cy.get('[data-cy="notif-history-toggle"]').click();
    cy.get('[data-cy="notif-history-mobile-list"]').should('be.visible');
    cy.get('[data-cy="notif-history-mobile-list"]')
      .contains('span', /^Recordatorio/)
      .should('have.attr', 'title', HISTORY_TITLE);
  });

  it('guardar preferencias persiste en mobile', () => {
    cy.intercept('PATCH', '**/api/notifications/preferences', (req) => {
      expect(req.body.preferences).to.deep.equal([
        { type: 'NEW_CUSTOMER', enabled: true },
      ]);
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: [{ ...BASE_PREFERENCES[4], enabled: true }],
          message: 'Preferencias actualizadas correctamente.',
        },
      });
    }).as('updatePreferences');

    cy.get('[data-cy="notif-toggle-push-NEW_CUSTOMER"]').click();
    cy.get('[data-cy="notif-save-btn"] button').should('be.visible');
    cy.get('[data-cy="notif-save-btn"]').click();
    cy.wait('@updatePreferences');
  });
});
