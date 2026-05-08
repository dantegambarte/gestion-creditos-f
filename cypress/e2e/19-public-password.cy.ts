/**
 * SUITE: Páginas Públicas — Recuperar y Cambiar Contraseña
 *
 * Cubre:
 *  - Forgot Password: render, validaciones, submit, link volver
 *  - Change Password: render, validaciones, 3 campos, botón Cancelar
 */

describe('Recuperar Contraseña (/forgot-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.visit('/forgot-password');
  });

  it('muestra el texto guía de recuperación', () => {
    cy.contains('p', 'Ingresá tu email para recuperar el acceso').should(
      'be.visible',
    );
  });

  it('muestra el campo de email', () => {
    cy.get('input[type="email"]').should('exist');
  });

  it('muestra el botón de enviar enlace', () => {
    cy.contains('button', 'Enviar enlace de recuperación').should('exist');
  });

  it('submit sin email muestra error "obligatorio"', () => {
    cy.contains('button', 'Enviar enlace de recuperación').click();
    cy.contains('obligatorio').should('be.visible');
  });

  it('email con formato inválido muestra error', () => {
    cy.get('input[type="email"]').type('noesvalido');
    cy.contains('button', 'Enviar enlace de recuperación').click();
    cy.contains('válido').should('be.visible');
  });

  it('link "Volver al login" navega a /login', () => {
    cy.contains('Volver al login').click();
    cy.url().should('include', '/login');
  });

  it('submit con email válido muestra confirmación de envío', () => {
    cy.get('input[type="email"]').type('test@example.com');
    cy.contains('button', 'Enviar enlace de recuperación').click();
    cy.contains('Email enviado').should('be.visible');
  });
});

describe('Cambiar Contraseña (/change-password)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/change-password');
  });

  it('muestra el texto guía de cambio de contraseña', () => {
    cy.contains('p', 'Ingresá tu contraseña actual y la nueva').should(
      'be.visible',
    );
  });

  it('tiene el campo contraseña actual', () => {
    cy.get('p-password').should('have.length.gte', 1);
  });

  it('tiene 3 campos de contraseña (actual, nueva, confirmar)', () => {
    cy.get('p-password').should('have.length', 3);
  });

  it('muestra botón "Cambiar contraseña"', () => {
    cy.contains('button', 'Cambiar contraseña').should('exist');
  });

  it('submit sin campos muestra errores de validación', () => {
    cy.contains('button', 'Cambiar contraseña').click();
    cy.contains('obligatorio').should('exist');
  });

  it('botón Cancelar es visible (modo no temporal)', () => {
    cy.contains('button', 'Cancelar').should('exist');
  });

  it('clic en Cancelar navega fuera de /change-password', () => {
    cy.contains('button', 'Cancelar').click();
    cy.url().should('not.include', '/change-password');
  });
});
