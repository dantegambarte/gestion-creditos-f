/**
 * SUITE REAL — Enterprise: Refinanciación de crédito con mora.
 *
 * Cubre POST /credits/:id/refinance, el único flujo de negocio de créditos
 * que ninguna otra suite real toca: un crédito ACTIVE con saldo vencido se
 * traslada a un crédito nuevo (LOAN, PENDING_APPROVAL) y el original pasa a
 * REFINANCED — deuda trasladada, no cancelada (ver credits.service.js).
 *
 * Setup por API (inyección directa, no UI) para llegar rápido a "crédito
 * ACTIVE con mora real": mismo patrón que 57-maquina-del-tiempo (due_date
 * forzado vía ruta test-only + cron real). La parte de UI que interesa
 * probar es el diálogo de refinanciación en sí, no repetir el alta.
 *
 * El nuevo crédito se crea con 1 sola cuota: interest_rates tiene tasa para
 * 1 cuota MONTHLY en TODOS los brackets de monto (ver seed 03), así que la
 * aprobación posterior no depende de cuánto saldo exacto se traslade (mora
 * incluida, monto no determinístico).
 */

type MeResponse = { id?: string };

describe('Refinanciación de crédito con mora (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Refi QA ${stamp}`,
    dni: `6${stamp}4`,
    address: `Calle Refi ${stamp}`,
    phone: `386${stamp}`,
  };

  let creditId: string;
  let pendingBalanceBefore: number;
  let newCreditId: string;

  before(() => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', '/test/business-days/today', null, token),
    );
  });

  it('setup — crédito ACTIVE con cuota vencida y mora aplicada (API + cron real)', () => {
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
              total_amount: 180000,
              installments_count: 4,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            expect(createRes.status, 'alta de préstamo (setup)').to.eq(201);
            creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then((approved) => {
              expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');

              cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((instRes) => {
                const installmentsList = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                expect(installmentsList, 'al menos una cuota generada').to.have.length.greaterThan(0);
                const firstInstallmentId = String(installmentsList[0]['id']);

                cy.apiRequest('GET', '/system-config/penalty_grace_days', null, token).then((configRes) => {
                  const graceDays = Number(
                    (configRes.body?.data as { value?: string } | undefined)?.value ?? 3,
                  );
                  const due = new Date();
                  due.setDate(due.getDate() - (graceDays + 5));
                  const forcedDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

                  cy.apiForceInstallmentDueDate(firstInstallmentId, forcedDueDate).then(() => {
                    cy.task('cron:run', 'overdueInstallments').then((result) => {
                      const taskResult = result as { ok: boolean; error?: string };
                      expect(taskResult.ok, `cron:run overdueInstallments — ${taskResult.error ?? ''}`).to.eq(true);
                    });

                    cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((afterRes) => {
                      const rows = (afterRes.body?.data ?? []) as Array<Record<string, unknown>>;
                      const overdueRow = rows.find((r) => r['id'] === firstInstallmentId);
                      expect(overdueRow?.['status'], 'cuota vencida tras cron').to.eq('OVERDUE');
                      expect(Number(overdueRow?.['penalty_amount']), 'mora aplicada').to.be.greaterThan(0);

                      pendingBalanceBefore = rows.reduce(
                        (sum, r) => sum + (Number(r['amount_due']) - Number(r['amount_paid'])),
                        0,
                      );
                      expect(pendingBalanceBefore, 'saldo pendiente total > 0').to.be.greaterThan(0);
                    });
                  });
                });
              });
            });
          }),
      );
    });
  });

  it('ADMIN refinancia el crédito por UI: simula, confirma y el original queda REFINANCED', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'crédito con mora (setup)').to.be.a('string').and.not.be.empty;

    cy.loginReal('ADMIN', `/admin/operations/${creditId}`);
    cy.contains('button', 'Refinanciar', { timeout: 20000 }).should('be.visible').click();

    cy.contains('Refinanciar crédito — Paso 1 de 2', { timeout: 10000 }).should('be.visible');
    cy.contains('label', 'Cuotas')
      .parent()
      .find('input')
      .clear()
      .type('1');
    cy.contains('label', 'Motivo de refinanciación')
      .parent()
      .find('textarea')
      .type('Refinanciación por mora acumulada — control QA.');

    cy.intercept('POST', /\/api\/credits\/[^/]+\/refinance$/).as('refinance');
    cy.contains('button', 'Simular nuevo crédito').should('not.be.disabled').click();

    cy.contains('Refinanciar crédito — Paso 2 de 2', { timeout: 15000 }).should('be.visible');
    cy.get('.p-dialog').contains('Monto total').should('be.visible');
    cy.contains('button', 'Confirmar refinanciación').click();

    cy.wait('@refinance').then((interception) => {
      expect(interception.response?.statusCode, 'refinanciación').to.eq(201);
      newCreditId = String(interception.response?.body?.data?.id ?? interception.response?.body?.data?.new_credit?.id ?? '');
      expect(newCreditId, 'id del crédito nuevo').to.not.equal('');
    });

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.status, 'estado del crédito original').to.eq(200);
        expect(res.body?.data?.status, 'original pasa a REFINANCED').to.eq('REFINANCED');
      }),
    );
  });

  it('el crédito nuevo nace PENDING_APPROVAL absorbiendo el saldo y se puede aprobar', () => {
    expect(newCreditId, 'crédito nuevo creado en el paso anterior').to.be.a('string').and.not.be.empty;

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/credits/${newCreditId}`, null, token).then((res) => {
        expect(res.status, 'detalle del crédito nuevo').to.eq(200);
        expect(res.body?.data?.status, 'nace pendiente de aprobación').to.eq('PENDING_APPROVAL');
        expect(res.body?.data?.type, 'siempre LOAN').to.eq('LOAN');
        expect(
          Number(res.body?.data?.total_amount),
          'monto trasladado ≈ saldo pendiente del original',
        ).to.be.closeTo(pendingBalanceBefore, 1);

        const chain = res.body?.data?.refinancing_chain as { predecessor_id?: string } | undefined;
        expect(chain?.predecessor_id, 'cadena de refinanciación apunta al original').to.eq(creditId);
      }),
    );

    cy.apiApproveCredit(newCreditId).then((approved) => {
      expect(approved['status'], 'crédito refinanciado aprobado').to.eq('ACTIVE');
    });
  });

  it('ADMIN ve ambos créditos relacionados en el detalle (cadena de refinanciación)', () => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', `/admin/operations/${newCreditId}`);
    cy.get('app-error-state').should('not.exist');
    cy.contains(customer.fullName, { timeout: 15000 }).should('be.visible');
    // Banner de cadena: el crédito nuevo linkea de vuelta al original.
    cy.contains('Refinanciación de crédito anterior.', { timeout: 15000 }).should('be.visible');
  });
});
