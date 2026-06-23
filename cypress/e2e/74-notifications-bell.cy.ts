/**
 * SUITE: Campana de notificaciones (header) — Sistema de Notificaciones
 *
 * Cubre:
 *  - La campana muestra el unread-count real recibido del backend (badge numérico).
 *  - Abrir el dropdown lista las últimas notificaciones y permite marcar como leída,
 *    decrementando el contador.
 *  - Repetido en mobile (375x667) por regla obligatoria del CLAUDE.md de frontend.
 */

const NOTIF_ITEM = {
  id: 'notif-1',
  type: 'MORA',
  title: 'Mora detectada',
  message: 'La cuota Nº 2 del cliente "Cliente Test" entró en mora.',
  read_at: null,
  entity_type: 'credit',
  entity_id: 'credit-1',
  created_at: '2026-06-20T10:00:00Z',
};

const mockUnreadCount = (count: number) => {
  cy.intercept('GET', '**/api/notifications/unread-count', {
    statusCode: 200,
    body: { ok: true, data: { count } },
  }).as('unreadCount');
};

const mockHistory = (items: typeof NOTIF_ITEM[]) => {
  cy.intercept('GET', '**/api/notifications?*', {
    statusCode: 200,
    body: { ok: true, data: { items, total: items.length, page: 1, limit: 10 } },
  }).as('historyList');
};

describe('Header — Campana de notificaciones (Desktop)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    mockUnreadCount(3);
    mockHistory([NOTIF_ITEM]);
    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.wait('@unreadCount');
  });

  it('muestra el badge con el unread-count real del backend', () => {
    cy.get('[data-cy="header-bell-badge"]').should('be.visible').and('contain.text', '3');
  });

  it('al abrir el dropdown lista las últimas notificaciones y marcar como leída decrementa el contador', () => {
    cy.intercept('POST', '**/api/notifications/notif-1/read', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificación marcada como leída.' },
    }).as('markRead');
    mockUnreadCount(2);

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-dropdown"]').should('be.visible');
    cy.contains('[data-cy="header-bell-item"]', 'Mora detectada').click();

    cy.wait('@markRead');
    cy.wait('@unreadCount');
    cy.get('[data-cy="header-bell-badge"]').should('contain.text', '2');
  });
});

describe('Header — Campana de notificaciones (Mobile 375x667)', () => {
  beforeEach(() => {
    cy.viewport(375, 667);
    mockUnreadCount(3);
    mockHistory([NOTIF_ITEM]);
    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.wait('@unreadCount');
  });

  it('muestra el badge con el unread-count real del backend en mobile', () => {
    cy.get('[data-cy="header-bell-badge"]').should('be.visible').and('contain.text', '3');
  });

  it('al abrir el dropdown en mobile lista las últimas notificaciones y marcar como leída decrementa el contador', () => {
    cy.intercept('POST', '**/api/notifications/notif-1/read', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificación marcada como leída.' },
    }).as('markRead');
    mockUnreadCount(2);

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-dropdown"]').should('be.visible');
    cy.contains('[data-cy="header-bell-item"]', 'Mora detectada').click();

    cy.wait('@markRead');
    cy.wait('@unreadCount');
    cy.get('[data-cy="header-bell-badge"]').should('contain.text', '2');
  });
});
