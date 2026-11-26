/**
 * SUITE REAL — Enterprise: Cambio de plan (acortar cuotas restantes).
 *
 * Cubre GET /credits/:id/plan-change/simulate + POST /credits/:id/plan-change.
 * Regla de negocio (cambio-de-plan.md, ver credits.service.js):
 *   - nuevo_plan = cuotas_pagadas + 1 (determinístico, plan más corto)
 *   - requiere que el nuevo plan sea MÁS CORTO que el actual → hace falta al
 *     menos 1 cuota ya PAID y un crédito con installments_count original
 *     mayor a paidCount+1.
 *   - V1: solo LOAN.
 *
 * Setup por API: LOAN 180000/4/MONTHLY (bracket 150001-200000 tiene tasa
 * para 1/2/3/4 cuotas — necesario porque el nuevo plan de 2 cuotas necesita
 * su propia tasa activa), se paga completa la cuota 1 con cobro directo para
 * volverlo elegible (paidCount=1 → nuevo plan de 2 cuotas, menor a 4).
 */

describe('Cambio de plan — acortar cuotas restantes (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `PlanChange QA ${stamp}`,
    dni: `5${stamp}5`,
    address: `Calle Plan ${stamp}`,
    phone: `387${stamp}`,
  };

  let creditId: string;
  let installments: Array<{ id: string; amount_due: number; installment_number: number }>;

  it('setup — LOAN ACTIVE de 4 cuotas con la primera ya pagada (elegible)', () => {
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
                const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                expect(rows, 'cuatro cuotas generadas').to.have.length(4);
                installments = rows
                  .map((r) => ({
                    id: String(r['id']),
                    amount_due: Number(r['amount_due']),
                    installment_number: Number(r['installment_number']),
                  }))
                  .sort((a, b) => a.installment_number - b.installment_number);

                cy.apiRequest(
                  'POST',
                  '/payments/admin-direct',
                  {
                    installment_id: installments[0].id,
                    amount_received: installments[0].amount_due,
                    payment_method: 'CASH',
                  },
                  token,
                ).then((payRes) => {
                  expect(payRes.status, 'cobro directo de la cuota 1 (vuelve elegible)').to.eq(201);
                });
              });
            });
          }),
      );
    });
  });

  it('ADMIN simula y confirma el cambio de plan por UI: sobrevive 1 cuota más corta', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'crédito del setup').to.be.a('string').and.not.be.empty;

    cy.loginReal('ADMIN', `/admin/operations/${creditId}`);
    cy.contains('button', 'Cambiar plan', { timeout: 20000 }).should('be.visible').click();

    // Varios diálogos de acción (Refinanciar/Castigar/etc) viven en el DOM al
    // mismo tiempo (ocultos) — se escopea explícitamente al p-dialog cuyo
    // header dice "Cambio de plan" para no pisar selectores con otro diálogo.
    cy.contains('.p-dialog-title', 'Cambio de plan', { timeout: 15000 })
      .closest('.p-dialog')
      .as('planDialog');

    cy.get('@planDialog').contains('Plan actual', { timeout: 15000 }).should('be.visible');
    cy.get('@planDialog').contains('Nuevo plan').should('be.visible');
    cy.get('@planDialog').contains('2 cuotas').should('be.visible');

    cy.get('@planDialog')
      .find('textarea')
      .type('Cambio de plan — control QA, acortar tras pago inicial.');

    cy.intercept('POST', /\/api\/credits\/[^/]+\/plan-change$/).as('planChange');
    cy.get('@planDialog').contains('button', 'Confirmar cambio').should('not.be.disabled').click();

    cy.wait('@planChange').then((interception) => {
      expect(interception.response?.statusCode, 'ejecución de cambio de plan').to.eq(200);
    });
  });

  it('verificación dura — el crédito queda con 2 cuotas: 1 PAID + 1 sobreviviente, el resto anuladas', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((res) => {
        expect(res.status, 'cuotas tras cambio de plan').to.eq(200);
        const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;

        const survivor = rows.find((r) => r['installment_number'] === 2);
        expect(survivor?.['status'], 'cuota 2 sobrevive como única pendiente').to.be.oneOf([
          'PENDING',
          'PARTIAL',
        ]);

        const paid = rows.find((r) => r['installment_number'] === 1);
        expect(paid?.['status'], 'cuota 1 sigue PAID').to.eq('PAID');

        const cancelled = rows.filter((r) => [3, 4].includes(Number(r['installment_number'])));
        cancelled.forEach((row) => {
          expect(row['status'], `cuota ${row['installment_number']} anulada`).to.eq(
            'PLAN_CHANGE_CANCELLED',
          );
        });
      }),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.status, 'crédito tras cambio de plan').to.eq(200);
        expect(res.body?.data?.installments_count, 'installments_count actualizado a 2').to.eq(2);
        expect(res.body?.data?.status, 'crédito sigue activo (no liquidado)').to.eq('ACTIVE');
      }),
    );
  });
});
