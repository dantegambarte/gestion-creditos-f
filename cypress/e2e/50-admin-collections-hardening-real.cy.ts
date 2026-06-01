/**
 * SUITE REAL: Admin Collections — Hardening E2E
 *
 * Objetivo: estresar los flujos refactorizados con backend real,
 * intentando romper navegación, contexto y modal batch.
 */

/**
 * Abre el detalle de la primera planilla disponible.
 * @returns true cuando logró abrir detalle; false cuando no hay planillas visibles.
 */
function openFirstSheetDetailIfExists(): Cypress.Chainable<boolean> {
  return cy.get('body').then(($body) => {
    const hasSheetRows = $body.find('p-table tbody tr').length > 0;
    if (!hasSheetRows) {
      cy.contains('Planillas de cobro').should('be.visible');
      return false;
    }

    cy.get('p-table tbody tr').first().click();
    cy.contains('button', 'Todas', { timeout: 10000 }).should('be.visible');
    return true;
  });
}

/**
 * Busca una acción "Ver crédito" habilitada y la ejecuta.
 * @returns true si encontró un botón habilitado; false si no había ninguno.
 */
function openFirstEnabledCreditActionIfExists(): Cypress.Chainable<boolean> {
  return cy.get('body').then(($body) => {
    const enabledCount = $body.find(
      'button.sheet-action-link--credit:not(:disabled)',
    ).length;

    if (enabledCount === 0) {
      return false;
    }

    cy.get('button.sheet-action-link--credit:not(:disabled)').first().click();
    cy.location('pathname', { timeout: 15000 }).should(
      'match',
      /\/seller\/operations\/.+/,
    );
    return true;
  });
}

describe('Admin Collections — hardening real', () => {
  /**
   * Inicia sesión real por API e inyecta sesión interna antes de cargar la ruta.
   * Evita depender de caché de cy.session para este spec de hardening.
   */
  function loginAdminFreshToCollections(): void {
    const dni = String(Cypress.env('realAdminDni') ?? '').trim();
    const password = String(Cypress.env('realAdminPassword') ?? '').trim();
    const apiBaseUrl = String(Cypress.env('apiBaseUrl') ?? '').trim();

    expect(dni, 'realAdminDni').to.not.equal('');
    expect(password, 'realAdminPassword').to.not.equal('');
    expect(apiBaseUrl, 'apiBaseUrl').to.not.equal('');

    cy.request({
      method: 'POST',
      url: `${apiBaseUrl}/auth/login`,
      body: { dni, password },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status, '[hardening] login admin por API').to.eq(200);

      const token = res.body?.data?.token as string | undefined;
      const user = (res.body?.data?.user ?? null) as Record<
        string,
        unknown
      > | null;

      expect(token, '[hardening] token admin').to.be.a('string').and.not.be
        .empty;

      cy.visit('/admin/collections', {
        onBeforeLoad(win) {
          win.localStorage.setItem('sgcf_token', token as string);
          if (user) {
            win.localStorage.setItem('sgcf_user', JSON.stringify(user));
          }
        },
      });
    });
  }

  /**
   * Verifica que la ruta de colecciones cargó en un estado usable.
   * Acepta dos variantes válidas de UI: listado visible o detalle abierto.
   */
  function assertCollectionsScreenReady(): void {
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/admin/collections',
    );
    cy.get('app-admin-collections, app-loading-state', {
      timeout: 20000,
    }).should('exist');
  }

  beforeEach(() => {
    cy.viewport(1366, 768);
    loginAdminFreshToCollections();
    assertCollectionsScreenReady();
  });

  it('soporta query params inválidos sin romper la pantalla', () => {
    cy.visit('/admin/collections?openSheetId=no-existe&openTab=INVALID_TAB');
    assertCollectionsScreenReady();
  });

  it('preserva contexto al ir a Ver crédito y volver', () => {
    openFirstSheetDetailIfExists().then((openedDetail) => {
      if (!openedDetail) {
        return;
      }

      cy.contains('button', 'En mora').click();

      openFirstEnabledCreditActionIfExists().then((openedCredit) => {
        if (!openedCredit) {
          return;
        }

        cy.contains('button', 'Volver', { timeout: 15000 }).click();

        cy.location('pathname', { timeout: 15000 }).should(
          'eq',
          '/admin/collections',
        );
        cy.location('search').should('include', 'openSheetId=');
        cy.location('search').should('include', 'openTab=OVERDUE');
        cy.contains('button', 'En mora').should('be.visible');
        cy.get('app-error-state').should('not.exist');
      });
    });
  });

  it('muestra impacto de generación batch y no rompe al alternar regeneración', () => {
    cy.contains('button', 'Generar nueva planilla').click();
    cy.contains('Generar planilla de cobro', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains('Se van a generar', { timeout: 15000 }).should('be.visible');

    cy.get('body').then(($body) => {
      const hasRegenerateBox = $body.text().includes('Regenerar también las');
      if (!hasRegenerateBox) {
        cy.get('app-error-state').should('not.exist');
        return;
      }

      cy.contains('Regenerar también las').click();
      cy.contains('Se van a regenerar', { timeout: 8000 }).should('be.visible');

      cy.contains('Regenerar también las').click();
      cy.contains('Se van a regenerar').should('not.exist');
      cy.get('app-error-state').should('not.exist');
    });
  });

  it('tolera abrir/cerrar modal repetidamente sin degradar estado', () => {
    for (let i = 0; i < 3; i += 1) {
      cy.contains('button', 'Generar nueva planilla').click();
      cy.contains('Generar planilla de cobro', { timeout: 10000 }).should(
        'be.visible',
      );
      cy.contains('button', 'Cancelar').click();
      cy.contains('Generar planilla de cobro').should('not.exist');
    }

    cy.get('app-error-state').should('not.exist');
    cy.contains('h1', 'Planillas de cobro').should('be.visible');
  });

  it('resiste navegación browser back/forward manteniendo vista estable', () => {
    openFirstSheetDetailIfExists().then((openedDetail) => {
      if (!openedDetail) {
        return;
      }

      cy.go('back');
      cy.location('pathname', { timeout: 15000 }).should(
        'eq',
        '/admin/collections',
      );
      cy.get('app-error-state').should('not.exist');

      cy.go('forward');
      cy.location('pathname', { timeout: 15000 }).should(
        'eq',
        '/admin/collections',
      );
      cy.contains('button', 'Todas', { timeout: 10000 }).should('be.visible');
      cy.get('app-error-state').should('not.exist');
    });
  });

  it('evita estado roto con doble click rápido en abrir generación', () => {
    cy.contains('button', 'Generar nueva planilla').dblclick();
    cy.contains('Generar planilla de cobro', { timeout: 10000 }).should(
      'be.visible',
    );
    cy.get('app-error-state').should('not.exist');

    cy.contains('button', 'Cancelar').click();
    cy.contains('Generar planilla de cobro').should('not.exist');
  });

  it('mantiene estabilidad si se refresca estando en detalle abierto', () => {
    openFirstSheetDetailIfExists().then((openedDetail) => {
      if (!openedDetail) {
        return;
      }

      cy.reload();
      cy.contains('h1', 'Planillas de cobro', { timeout: 15000 }).should(
        'be.visible',
      );
      cy.get('app-error-state').should('not.exist');
    });
  });
});
