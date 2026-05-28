describe('47 - Full width layout smoke', () => {
  type InternalRole = 'ADMIN' | 'SELLER' | 'COLLECTOR';

  type RouteCase = {
    role: InternalRole;
    path: string;
  };

  const routes: RouteCase[] = [
    { role: 'COLLECTOR', path: '/collector/route' },
    { role: 'COLLECTOR', path: '/collector/payments' },
    { role: 'COLLECTOR', path: '/collector/commissions' },
    { role: 'ADMIN', path: '/admin/users/new' },
    { role: 'ADMIN', path: '/admin/collections/sheet-1' },
    { role: 'SELLER', path: '/seller/clients/new' },
    { role: 'ADMIN', path: '/profile' },
  ];

  /**
   * Verifica que la shell `.ff-page` use ancho completo y que la página no
   * introduzca overflow horizontal.
   */
  function assertFullWidthLayout(): void {
    cy.get('main.flex-1').should('exist');
    cy.get('.ff-page').should('exist');

    cy.get('main.flex-1').then(($main) => {
      const mainRect = $main[0].getBoundingClientRect();

      cy.get('.ff-page').then(($page) => {
        const pageRect = $page[0].getBoundingClientRect();
        const styles = getComputedStyle($page[0]);

        cy.window().then((win) => {
          const viewportWidth = win.innerWidth;
          const expectedPadding = viewportWidth <= 640 ? '12px' : '16px';

          expect(
            Math.abs(pageRect.left - mainRect.left),
            'alineación izquierda con main (tolerancia)',
          ).to.be.lte(1);
          expect(
            Math.abs(pageRect.right - mainRect.right),
            'alineación derecha con main (tolerancia)',
          ).to.be.lte(8);
          expect(styles.maxWidth, 'max-width neutralizado').to.equal('none');
          expect(styles.marginLeft, 'sin centrado horizontal izquierdo').to.equal(
            '0px',
          );
          expect(styles.marginRight, 'sin centrado horizontal derecho').to.equal(
            '0px',
          );
          expect(styles.paddingLeft, 'padding lateral izquierdo').to.equal(
            expectedPadding,
          );
          expect(styles.paddingRight, 'padding lateral derecho').to.equal(
            expectedPadding,
          );
        });
      });
    });

    cy.document().then((doc) => {
      expect(
        doc.documentElement.scrollWidth,
        'scroll horizontal del documento',
      ).to.be.lte(doc.documentElement.clientWidth + 1);
    });
  }

  routes.forEach(({ role, path }) => {
    it(`mantiene ancho completo en ${path} (desktop)`, () => {
      cy.viewport(1440, 900);
      cy.loginAs(role, path);
      assertFullWidthLayout();
    });
  });
});
