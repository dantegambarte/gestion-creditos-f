/**
 * SUITE REAL — Enterprise: cron `tokenCleanup`.
 *
 * Ningún test real corre este job (`tokenCleanup.job.js`): borra de verdad
 * filas vencidas de `token_blacklist` y `refresh_tokens` (no muta nada de
 * negocio, es housekeeping puro). Para hacerlo determinístico sin esperar
 * el TTL real se agregó una ruta test-only nueva
 * (`PATCH /api/test/tokens/:userId/force-expire`, mismo patrón/guarda que
 * las demás de `src/modules/test`) que retrocede `expires_at` de los
 * tokens de un usuario puntual.
 *
 * Para que el conteo sea exacto (y no se contamine con basura ya vencida
 * de otras corridas/dev), se corre el cron UNA vez al principio para
 * limpiar cualquier resto previo, y se mide el efecto real recién en la
 * segunda corrida, después de generar y forzar el vencimiento de filas
 * propias y nuevas.
 *
 * Verificación vía `GET /admin/cron-logs` (cron_execution_log) — endpoint
 * real de auditoría que tampoco usaba ningún test ni el frontend.
 */

describe('Cron tokenCleanup — limpieza real de tokens vencidos', () => {
  const stamp = Date.now().toString().slice(-6);
  const dni = `9${stamp}`;
  let userId: string;
  let accessToken: string;

  const runCron = () =>
    cy.task('cron:run', 'tokenCleanup').then((result) => {
      const taskResult = result as {
        ok: boolean;
        error?: string;
        output?: string;
      };
      expect(
        taskResult.ok,
        `cron:run tokenCleanup — ${taskResult.error ?? ''}`,
      ).to.eq(true);
    });

  const latestLog = () =>
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'GET',
          '/admin/cron-logs?job_name=tokenCleanup&limit=1',
          null,
          token,
        )
        .then((res) => {
          expect(res.status, 'consulta de auditoría real de crons').to.eq(200);
          const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
          expect(
            rows,
            'al menos una corrida registrada',
          ).to.have.length.greaterThan(0);
          return rows[0];
        }),
    );

  it('setup — limpieza previa de resto vencido, después un usuario real con sesión y logout reales', () => {
    runCron();

    cy.apiCreateUser({
      full_name: `TokenCleanup QA ${stamp}`,
      dni,
      email: `tokencleanup.${stamp}@qa.test`,
      address: 'Calle TokenCleanup',
      role: 'SELLER',
    }).then((createdUser) => {
      const user = (
        createdUser as { user: { id: string }; tempPassword: string }
      ).user;
      const tempPassword = (createdUser as { tempPassword: string })
        .tempPassword;
      userId = user.id;

      cy.apiRequest(
        'POST',
        '/auth/login',
        { dni, password: tempPassword },
        '',
      ).then((loginRes) => {
        expect(loginRes.status, 'login real (genera refresh_token real)').to.eq(
          200,
        );
        accessToken = String(loginRes.body?.data?.token ?? '');
        expect(accessToken, 'access token real').to.not.equal('');

        // Password temporal: el middleware bloquea con 403 cualquier ruta
        // que no sea el cambio de contraseña hasta que se cambie de verdad.
        cy.apiRequest(
          'PATCH',
          '/users/me/change-password',
          { current_password: tempPassword, new_password: 'NuevaPass123!' },
          accessToken,
        ).then((changeRes) => {
          expect(changeRes.status, 'cambio real de contraseña temporal').to.eq(
            200,
          );

          // changePassword fija force_relogin_at = NOW(): el access token
          // emitido en el login original queda inválido. Hace falta un login
          // real nuevo (genera otro refresh_token real) antes de poder usar
          // cualquier otra ruta autenticada, logout incluido.
          cy.apiRequest(
            'POST',
            '/auth/login',
            { dni, password: 'NuevaPass123!' },
            '',
          ).then((reloginRes) => {
            expect(
              reloginRes.status,
              're-login real con la contraseña ya cambiada',
            ).to.eq(200);
            accessToken = String(reloginRes.body?.data?.token ?? '');

            cy.apiRequest('POST', '/auth/logout', null, accessToken).then(
              (logoutRes) => {
                expect(
                  logoutRes.status,
                  'logout real (blacklistea el access token)',
                ).to.eq(200);
              },
            );
          });
        });
      });
    });
  });

  it('forzar vencimiento real de los tokens del usuario y correr el cron de nuevo', () => {
    expect(userId, 'usuario con sesión real del setup').to.be.a('string').and
      .not.be.empty;

    cy.apiForceTokensExpired(userId).then((forced) => {
      expect(
        forced['blacklist_rows'],
        'token de logout forzado a vencido',
      ).to.eq(1);
      // 2 filas: el refresh_token del login original (sigue vivo, nunca se
      // usó para refrescar) + el del re-login posterior al cambio de
      // contraseña, revocado por el propio logout.
      expect(
        forced['refresh_token_rows'],
        'refresh tokens reales forzados a vencidos',
      ).to.eq(2);
    });

    runCron();
  });

  it('aserción de auditoría real — la corrida borró exactamente los 3 tokens vencidos', () => {
    latestLog().then((log) => {
      expect(log['success'], 'corrida exitosa').to.eq(true);
      expect(
        log['affected_rows'],
        'borró exactamente el blacklist + los 2 refresh tokens forzados',
      ).to.eq(3);
      const metadata = log['metadata'] as Record<string, unknown>;
      expect(metadata['blacklist'], 'blacklist real borrado').to.eq(1);
      expect(
        metadata['refresh_tokens'],
        'refresh tokens reales borrados',
      ).to.eq(2);
    });
  });

  it('una tercera corrida sin tokens nuevos vencidos no borra nada (idempotente)', () => {
    runCron();

    latestLog().then((log) => {
      expect(log['success'], 'corrida exitosa').to.eq(true);
      expect(
        log['affected_rows'],
        'sin restos vencidos: 0 filas afectadas',
      ).to.eq(0);
    });
  });
});
