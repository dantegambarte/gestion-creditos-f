/**
 * SUITE: Campana de notificaciones (header) — Sistema de Notificaciones
 *
 * Cubre:
 *  - La campana muestra el unread-count real recibido del backend (badge numérico).
 *  - Abrir el dropdown lista las últimas notificaciones y permite marcar como leída,
 *    decrementando el contador.
 *  - Permite navegar al destino asociado y borrar una o todas las notificaciones.
 *  - Repetido en mobile (375x667) por regla obligatoria del CLAUDE.md de frontend.
 */

export {};

type MockNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

const NOTIF_ITEM: MockNotification = {
  id: 'notif-1',
  type: 'MORA',
  title: 'Mora detectada',
  message: 'La cuota Nº 2 del cliente "Cliente Test" entró en mora.',
  read_at: null,
  entity_type: null,
  entity_id: null,
  created_at: '2026-06-20T10:00:00Z',
};

const NAV_NOTIF = {
  ...NOTIF_ITEM,
  id: 'notif-nav-1',
  entity_type: 'credit',
  entity_id: 'credit-1',
};

const manyNotifications = Array.from({ length: 8 }, (_, index) => ({
  ...NOTIF_ITEM,
  id: `notif-${index + 1}`,
  message: `La cuota Nº 1 del cliente "Cliente ${index + 1}" entró en mora.`,
}));

const mockUnreadCount = (count: number) => {
  cy.intercept('GET', '**/api/notifications/unread-count', {
    statusCode: 200,
    body: { ok: true, data: { count } },
  }).as('unreadCount');
};

const mockHistory = (items: MockNotification[]) => {
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

  it('redirige al destino asociado al hacer click sobre una notificación', () => {
    mockHistory([NAV_NOTIF]);
    cy.intercept('POST', '**/api/notifications/notif-nav-1/read', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificación marcada como leída.' },
    }).as('markRead');

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.contains('[data-cy="header-bell-item"]', 'Mora detectada').click();

    cy.wait('@markRead');
    cy.location('pathname').should('include', '/admin/operations/credit-1');
  });

  it('permite borrar una notificación individual', () => {
    cy.intercept('DELETE', '**/api/notifications/notif-1', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificación borrada correctamente.' },
    }).as('deleteNotification');
    mockUnreadCount(2);

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-delete-item"]').click();

    cy.wait('@deleteNotification');
    cy.contains('[data-cy="header-bell-item"]', 'Mora detectada').should('not.exist');
  });

  it('permite borrar todas las notificaciones', () => {
    cy.intercept('DELETE', '**/api/notifications', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificaciones borradas correctamente.' },
    }).as('deleteAllNotifications');

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-clear-all"]').click();

    cy.wait('@deleteAllNotifications');
    cy.contains('No tenés notificaciones.').should('be.visible');
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

  it('acomoda el dropdown dentro del viewport mobile y scrollea la lista', () => {
    mockHistory(manyNotifications);

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');

    cy.get('.app-header__bell-panel').should(($panel) => {
      const rect = $panel[0].getBoundingClientRect();
      expect(rect.left).to.be.at.least(0);
      expect(rect.right).to.be.at.most(375);
      expect(rect.top).to.be.at.least(0);
      expect(rect.bottom).to.be.at.most(667);
    });

    cy.get('.app-header__notification-list').should(($list) => {
      const el = $list[0];
      expect(el.scrollHeight).to.be.greaterThan(el.clientHeight);
    });
  });

  it('permite borrar una notificación individual en mobile', () => {
    cy.intercept('DELETE', '**/api/notifications/notif-1', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificación borrada correctamente.' },
    }).as('deleteNotification');
    mockUnreadCount(2);

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-delete-item"]').click();

    cy.wait('@deleteNotification');
    cy.contains('[data-cy="header-bell-item"]', 'Mora detectada').should('not.exist');
  });

  it('permite borrar todas las notificaciones en mobile', () => {
    cy.intercept('DELETE', '**/api/notifications', {
      statusCode: 200,
      body: { ok: true, data: null, message: 'Notificaciones borradas correctamente.' },
    }).as('deleteAllNotifications');

    cy.get('[data-cy="header-bell-btn"]').click();
    cy.wait('@historyList');
    cy.get('[data-cy="header-bell-clear-all"]').click();

    cy.wait('@deleteAllNotifications');
    cy.contains('No tenés notificaciones.').should('be.visible');
  });
});
