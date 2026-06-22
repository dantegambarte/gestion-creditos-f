/**
 * SUITE: Sidebar y Navegación por Rol
 *
 * Cubre:
 *  - Admin ve todos los grupos y rutas de admin
 *  - Seller solo ve secciones de Gestión (no Administración, Sistema)
 *  - Collector ve sólo "Cobranza en campo"
 *  - authGuard: ruta protegida sin sesión → redirige a /login
 *  - roleGuard: Admin no puede acceder a /collector/*
 *  - Navegación activa resalta el ítem correcto
 */

describe('Sidebar y Guardias de Ruta', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
  });

  // ── Admin — menú completo ────────────────────────────────────────────────────
  describe('Admin', () => {
    beforeEach(() => {
      cy.loginAs('ADMIN', '/admin/clients');
      cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');
      cy.get('body', { timeout: 15000 }).then(($body) => {
        const hasSidebar =
          $body.find('aside').length > 0 ||
          $body.find('.sidebar').length > 0 ||
          $body.find('.app-sidebar').length > 0;

        if (!hasSidebar) {
          cy.loginAs('ADMIN', '/admin/clients');
          cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');
        }
      });
      cy.get('aside, .sidebar, .app-sidebar', { timeout: 15000 }).should('be.visible');
    });

    it('muestra grupos Principal, Gestión, Administración y Sistema', () => {
      cy.contains('aside span', 'Principal').should('be.visible');
      cy.contains('aside span', 'Gestión').should('be.visible');
      cy.contains('aside span', 'Administración').should('be.visible');
      // 'Sistema' puede estar debajo del fold del sidebar scrollable — scrollIntoView
      cy.contains('aside span', 'Sistema').scrollIntoView().should('be.visible');
    });

    it('muestra items exclusivos de admin: Usuarios, Aprobaciones, Reportes, Configuración', () => {
      cy.contains('aside', 'Usuarios').should('be.visible');
      cy.contains('aside a.nav-item', 'Aprobaciones').should('be.visible');
      cy.contains('aside', 'Reportes').should('be.visible');
      cy.contains('aside', 'Configuración').should('be.visible');
    });

    it('el badge de Aprobaciones (si existe) tiene formato visible y no vacío', () => {
      cy.get('[data-testid="nav-aprobaciones"]').scrollIntoView().should('be.visible');
      cy.get('body').then(($body) => {
        const badge = $body.find('[data-testid="nav-aprobaciones"] .nav-item__badge');
        if (badge.length === 0) {
          cy.get('[data-testid="nav-aprobaciones"]').should('be.visible');
          return;
        }

        cy.wrap(badge)
          .should('be.visible')
          .invoke('text')
          .then((text) => {
            const normalized = text.trim();
            expect(normalized).to.not.equal('');
            expect(normalized).to.match(/^\d+$/);
          });
      });
    });

    it('navega a /admin/clients al hacer clic en Clientes', () => {
      cy.contains('aside a', 'Clientes').click();
      cy.url().should('include', '/admin/clients');
    });

    it('navega a /admin/approvals al hacer clic en Aprobaciones', () => {
      cy.contains('aside a.nav-item', 'Aprobaciones').scrollIntoView().click();
      cy.url().should('include', '/admin/approvals');
    });

    it('el ítem activo tiene estilo de selección', () => {
      cy.contains('aside a', 'Clientes')
        .should('have.class', 'nav-item--active');
    });

    it('muestra información del usuario autenticado en el sidebar', () => {
      cy.get('aside').within(() => {
        cy.contains('ADMIN').should('be.visible');
        cy.get('.sidebar__user-name').should('be.visible').invoke('text').then((text) => {
          expect(text.trim()).to.not.equal('');
        });
      });
    });
  });

  // ── Seller — menú restringido ────────────────────────────────────────────────
  describe('Seller', () => {
    beforeEach(() => {
      cy.loginAs('SELLER', '/seller/operations');
      cy.get('aside').should('be.visible');
    });

    it('muestra sección Gestión pero NO Administración ni Sistema', () => {
      cy.contains('aside span', 'Gestión').should('be.visible');
      cy.contains('aside span', 'Administración').should('not.exist');
      cy.contains('aside span', 'Sistema').should('not.exist');
    });

    it('muestra Operaciones, Clientes y Productos pero no Dashboard ni Usuarios', () => {
      cy.contains('aside', 'Operaciones').should('be.visible');
      cy.contains('aside', 'Clientes').should('be.visible');
      cy.contains('aside', 'Productos').should('be.visible');
      cy.contains('aside a', 'Dashboard').should('not.exist');
      cy.contains('aside a', 'Usuarios').should('not.exist');
    });

    it('no muestra el grupo "Principal" de admin', () => {
      cy.contains('aside span', 'Principal').should('not.exist');
    });
  });

  // ── Collector — menú restringido ─────────────────────────────────────────────
  describe('Collector', () => {
    beforeEach(() => {
      cy.loginAs('COLLECTOR', '/collector/route');
      cy.get('aside').should('be.visible');
    });

    it('muestra sección "Cobranza en campo" con Mi Ruta, Mis cobros, Mis comisiones', () => {
      cy.contains('aside span', 'Cobranza en campo').should('be.visible');
      cy.contains('aside a', 'Mi Ruta').should('be.visible');
      cy.contains('aside a', 'Mis cobros').should('be.visible');
      cy.contains('aside a', 'Mis comisiones').should('be.visible');
    });

    it('no muestra secciones de Admin ni Seller', () => {
      cy.contains('aside span', 'Administración').should('not.exist');
      cy.contains('aside span', 'Gestión').should('not.exist');
    });
  });

  // ── authGuard ────────────────────────────────────────────────────────────────
  describe('authGuard', () => {
    it('redirige a /login cuando no hay sesión activa', () => {
      cy.logout();
      cy.visit('/admin/dashboard');
      cy.url().should('include', '/login');
    });

    it('redirige a /login cuando accede a ruta de seller sin sesión', () => {
      cy.logout();
      cy.visit('/seller/operations');
      cy.url().should('include', '/login');
    });
  });

  // ── roleGuard ─────────────────────────────────────────────────────────────────
  describe('roleGuard', () => {
    it('Admin accediendo a /collector/route es redirigido (guard activo)', () => {
      cy.loginAs('ADMIN');
      cy.visit('/collector/route');
      // roleGuard debe redirigir — la URL no debe quedarse en /collector/route
      cy.url().should('not.include', '/collector/route');
    });

    it('Collector accediendo a /admin/dashboard es redirigido (guard activo)', () => {
      cy.loginAs('COLLECTOR');
      cy.visit('/admin/dashboard');
      cy.url().should('not.include', '/admin/dashboard');
    });
  });
});
