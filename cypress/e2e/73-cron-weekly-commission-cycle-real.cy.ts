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

  /**
   * Escribe un parámetro de system_config por el endpoint real.
   * @param token - token ADMIN
   * @param key - clave de configuración
   * @param value - nuevo valor
   */
  const putConfig = (token: string, key: string, value: string) =>
    cy
      .apiRequest('PUT', `/system-config/${key}`, { value }, token)
      .then((res) => {
        expect(res.status, `PUT ${key}=${value}`).to.eq(200);
      });

  before(() => {
    // Caja operativa propia: no depender del estado que dejó otra suite.
    cy.apiEnsureCashSessionOpen();
    expect(
      todayWeekday,
      'hoy no es domingo: ver limitación real documentada arriba',
    ).to.be.greaterThan(0);

    // Fuerza el día de cierre a hoy en before() para que after() siempre
    // tenga los originales que restaurar, falle o no el setup.
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', '/system-config/commission_week_close_day', null, token).then(
        (res) => {
          originalCloseDay = String(res.body?.data?.value ?? '6');
        },
      );
      cy.apiRequest('GET', '/system-config/commission_pay_day', null, token).then((res) => {
        originalPayDay = String(res.body?.data?.value ?? '1');
      });

      cy.then(() => {
        if (parseInt(originalPayDay) === todayWeekday) {
          // Guard real: close_day !== pay_day. Mover pay_day antes de forzar
          // close_day, a un valor que no choque con hoy ni con el close_day vigente.
          const tempPayDay = ['1', '2', '3', '4', '5', '6', '7'].find(
            (d) => d !== String(todayWeekday) && d !== originalCloseDay,
          ) as string;
          putConfig(token, 'commission_pay_day', tempPayDay);
        }
        putConfig(token, 'commission_week_close_day', String(todayWeekday));
      });
    });
  });

  // Restaura la config original pase o falle la suite. Orden seguro para el
  // guard close_day !== pay_day: el pay_day vigente (original o temporal)
  // nunca es igual al close_day original, así que close_day va primero.
  after(() => {
    if (!originalCloseDay || !originalPayDay) return;
    cy.getAuthToken('ADMIN').then((token) => {
      putConfig(token, 'commission_week_close_day', originalCloseDay);
      putConfig(token, 'commission_pay_day', originalPayDay);
    });
  });

  it('setup — un SELLER origina una venta real (comisión PENDING) con el close_day forzado a hoy', () => {
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

      cy.get('[data-cy="ddl-installments"]', { timeout: 15000 }).first().should('be.visible');
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
          cy.get('button').filter(':has(.pi-check)').first().click({ force: true });
        });
      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Crédito', {
        timeout: 10000,
      }).should('be.visible');
      cy.contains('.p-dialog:visible button', 'Confirmar').click();

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
});
