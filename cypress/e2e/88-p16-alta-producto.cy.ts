/**
 * SUITE: P16 — Alta de producto sin doble envío y rango de precio min/max (#48)
 *
 * Cubre (desktop 1280x720 y mobile 375x667):
 *  - Crear producto: el botón queda bloqueado tras el alta hasta navegar al detalle (una sola request POST)
 *  - Detalle de producto: el rango de precio usa mínimo y máximo de las variantes, no primera y última
 */

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
];

/**
 * Construye la respuesta cruda del detalle de producto con variantes desordenadas por precio.
 * @returns {object} Cuerpo de respuesta de GET /products/:id.
 */
function productDetailBody(): object {
  const variant = (id: string, price: number) => ({
    id,
    color: null,
    size: null,
    capacity: null,
    current_price: price,
    status: 'ACTIVE',
    available_count: 1,
    reserved_count: 0,
    sold_count: 0,
  });
  return {
    ok: true,
    data: {
      id: 'p16-prod',
      title: 'Producto P16',
      description: null,
      model: null,
      status: 'ACTIVE',
      created_at: '2026-11-25T00:00:00Z',
      updated_at: '2026-11-25T00:00:00Z',
      category_id: null,
      category_name: null,
      brand_id: null,
      brand_name: null,
      available_count: 3,
      reserved_count: 0,
      sold_count: 0,
      variants: [variant('v-a', 3000), variant('v-b', 1000), variant('v-c', 2000)],
    },
  };
}

VIEWPORTS.forEach(({ name, width, height }) => {
  describe(`P16 — Alta de producto (${name})`, () => {
    beforeEach(() => {
      cy.viewport(width, height);
      cy.intercept('GET', /\/api\/product-brands/, { statusCode: 200, body: { ok: true, data: [] } });
      cy.intercept('GET', /\/api\/product-categories/, { statusCode: 200, body: { ok: true, data: [] } });
      cy.intercept('GET', /\/api\/products\/p16-prod$/, { statusCode: 200, body: productDetailBody() }).as(
        'detail',
      );
    });

    it('bloquea el botón tras el alta y hace un solo POST hasta navegar', () => {
      let posts = 0;
      cy.intercept('POST', /\/api\/products$/, (req) => {
        posts += 1;
        req.reply({ statusCode: 201, body: productDetailBody() });
      }).as('create');

      cy.loginAs('ADMIN', '/admin/products/new');
      cy.get('input[formcontrolname="title"]').type('Producto P16');
      cy.contains('button', 'Crear producto').click();
      cy.wait('@create');

      // Durante el delay del toast el botón sigue bloqueado
      cy.contains('button', 'Crear producto').should('be.disabled');
      cy.contains('button', 'Crear producto').click({ force: true });

      cy.location('pathname', { timeout: 5000 }).should('eq', '/admin/products/p16-prod');
      cy.then(() => expect(posts).to.eq(1));
    });

    it('muestra el rango de precio con mínimo y máximo', () => {
      cy.loginAs('ADMIN', '/admin/products/p16-prod');
      cy.wait('@detail');
      cy.get('[data-cy="product-price-range"]')
        .first()
        .invoke('text')
        .then((text) => {
          const clean = text.replace(/\s+/g, ' ');
          expect(clean).to.match(/1\.000.*—.*3\.000/);
        });
    });
  });
});
