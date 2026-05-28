describe('48 - Full width layout mobile observability', () => {
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
   * Este spec queda no-bloqueante hasta cerrar la etapa responsive mobile.
   * Al habilitar mobile, remover `.skip` y convertirlo en smoke activo.
   */
  describe.skip('pending responsive mobile rollout', () => {
    routes.forEach(({ role, path }) => {
      it(`captura estado mobile en ${path}`, () => {
        cy.viewport(390, 844);
        cy.loginAs(role, path);
        cy.get('main.flex-1').should('exist');
        cy.get('.ff-page').should('exist');
      });
    });
  });
});
