const profileResponse = {
  ok: true,
  message: 'OK',
  data: {
    id: 'usr-001',
    full_name: 'Carlos López',
    dni: '12345678',
    email: 'admin@siscreditos.com',
    phone: '+54 11 5555-5555',
    address: 'Av. Corrientes 1234',
    role: 'ADMIN',
    status: 'ACTIVE',
    is_temp_password: false,
    failed_attempts: 0,
    locked_at: null,
    last_login_at: '2026-06-20T12:00:00.000Z',
    created_at: '2026-01-10T12:00:00.000Z',
    updated_at: '2026-06-20T12:00:00.000Z',
  },
};

describe('Mi Perfil', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/users/me', profileResponse).as('getProfile');
  });

  it('carga y guarda datos personales en desktop', () => {
    cy.viewport(1280, 720);
    cy.intercept('PATCH', '**/users/me', (req) => {
      expect(req.body).to.include({
        full_name: 'Carlos López Actualizado',
        email: 'admin.actualizado@siscreditos.com',
        phone: '+54 11 5555-9999',
        address: 'Av. Corrientes 9999',
      });
      req.reply({
        ...profileResponse,
        data: {
          ...profileResponse.data,
          ...req.body,
        },
      });
    }).as('saveProfile');

    cy.loginAs('ADMIN', '/profile');
    cy.wait('@getProfile');

    cy.get('[data-cy="profile-page"]').should('be.visible');
    cy.get('[data-cy="profile-name-input"]').clear().type('Carlos López Actualizado');
    cy.get('[data-cy="profile-email-input"]').clear().type('admin.actualizado@siscreditos.com');
    cy.get('[data-cy="profile-phone-input"]').clear().type('+54 11 5555-9999');
    cy.get('[data-cy="profile-address-input"]').clear().type('Av. Corrientes 9999');
    cy.get('[data-cy="profile-save-personal"] button').click();

    cy.wait('@saveProfile');
    cy.contains('Perfil actualizado').should('be.visible');
    cy.contains('Carlos López Actualizado').should('be.visible');
  });

  it('muestra el formulario de perfil en mobile', () => {
    cy.viewport(375, 667);
    cy.loginAs('ADMIN', '/profile');
    cy.wait('@getProfile');

    cy.get('[data-cy="profile-page"]').should('be.visible');
    cy.get('[data-cy="profile-summary-card"]').should('be.visible');
    cy.get('[data-cy="profile-personal-form"]')
      .scrollIntoView()
      .should('be.visible');
    cy.get('[data-cy="profile-phone-input"]')
      .scrollIntoView()
      .should('be.visible');
  });
});
