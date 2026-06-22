/**
 * Suite mobile UI/UX: valida el App Shell y Clientes contra viewport celular.
 * No crea datos: solo revisa navegación, layout responsive y accesibilidad visual.
 */
describe('57 - Mobile UX validation', () => {
  const mobileLabels = [
    'Dashboard',
    'Operaciones',
    'Clientes',
    'Productos',
    'Más',
  ];
  const createDialogFields = [
    'input[formControlName="nombres"]',
    'input[formControlName="apellidos"]',
    'input[formControlName="dni"]',
    'input[formControlName="telefonoPrincipal"]',
    'input[formControlName="email"]',
    'input[formControlName="direccion"]',
  ];
  const missingClientSearch = 'cliente-inexistente-qa-375';

  /**
   * Verifica que un elemento visible no quede fuera del viewport mobile.
   * @param selector Selector del elemento a medir.
   */
  const shouldBeInsideViewport = (selector: string) => {
    cy.get(selector)
      .should('be.visible')
      .should(($el) => {
        const rect = $el[0].getBoundingClientRect();
        const win = $el[0].ownerDocument.defaultView;

        expect(rect.top, `${selector} top`).to.be.at.least(0);
        expect(rect.left, `${selector} left`).to.be.at.least(0);
        expect(rect.right, `${selector} right`).to.be.at.most(
          win?.innerWidth ?? 0,
        );
        expect(rect.bottom, `${selector} bottom`).to.be.at.most(
          win?.innerHeight ?? 0,
        );
      });
  };

  /**
   * Valida que los botones críticos del dialog estén visibles y dentro de pantalla.
   */
  const assertDialogFooterButtonsVisible = () => {
    ['Cancelar', 'Borrar', 'Crear Cliente'].forEach((label) => {
      cy.contains('.p-dialog-footer button', label, { timeout: 10000 })
        .should('be.visible')
        .then(($button) => {
          const rect = $button[0].getBoundingClientRect();
          const win = $button[0].ownerDocument.defaultView;

          expect(rect.top, `${label} top`).to.be.at.least(0);
          expect(rect.left, `${label} left`).to.be.at.least(0);
          expect(rect.right, `${label} right`).to.be.at.most(
            win?.innerWidth ?? 0,
          );
          expect(rect.bottom, `${label} bottom`).to.be.at.most(
            win?.innerHeight ?? 0,
          );
        });
    });
  };

  beforeEach(() => {
    cy.viewport(375, 667);
    cy.loginAs('ADMIN', '/admin/dashboard');
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/admin/dashboard',
    );
  });

  it('Fase 1 - muestra App Shell mobile con header compacto y Bottom Navigation fijo', () => {
    cy.get('aside.sidebar').should('not.be.visible');

    cy.get('.app-header', { timeout: 15000 }).should('be.visible');
    cy.get('.app-header__mobile-logo')
      .should('be.visible')
      .and('contain.text', 'finFlow');
    cy.get('.app-header__avatar').should('be.visible');

    cy.get('.mobile-bottom-nav')
      .should('be.visible')
      .and('have.css', 'position', 'fixed')
      .and('have.css', 'bottom', '0px');

    cy.get('.mobile-bottom-nav__item').should('have.length', 5);
    mobileLabels.forEach((label) => {
      cy.contains('.mobile-bottom-nav__item', label).should('be.visible');
    });

    shouldBeInsideViewport('.mobile-bottom-nav');
  });

  it('Fase 2 - navega a Clientes y valida lista mobile y modal Crear Cliente', () => {
    cy.intercept('GET', '**/customers*', (req) => {
      req.continue((res) => {
        res.setDelay(600);
      });
    }).as('customersList');

    cy.contains('.mobile-bottom-nav__item', 'Clientes').click();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');

    cy.contains('h1', 'Gestión de Clientes', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.get('[data-cy="input-buscar-cliente"]').should('be.visible');
    cy.get('[data-cy="btn-nuevo-cliente"]').should('be.visible');
    cy.get('[data-cy="btn-nuevo-cliente"] button').should('be.enabled');

    cy.get('[data-cy="clients-mobile-skeleton"]', { timeout: 10000 })
      .should('be.visible')
      .find('p-skeleton')
      .should('have.length.greaterThan', 0);
    cy.get('[data-cy="clients-desktop-skeleton"]').should('not.be.visible');
    cy.wait('@customersList');

    cy.get('.clients-mobile-list').should('be.visible');
    cy.get('[data-cy="clients-mobile-skeleton"]').should('not.exist');
    cy.get('p-table').should('not.be.visible');
    cy.get('.clients-mobile-card', { timeout: 20000 })
      .should('have.length.greaterThan', 0)
      .first()
      .should('be.visible')
      .within(() => {
        cy.get('.clients-mobile-card__avatar').should('be.visible');
        cy.get('.clients-mobile-card__identity').should('be.visible');
        cy.get('.clients-mobile-card__meta').should('be.visible');
        cy.get('.clients-mobile-card__actions').should('be.visible');
      });

    cy.get('[data-cy="btn-nuevo-cliente"]').click();

    cy.get('.client-create-dialog', { timeout: 10000 }).should('be.visible');
    cy.contains(
      '.client-create-dialog .p-dialog-title',
      'Crear Cliente',
    ).should('be.visible');
    shouldBeInsideViewport('.client-create-dialog');

    createDialogFields.forEach((selector) => {
      cy.get(selector).scrollIntoView({ block: 'center' }).should('be.visible');
    });
    cy.get('p-dropdown[formControlName="assignedCollectorId"]')
      .scrollIntoView({ block: 'center' })
      .should('be.visible');

    assertDialogFooterButtonsVisible();
  });

  it('Fase 2 - filtra clientes con mora usando el contrato real del backend', () => {
    cy.contains('.mobile-bottom-nav__item', 'Clientes').click();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');

    cy.get('[data-cy="dropdown-filtro-clientes"]', { timeout: 15000 }).click();
    cy.contains('.p-dropdown-item', 'Con mora').click();

    cy.get('.clients-mobile-card', { timeout: 10000 })
      .should('have.length.greaterThan', 0)
      .first()
      .within(() => {
        cy.contains('Riesgo').should('be.visible');
        cy.contains('Con mora').should('be.visible');
      });
    cy.get('[data-cy="clients-empty-state"]').should('not.exist');
  });

  it('Fase 2 - informa cuando filtros y búsqueda no tienen resultados en mobile', () => {
    cy.contains('.mobile-bottom-nav__item', 'Clientes').click();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');

    cy.get('[data-cy="dropdown-filtro-clientes"]', { timeout: 15000 }).click();
    cy.contains('.p-dropdown-item', 'Con mora').click();
    cy.get('[data-cy="input-buscar-cliente"]')
      .clear()
      .type(missingClientSearch);

    cy.get('[data-cy="clients-empty-state"]', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('No hay clientes para mostrar').should('be.visible');
        cy.contains(missingClientSearch).should('be.visible');
        cy.contains('Con mora').should('be.visible');
      });
    cy.get('.clients-mobile-card').should('not.exist');
  });

  it('Fase 2 - informa cuando no hay resultados en desktop', () => {
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/clients');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/clients');

    cy.get('[data-cy="input-buscar-cliente"]', { timeout: 15000 })
      .clear()
      .type(missingClientSearch);

    cy.get('[data-cy="clients-empty-state"]', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('No hay clientes para mostrar').should('be.visible');
        cy.contains(missingClientSearch).should('be.visible');
      });
    cy.get('p-table').should('not.exist');
  });
});
