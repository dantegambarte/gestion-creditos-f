/**
 * SUITE REAL — Enterprise: La Máquina del Tiempo (Mora + Cron Job).
 *
 * Simula que una cuota venció hace varios días y corre el cron real de mora
 * (`overdueInstallments`) para verificar que el sistema la marca OVERDUE y
 * le suma penalidad — sin esperar al reloj real ni mockear el job.
 *
 * Cómo se viaja en el tiempo (decisión de diseño, ver discusión del PR):
 * - NO existe (ni debe existir) un endpoint de negocio que permita setear
 *   due_date arbitrariamente — los créditos siempre nacen con vencimientos
 *   futuros calculados por frecuencia. Se agregó una ruta test-only
 *   (`PATCH /api/test/installments/:id/force-due-date`, gateada por
 *   ENABLE_TEST_ROUTES=true + rol ADMIN, mismo patrón que el ya existente
 *   `DELETE /api/test/business-days/today`) que solo retrocede el reloj de
 *   UNA cuota puntual. Vive en backend/src/modules/test, no en el dominio.
 * - El cron se ejecuta con el binario real (`src/scripts/run-cron.js`) vía
 *   un cy.task en cypress.config.ts — mismo proceso que corre QA/ops, no una
 *   reimplementación de la fórmula de mora en el test.
 * - El job calcula mora desde `due_date + penalty_grace_days` (default 3,
 *   configurable 0-30 vía system_config). Por eso el due_date forzado se
 *   calcula leyendo penalty_grace_days en runtime, no hardcodeando "ayer"
 *   (con grace_days=3, "ayer" cae en gracia y el cron no aplicaría nada).
 */

describe('Máquina del Tiempo — Mora y Cron Job (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Mora QA ${stamp}`,
    dni: `8${stamp}1`,
    address: `Calle Mora ${stamp}`,
    phone: `381${stamp}`,
  };

  let installmentId: string;
  let originalAmountDue: number;
  let forcedDueDate: string;

  before(() => {
    // Limpieza de jornada — evita que una caja abierta de una corrida previa
    // contamine el estado de mora/caja de esta suite.
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', '/test/business-days/today', null, token),
    );
  });

  it('setup — crea cliente, crédito aprobado y fuerza vencimiento atrasado', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/operations/new');

    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/credits',
            {
              customer_id: customerId,
              type: 'LOAN',
              // Bracket $150.001-$200.000 a 4 cuotas mensuales tiene tasa
              // configurada en la semilla 03 (interest_rates). $30.000 a 4
              // cuotas NO la tiene → findActiveRate devuelve null → 500 al
              // aprobar (bug de dominio aparte, no de este test).
              total_amount: 180000,
              installments_count: 4,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            expect(createRes.status, 'alta de préstamo por API (inyección de setup)').to.eq(201);
            const creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then((approved) => {
              expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');

              cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then(
                (instRes) => {
                  expect(instRes.status, 'cuotas del préstamo aprobado').to.eq(200);
                  const installments = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                  expect(installments, 'al menos una cuota generada').to.have.length.greaterThan(0);

                  installmentId = String(installments[0]['id']);
                  originalAmountDue = Number(installments[0]['amount_due']);

                  cy.apiRequest('GET', '/system-config/penalty_grace_days', null, token).then(
                    (configRes) => {
                      const graceDays = Number(
                        (configRes.body?.data as { value?: string } | undefined)?.value ?? 3,
                      );

                      // due_date = hoy − (grace_days + 2): dos días vencido el período
                      // de gracia, margen de sobra para que el cron aplique mora
                      // independientemente de cómo esté configurado grace_days.
                      const due = new Date();
                      due.setDate(due.getDate() - (graceDays + 2));
                      forcedDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

                      cy.apiForceInstallmentDueDate(installmentId, forcedDueDate).then((forced) => {
                        expect(String(forced['due_date']).slice(0, 10), 'due_date forzado').to.eq(
                          forcedDueDate,
                        );
                      });
                    },
                  );
                },
              );
            });
          }),
      );
    });
  });

  it('ejecución — corre el cron overdueInstallments real', () => {
    expect(installmentId, 'cuota con due_date forzado (setup)').to.be.a('string').and.not.be.empty;

    cy.task('cron:run', 'overdueInstallments').then((result) => {
      const taskResult = result as { ok: boolean; error?: string; output?: string };
      expect(taskResult.ok, `cron:run overdueInstallments — ${taskResult.error ?? ''}`).to.eq(true);
    });
  });

  it('aserción API — la cuota queda OVERDUE con penalidad aplicada', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments/${installmentId}`, null, token).then((res) => {
        expect(res.status, 'detalle de cuota post-cron').to.eq(200);
        const updated = res.body?.data as Record<string, unknown>;

        expect(updated['status'], 'estado tras cron de mora').to.eq('OVERDUE');
        expect(Number(updated['penalty_amount']), 'penalidad aplicada').to.be.greaterThan(0);
        expect(Number(updated['amount_due']), 'amount_due incrementado por mora').to.be.greaterThan(
          originalAmountDue,
        );
      }),
    );
  });

  it('aserción UI — ADMIN ve la cuota morosa reflejada en Morosidad', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/delinquency');

    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/delinquency');
    cy.get('app-error-state').should('not.exist');
    cy.get('p-table, app-loading-state, p-skeleton', { timeout: 15000 }).should('exist');

    // El listado pagina (10 filas por defecto) y acumula mora de toda la
    // base seedeada — sin filtrar, nuestro cliente puede no estar en la
    // primera página. El propio componente filtra cliente-side por dni
    // (`c.dni.includes(term)`), así que usamos ese buscador real.
    cy.get('input[placeholder="Buscar cliente..."]', { timeout: 15000 }).clear().type(customer.dni);
    cy.contains(customer.dni, { timeout: 20000 }).should('be.visible');
  });
});
