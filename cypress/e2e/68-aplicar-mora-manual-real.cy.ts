/**
 * SUITE REAL — Enterprise: aplicación manual de mora + tope máximo.
 *
 * Cubre PATCH /installments/:id/apply-penalty, el único de los 3 endpoints
 * de mora (apply/waive/early-pay) que ninguna otra suite real ejercita.
 * Regla de negocio (installments.service.js applyPenalty):
 *   - Solo aplica sobre cuotas OVERDUE (409 en cualquier otro estado).
 *   - Tope: penalty_amount nunca puede superar original_amount × penalty_max_rate
 *     (0.50 por defecto). Si el monto pedido excede el remanente hasta el
 *     tope, se aplica SOLO el remanente (no se rechaza) — recién cuando el
 *     tope ya está alcanzado, un nuevo intento da 409.
 *
 * Setup: mora real vía cron (igual que 57/59), después condonada por API
 * (deja la cuota OVERDUE con penalty_amount=0 — el estado "Sin aplicar" que
 * habilita el botón "Aplicar mora" en Morosidad). El primer apply se hace
 * por UI real; los siguientes (para alcanzar el tope con precisión) por API,
 * mismo patrón que las suites 59-67.
 */

describe('Aplicación manual de mora + tope máximo (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `AplicarMora QA ${stamp}`,
    dni: `4${stamp}9`,
    address: `Calle AplicarMora ${stamp}`,
    phone: `384${stamp}`,
  };

  let creditId: string;
  let installmentId: string;
  let originalAmount: number;
  let maxPenalty: number;

  before(() => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', '/test/business-days/today', null, token),
    );
  });

  it('setup — cuota OVERDUE real, condonada (queda "Sin aplicar" para habilitar el botón)', () => {
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
              expect(
                approved['status'],
                'crédito activo tras aprobación',
              ).to.eq('ACTIVE');

              cy.apiRequest(
                'GET',
                `/installments?credit_id=${creditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                installmentId = String(rows[0]['id']);

                cy.apiRequest(
                  'GET',
                  '/system-config/penalty_grace_days',
                  null,
                  token,
                ).then((configRes) => {
                  const graceDays = Number(
                    (configRes.body?.data as { value?: string } | undefined)
                      ?.value ?? 3,
                  );
                  const due = new Date();
                  due.setDate(due.getDate() - (graceDays + 5));
                  const forcedDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

                  cy.apiForceInstallmentDueDate(
                    installmentId,
                    forcedDueDate,
                  ).then(() => {
                    cy.task('cron:run', 'overdueInstallments').then(
                      (result) => {
                        const taskResult = result as {
                          ok: boolean;
                          error?: string;
                        };
                        expect(
                          taskResult.ok,
                          `cron:run overdueInstallments — ${taskResult.error ?? ''}`,
                        ).to.eq(true);
                      },
                    );

                    cy.apiRequest(
                      'GET',
                      `/installments/${installmentId}`,
                      null,
                      token,
                    ).then((afterCronRes) => {
                      expect(
                        afterCronRes.body?.data?.status,
                        'vencida tras cron',
                      ).to.eq('OVERDUE');
                      expect(
                        Number(afterCronRes.body?.data?.penalty_amount),
                        'mora real aplicada por el cron',
                      ).to.be.greaterThan(0);

                      cy.apiRequest(
                        'PATCH',
                        `/installments/${installmentId}/waive-penalty`,
                        null,
                        token,
                      ).then((waiveRes) => {
                        expect(waiveRes.status, 'condonación (setup)').to.eq(
                          200,
                        );

                        cy.apiRequest(
                          'GET',
                          `/installments/${installmentId}`,
                          null,
                          token,
                        ).then((afterWaiveRes) => {
                          const data = afterWaiveRes.body?.data as Record<
                            string,
                            unknown
                          >;
                          expect(
                            Number(data['penalty_amount']),
                            'mora condonada a 0',
                          ).to.eq(0);
                          expect(
                            data['status'],
                            'sigue OVERDUE (due_date todavía vencida) — habilita "Aplicar mora"',
                          ).to.eq('OVERDUE');

                          originalAmount = Number(data['amount_due']);
                          maxPenalty =
                            Math.round(originalAmount * 0.5 * 100) / 100;
                        });
                      });
                    });
                  });
                });
              });
            });
          }),
      );
    });
  });

  it('ADMIN aplica mora manual por UI desde Morosidad (camino feliz, bien por debajo del tope)', () => {
    cy.viewport(1280, 720);
    expect(maxPenalty, 'tope calculado en el setup').to.be.greaterThan(0);
    const firstAmount = Math.round(maxPenalty * 0.3 * 100) / 100;

    cy.intercept('GET', '**/installments*').as('listInstallments');
    cy.loginReal('ADMIN', '/admin/delinquency');
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/admin/delinquency',
    );
    cy.get('app-error-state').should('not.exist');

    // Lección de 57-maquina-del-tiempo: esperar la carga real ANTES de
    // buscar/tipear evita la carrera de filteredClients.
    cy.wait('@listInstallments');
    cy.get('p-table tbody tr', { timeout: 20000 }).should(
      'have.length.greaterThan',
      0,
    );

    cy.get('input[placeholder="Buscar cliente..."]', { timeout: 15000 })
      .clear()
      .type(customer.dni);
    cy.contains(customer.dni, { timeout: 20000 })
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Aplicar mora').click({ force: true });
      });

    cy.contains('.p-dialog-title', 'Aplicar mora', { timeout: 10000 })
      .closest('.p-dialog')
      .as('applyDialog');
    cy.get('@applyDialog')
      .find('input[type="number"]')
      .clear()
      .type(String(firstAmount));

    cy.intercept('PATCH', /\/api\/installments\/[^/]+\/apply-penalty$/).as(
      'applyPenalty',
    );
    cy.get('@applyDialog')
      .contains('button', 'Aplicar')
      .should('not.be.disabled')
      .click();

    cy.wait('@applyPenalty').then((interception) => {
      expect(
        interception.response?.statusCode,
        'aplicación de mora manual',
      ).to.eq(200);
    });

    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('GET', `/installments/${installmentId}`, null, token)
        .then((res) => {
          expect(
            Number(res.body?.data?.penalty_amount),
            'mora aplicada exactamente el monto pedido (bien debajo del tope)',
          ).to.be.closeTo(firstAmount, 0.01);
        }),
    );
  });

  it('un segundo intento que excede el remanente queda capado exacto al tope (no se rechaza)', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('GET', `/installments/${installmentId}`, null, token)
        .then((beforeRes) => {
          const currentPenalty = Number(beforeRes.body?.data?.penalty_amount);
          const remaining =
            Math.round((maxPenalty - currentPenalty) * 100) / 100;
          expect(remaining, 'queda remanente hasta el tope').to.be.greaterThan(
            0,
          );

          // Se pide MÁS que el remanente a propósito — el servicio debe capar,
          // no rechazar (ver installments.service.js: Math.min(penaltyAmount,
          // maxPenalty - currentPenalty)).
          cy.apiRequest(
            'PATCH',
            `/installments/${installmentId}/apply-penalty`,
            { penalty_amount: remaining * 10 },
            token,
          ).then((res) => {
            expect(
              res.status,
              'segunda aplicación (capada, no rechazada)',
            ).to.eq(200);
          });

          cy.apiRequest(
            'GET',
            `/installments/${installmentId}`,
            null,
            token,
          ).then((afterRes) => {
            expect(
              Number(afterRes.body?.data?.penalty_amount),
              'mora queda exactamente en el tope máximo',
            ).to.be.closeTo(maxPenalty, 0.01);
          });
        }),
    );
  });

  it('con el tope ya alcanzado, un tercer intento es rechazado (409)', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'PATCH',
          `/installments/${installmentId}/apply-penalty`,
          { penalty_amount: 100 },
          token,
        )
        .then((res) => {
          expect(res.status, 'tercer intento con tope ya alcanzado').to.eq(409);
          expect(res.body?.message, 'mensaje real de tope máximo').to.match(
            /tope máximo/i,
          );
        }),
    );
  });

  it('aplicar mora sobre una cuota que no está OVERDUE es rechazado (409)', () => {
    cy.apiCreateCustomer({
      full_name: `AplicarMoraNoOverdue QA ${stamp}`,
      dni: `5${stamp}8`,
      address: 'Calle AplicarMoraNoOverdue',
      phone: `385${stamp}`,
    }).then((createdCustomer) => {
      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/credits',
            {
              customer_id: String(createdCustomer['id']),
              type: 'LOAN',
              total_amount: 60000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            const freshCreditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(freshCreditId).then(() => {
              cy.apiRequest(
                'GET',
                `/installments?credit_id=${freshCreditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                const freshInstallmentId = String(rows[0]['id']);
                expect(
                  rows[0]['status'],
                  'cuota recién generada, sin vencer',
                ).to.eq('PENDING');

                cy.apiRequest(
                  'PATCH',
                  `/installments/${freshInstallmentId}/apply-penalty`,
                  { penalty_amount: 100 },
                  token,
                ).then((res) => {
                  expect(
                    res.status,
                    'mora sobre cuota no vencida rechazada',
                  ).to.eq(409);
                  expect(
                    res.body?.message,
                    'mensaje real de "solo OVERDUE"',
                  ).to.match(/solo se aplica mora a cuotas overdue/i);
                });
              });
            });
          }),
      );
    });
  });
});
