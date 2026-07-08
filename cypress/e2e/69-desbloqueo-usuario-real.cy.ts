/**
 * SUITE REAL — Enterprise: bloqueo por intentos fallidos + desbloqueo real
 * por ADMIN.
 *
 * `01-auth.cy.ts` (CU01-B) ya prueba que 3 intentos fallidos mantienen el
 * error de autenticación, pero limpia el estado con `apiUnlockUser` sin
 * verificar el flujo real de desbloqueo — ni que el usuario sigue
 * rechazado mientras está bloqueado (incluso con la contraseña correcta),
 * ni que el botón "Desbloquear" de `/admin/users/:id` (PATCH
 * /users/:id/unlock, auth.service.js) realmente lo reactiva.
 */

describe('Bloqueo por intentos fallidos + desbloqueo real (ADMIN)', () => {
  const stamp = Date.now().toString().slice(-6);
  const dni = `6${stamp}`;
  let userId: string;
  let tempPassword: string;

  it('setup — 3 intentos fallidos bloquean la cuenta (locked_at real en DB)', () => {
    cy.apiCreateUser({
      full_name: `Bloqueo QA ${stamp}`,
      dni,
      email: `bloqueo.${stamp}@qa.test`,
      address: 'Calle Bloqueo',
      role: 'SELLER',
    }).then((createdUser) => {
      const user = (
        createdUser as { user: { id: string }; tempPassword: string }
      ).user;
      userId = user.id;
      tempPassword = (createdUser as { tempPassword: string }).tempPassword;
      expect(
        tempPassword,
        'temp password real generada al crear el usuario',
      ).to.be.a('string').and.not.be.empty;

      const wrongAttempt = () =>
        cy.apiRequest(
          'POST',
          '/auth/login',
          { dni, password: 'CONTRASENA_INCORRECTA' },
          '',
        );

      wrongAttempt().then((r1) => expect(r1.status, 'intento 1').to.eq(401));
      wrongAttempt().then((r2) => expect(r2.status, 'intento 2').to.eq(401));
      wrongAttempt().then((r3) => {
        expect(r3.status, 'intento 3 — cuenta bloqueada').to.eq(401);
        expect(r3.body?.message, 'mensaje real de bloqueo').to.match(
          /bloqueada por seguridad/i,
        );
      });
    });
  });

  it('mientras está bloqueada, ni siquiera la contraseña CORRECTA permite loguear', () => {
    cy.apiRequest(
      'POST',
      '/auth/login',
      { dni, password: tempPassword },
      '',
    ).then((res) => {
      expect(
        res.status,
        'login con password correcta pero cuenta bloqueada',
      ).to.eq(401);
      expect(
        res.body?.message,
        'mensaje real de bloqueo (no de credenciales)',
      ).to.match(/bloqueada por seguridad/i);
    });
  });

  it('ADMIN desbloquea al usuario por UI real desde su detalle', () => {
    cy.viewport(1280, 720);
    expect(userId, 'usuario bloqueado del setup').to.be.a('string').and.not.be
      .empty;

    cy.loginReal('ADMIN', `/admin/users/${userId}`);
    cy.get('app-error-state').should('not.exist');
    cy.contains(`Bloqueo QA ${stamp}`, { timeout: 15000 }).should('be.visible');

    cy.contains('button', 'Desbloquear', { timeout: 15000 })
      .should('be.visible')
      .click();

    cy.contains('.p-confirm-dialog', 'Desbloquear usuario', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('button', 'Desbloquear').click();
      });

    cy.contains('.p-toast-message', 'Usuario desbloqueado', {
      timeout: 15000,
    }).should('be.visible');
  });

  it('verificación dura — locked_at en NULL y el usuario vuelve a loguear con su contraseña real', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/users/${userId}`, null, token).then((res) => {
        expect(res.status, 'detalle del usuario tras desbloqueo').to.eq(200);
        expect(res.body?.data?.locked_at, 'locked_at queda en null').to.be.null;
        expect(
          res.body?.data?.failed_attempts,
          'failed_attempts resetea a 0',
        ).to.eq(0);
      }),
    );

    cy.apiRequest(
      'POST',
      '/auth/login',
      { dni, password: tempPassword },
      '',
    ).then((res) => {
      expect(res.status, 'login real tras desbloqueo').to.eq(200);
      expect(res.body?.data?.token, 'token real emitido').to.be.a('string').and
        .not.be.empty;
    });
  });
});
