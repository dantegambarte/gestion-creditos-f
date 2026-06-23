/**
 * SUITE REAL — Enterprise: cron `weeklyCommissionCycle`.
 *
 * Ningún test real corre este job: cierra el ciclo semanal de comisiones
 * (lunes-sábado) los sábados a las 23:59 — NO muta el estado de las
 * comisiones (eso lo hace el Admin el lunes vía `/commissions/liquidate`,
 * ver suite 62), solo registra cuántas quedaron PENDING en la semana. Se
 * salta por completo si `new Date().getDay()` no coincide con
 * `commission_week_close_day` (system_config).
 *
 * Para hacerlo determinístico sin esperar al sábado real, se fuerza
 * `commission_week_close_day` al weekday de HOY usando el endpoint REAL de
 * configuración (PUT /system-config/:key) — no una ruta test-only, porque
 * esto sí es un parámetro de negocio legítimo que el Admin puede tocar.
 *
 * Hallazgo real al diseñar esto: `commission_week_close_day` y
 * `commission_pay_day` (system_config) no pueden coincidir (guard cruzado
 * real en systemConfig.service.js) — si el weekday de hoy choca con el
 * pay_day configurado, hay que mover el pay_day a otro valor primero. Y
 * además: el rango válido de ambos parámetros es 1-7, pero el job compara
 * contra `Date.getDay()` crudo (0=Domingo...6=Sábado) — un domingo real
 * (getDay()=0) NUNCA puede configurarse como día de cierre porque el mínimo
 * validado es 1. No es parte de lo que este test arregla, pero queda
 * documentado como límite real del sistema.
 *
 * Verificación vía `GET /admin/cron-logs` (mismo endpoint de auditoría real
 * usado en la suite 72).
 */

type MeResponse = { id?: string; full_name?: string };

function digitsToLetters(stamp: string): string {
  return stamp
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('');
}

describe('Cron weeklyCommissionCycle — cierre real del ciclo semanal', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `WeeklyCycle QA ${digitsToLetters(stamp)}`,
    dni: `4${stamp}6`,
    phone: `394${stamp}`,
  };

  const todayWeekday = new Date().getDay();
  let sellerFullName: string;
  let creditId: string;
  let originalCloseDay: string;
  let originalPayDay: string;

  const runCron = () =>
    cy.task('cron:run', 'weeklyCommissionCycle').then((result) => {
      const taskResult = result as { ok: boolean; error?: string };
      expect(
        taskResult.ok,
        `cron:run weeklyCommissionCycle — ${taskResult.error ?? ''}`,
      ).to.eq(true);
    });

  const latestLog = () =>
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'GET',
          '/admin/cron-logs?job_name=weeklyCommissionCycle&limit=1',
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

  before(() => {
    expect(
      todayWeekday,
      'hoy no es domingo: ver limitación real documentada arriba',
    ).to.be.greaterThan(0);
  });

  it('setup — forzar el día de cierre real a hoy, y un SELLER origina una venta real (comisión PENDING)', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest(
        'GET',
        '/system-config/commission_week_close_day',
        null,
        token,
      ).then((res) => {
        originalCloseDay = String(res.body?.data?.value ?? '6');
      });
      cy.apiRequest(
        'GET',
        '/system-config/commission_pay_day',
        null,
        token,
      ).then((res) => {
        originalPayDay = String(res.body?.data?.value ?? '1');

        cy.then(() => {
          const payDayNum = parseInt(originalPayDay);
          if (payDayNum === todayWeekday) {
            // Choque real: el guard cruzado de systemConfig.service.js no
            // permite close_day === pay_day. Se mueve el pay_day a un valor
            // temporal distinto antes de poder forzar el close_day a hoy.
            const tempPayDay = todayWeekday === 7 ? 1 : todayWeekday + 1;
            cy.apiRequest(
              'PUT',
              '/system-config/commission_pay_day',
              { value: String(tempPayDay) },
              token,
            ).then((tempRes) => {
              expect(
                tempRes.status,
                'pay_day temporal para evitar el choque real',
              ).to.eq(200);
            });
          }

          cy.apiRequest(
            'PUT',
            '/system-config/commission_week_close_day',
            { value: String(todayWeekday) },
            token,
          ).then((closeRes) => {
            expect(
              closeRes.status,
              'close_day forzado a hoy (config real)',
            ).to.eq(200);
          });
        });
      });
    });

    cy.viewport(1280, 720);
    cy.getAuthToken('SELLER').then((sellerToken) =>
      cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
        sellerFullName = String(
          (meRes.body?.data as MeResponse | undefined)?.full_name ?? '',
        );
        expect(sellerFullName, 'nombre real del seller').to.not.equal('');
      }),
    );

    cy.then(() => {
      cy.loginReal('SELLER', '/seller/clients/new');
      cy.get('input[formControlName="fullName"]', { timeout: 15000 })
        .clear()
        .type(customer.fullName);
      cy.get('input[formControlName="dni"]').clear().type(customer.dni);
      cy.get('input[formControlName="address"]')
        .clear()
        .type(`Calle WeeklyCycle ${stamp}`);
      cy.get('input[formControlName="phone"]').clear().type(customer.phone);
      cy.contains('button', 'Registrar cliente').click();
      cy.contains('.p-toast-message', 'Cliente registrado correctamente.', {
        timeout: 15000,
      }).should('be.visible');

      cy.intercept('POST', '/api/credits').as('createCredit');
      cy.visit('/seller/operations/new');
      cy.get('[data-cy="btn-type-sale"]', { timeout: 20000 })
        .should('be.visible')
        .click();

      cy.get('[data-cy="input-search-client"]', { timeout: 15000 })
        .clear()
        .type(customer.dni);
      cy.contains('[data-cy^="client-card-"]', customer.fullName, {
        timeout: 15000,
      }).click();
      cy.contains('button', 'Continuar con este cliente', { timeout: 15000 })
        .should('be.enabled')
        .click();

      cy.contains('h3', 'Catálogo', { timeout: 20000 }).should('be.visible');
      cy.get('[data-cy^="sale-product-"]', { timeout: 20000 })
        .first()
        .click({ force: true });
      cy.get('[data-cy^="sale-variant-"]', { timeout: 15000 })
        .first()
        .click({ force: true });
      cy.get('[data-cy="sale-add-unit"]', { timeout: 20000 })
        .first()
        .click({ force: true });
      cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 })
        .should('not.be.disabled')
        .click();

      cy.contains('Configurar Plan de Pagos', { timeout: 15000 }).should(
        'be.visible',
      );
      cy.get('[data-cy="btn-siguiente"] button')
        .should('not.be.disabled')
        .click();

      cy.contains('Declaraciones y Autorizaciones', { timeout: 15000 })
        .scrollIntoView()
        .should('be.visible');
      cy.get('[data-cy="btn-mark-all"]').click({ force: true });
      cy.get('[data-cy="btn-enviar-aprobacion"] button')
        .should('not.be.disabled')
        .click();

      cy.wait('@createCredit').then((interception) => {
        creditId = String(interception.response?.body?.data?.id ?? '');
        expect(creditId, 'id de venta originada por SELLER').to.not.equal('');
        expect(interception.response?.statusCode).to.eq(201);
      });
    });

    cy.then(() => {
      cy.logout();
      cy.loginReal('ADMIN', '/admin/approvals');
      cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should(
        'be.visible',
      );

      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as(
        'approveCredit',
      );
      cy.contains('p-table tbody tr', customer.dni, { timeout: 20000 })
        .should('be.visible')
        .within(() => {
          cy.get('button').eq(1).click();
        });
      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', {
        timeout: 10000,
      }).should('be.visible');
      cy.contains('.p-dialog button', 'Confirmar Aprobación').click();

      cy.wait('@approveCredit').then((interception) => {
        expect(interception.response?.statusCode, 'aprobación de venta').to.eq(
          200,
        );
      });
    });

    cy.then(() => {
      cy.getAuthToken('SELLER').then((sellerToken) =>
        cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
          const sellerId = String(
            (meRes.body?.data as MeResponse | undefined)?.id ?? '',
          );
          cy.apiRequest(
            'GET',
            `/commissions?status=PENDING&user_id=${sellerId}`,
            null,
            sellerToken,
          ).then((commRes) => {
            const rows = (commRes.body?.data ?? []) as Array<
              Record<string, unknown>
            >;
            const mine = rows.find((r) => r['credit_id'] === creditId);
            expect(
              mine,
              'comisión PENDING real generada, dentro de la semana actual',
            ).to.exist;
          });
        }),
      );
    });
  });

  it('correr el cron real con el close_day forzado a hoy — no se salta, cierra el ciclo de verdad', () => {
    expect(creditId, 'venta con comisión PENDING del setup').to.be.a('string')
      .and.not.be.empty;
    runCron();
  });

  it('aserción de auditoría real — el cierre reflejó la comisión PENDING real (no un skip)', () => {
    latestLog().then((log) => {
      expect(log['success'], 'corrida exitosa').to.eq(true);
      expect(
        Number(log['affected_rows']),
        'al menos la comisión recién generada',
      ).to.be.greaterThan(0);

      const metadata = log['metadata'] as Record<string, unknown>;
      expect(
        metadata['skipped'],
        'no se saltó: hoy coincide con el close_day forzado',
      ).to.not.exist;
      expect(
        Number(metadata['employees']),
        'al menos un empleado con pendientes',
      ).to.be.greaterThan(0);
      expect(
        Number(metadata['total_pending']),
        'total real a liquidar > 0',
      ).to.be.greaterThan(0);
    });
  });

  it('cleanup — restaura commission_week_close_day y commission_pay_day originales', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest(
        'PUT',
        '/system-config/commission_week_close_day',
        { value: originalCloseDay },
        token,
      ).then((res) => {
        expect(res.status, 'restaurar close_day original').to.eq(200);
      });
      cy.apiRequest(
        'PUT',
        '/system-config/commission_pay_day',
        { value: originalPayDay },
        token,
      ).then((res) => {
        expect(res.status, 'restaurar pay_day original').to.eq(200);
      });
    });
  });
});
