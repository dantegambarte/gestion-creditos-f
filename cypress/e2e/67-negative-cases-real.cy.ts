/**
 * SUITE REAL — Enterprise: casos negativos sobre las reglas de negocio de
 * las suites 59-66.
 *
 * Las suites 59-66 solo ejercitan el camino feliz de cada regla. Esta suite
 * rompe a propósito las mismas reglas para confirmar que el backend
 * realmente las bloquea (no solo que el camino feliz "funciona" — eso no
 * demuestra que el guard exista).
 *
 * Nota sobre cobertura deliberadamente NO incluida: la rama "creditWillBeSettled"
 * de plan-change (_resolvePlanChange en credits.service.js, newBalance <= 0)
 * es, con la curva de tasas seedeada actual (rate creciente ~lineal en N),
 * matemáticamente inalcanzable por pago real y proporcional — para que
 * newBalance caiga a 0 haría falta que totalPaid (cuotas pagadas de un plan
 * más caro) superase newCreditTotal (capital × (1+coef) de un plan más
 * corto y más barato), y con esta curva de tasas la diferencia entre
 * coeficientes consecutivos nunca alcanza para eso. Forzarla requeriría
 * mockear amount_paid directamente, lo que no es coherente con el resto de
 * esta suite (100% datos/reglas reales).
 */

describe('Casos negativos — guards de negocio reales (59-66)', () => {
  it('plan-change: un segundo intento sobre el mismo crédito es rechazado (409)', () => {
    cy.apiCreateCustomer({
      full_name: `NegPlan QA ${Date.now().toString().slice(-6)}`,
      dni: `5${Date.now().toString().slice(-7)}`,
      address: 'Calle NegPlan',
      phone: `381${Date.now().toString().slice(-6)}`,
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
            const creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then(() => {
              cy.apiRequest(
                'GET',
                `/installments?credit_id=${creditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                const first = rows.sort(
                  (a, b) =>
                    Number(a['installment_number']) -
                    Number(b['installment_number']),
                )[0];

                cy.apiRequest(
                  'POST',
                  '/payments/admin-direct',
                  {
                    installment_id: first['id'],
                    amount_received: Number(first['amount_due']),
                    payment_method: 'CASH',
                  },
                  token,
                ).then((payRes) => {
                  expect(
                    payRes.status,
                    'cobro de la cuota 1 (vuelve elegible)',
                  ).to.eq(201);

                  cy.apiRequest(
                    'POST',
                    `/credits/${creditId}/plan-change`,
                    { reason: 'Primer cambio.' },
                    token,
                  ).then((firstChangeRes) => {
                    expect(
                      firstChangeRes.status,
                      'primer cambio de plan (debe funcionar)',
                    ).to.eq(200);

                    cy.apiRequest(
                      'POST',
                      `/credits/${creditId}/plan-change`,
                      { reason: 'Segundo intento — debe romper.' },
                      token,
                    ).then((secondChangeRes) => {
                      expect(
                        secondChangeRes.status,
                        'segundo intento bloqueado',
                      ).to.eq(409);
                      expect(
                        secondChangeRes.body?.message,
                        'mensaje real de "solo se permite uno"',
                      ).to.match(/solo se permite uno/i);
                    });
                  });
                });
              });
            });
          }),
      );
    });
  });

  it('write-off: un crédito con cobro PENDING sin aprobar no se puede castigar (409)', () => {
    cy.apiCreateCustomer({
      full_name: `NegWriteOff QA ${Date.now().toString().slice(-6)}`,
      dni: `6${Date.now().toString().slice(-7)}`,
      address: 'Calle NegWriteOff',
      phone: `382${Date.now().toString().slice(-6)}`,
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
              total_amount: 90000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            const creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then(() => {
              cy.apiRequest(
                'GET',
                `/installments?credit_id=${creditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                const installmentId = String(rows[0]['id']);
                const amountDue = Number(rows[0]['amount_due']);

                // Pre-carga SIN aprobar (POST /payments, no admin-direct) —
                // queda PENDING y bloquea cualquier operación de cierre.
                cy.getAuthToken('COLLECTOR').then((collectorToken) =>
                  cy
                    .apiRequest(
                      'POST',
                      '/payments',
                      {
                        installment_id: installmentId,
                        amount_received: amountDue,
                        payment_method: 'CASH',
                      },
                      collectorToken,
                    )
                    .then((payRes) => {
                      expect(
                        payRes.status,
                        'pre-carga sin aprobar (setup)',
                      ).to.eq(201);
                      expect(payRes.body?.data?.status, 'nace PENDING').to.eq(
                        'PENDING',
                      );

                      cy.apiRequest(
                        'POST',
                        `/credits/${creditId}/write-off`,
                        {
                          reason:
                            'Intento de castigo con cobro pendiente — debe romper.',
                        },
                        token,
                      ).then((writeOffRes) => {
                        expect(
                          writeOffRes.status,
                          'castigo bloqueado por cobro pendiente',
                        ).to.eq(409);
                        expect(
                          writeOffRes.body?.message,
                          'mensaje real de cobros pendientes',
                        ).to.match(/pendientes de aprobación/i);
                      });
                    }),
                );
              });
            });
          }),
      );
    });
  });

  it('liquidación: un usuario sin comisiones pendientes ni sueldo no se puede liquidar (409)', () => {
    const stamp = Date.now().toString().slice(-6);
    cy.apiCreateUser({
      full_name: `NegLiquid QA ${stamp}`,
      dni: `7${stamp}`,
      email: `negliquid.${stamp}@qa.test`,
      address: 'Calle NegLiquid',
      role: 'SELLER',
    }).then((createdUser) => {
      const userId = String(
        (createdUser['user'] as Record<string, unknown>)['id'],
      );

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/commissions/liquidate',
            { user_id: userId, payment_method: 'CASH' },
            token,
          )
          .then((res) => {
            expect(
              res.status,
              'liquidación de usuario sin monto positivo',
            ).to.eq(409);
            expect(
              res.body?.message,
              'mensaje real de "no hay monto positivo"',
            ).to.match(/no hay monto positivo a liquidar/i);
          }),
      );
    });
  });

  it('waive-penalty: una cuota ya PAID no admite condonación retroactiva (409)', () => {
    cy.apiCreateCustomer({
      full_name: `NegWaivePaid QA ${Date.now().toString().slice(-6)}`,
      dni: `8${Date.now().toString().slice(-7)}`,
      address: 'Calle NegWaivePaid',
      phone: `383${Date.now().toString().slice(-6)}`,
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
              total_amount: 80000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            const creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then(() => {
              cy.apiRequest(
                'GET',
                `/installments?credit_id=${creditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                const installmentId = String(rows[0]['id']);

                cy.apiRequest(
                  'POST',
                  '/payments/admin-direct',
                  {
                    installment_id: installmentId,
                    amount_received: Number(rows[0]['amount_due']),
                    payment_method: 'CASH',
                  },
                  token,
                ).then((payRes) => {
                  expect(payRes.status, 'cobro completo (setup)').to.eq(201);

                  cy.apiRequest(
                    'PATCH',
                    `/installments/${installmentId}/waive-penalty`,
                    null,
                    token,
                  ).then((waiveRes) => {
                    expect(
                      waiveRes.status,
                      'condonación sobre cuota PAID bloqueada',
                    ).to.eq(409);
                    expect(
                      waiveRes.body?.message,
                      'mensaje real de cancelada/saldo a favor',
                    ).to.match(/saldo a favor/i);
                  });
                });
              });
            });
          }),
      );
    });
  });

  it('waive-penalty: una cuota sin mora aplicada no admite condonación (409)', () => {
    cy.apiCreateCustomer({
      full_name: `NegWaiveNoMora QA ${Date.now().toString().slice(-6)}`,
      dni: `9${Date.now().toString().slice(-7)}`,
      address: 'Calle NegWaiveNoMora',
      phone: `384${Date.now().toString().slice(-6)}`,
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
              total_amount: 70000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            const creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then(() => {
              cy.apiRequest(
                'GET',
                `/installments?credit_id=${creditId}`,
                null,
                token,
              ).then((instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<
                  Record<string, unknown>
                >;
                const installmentId = String(rows[0]['id']);
                expect(
                  Number(rows[0]['penalty_amount']),
                  'cuota recién generada sin mora',
                ).to.eq(0);

                cy.apiRequest(
                  'PATCH',
                  `/installments/${installmentId}/waive-penalty`,
                  null,
                  token,
                ).then((waiveRes) => {
                  expect(
                    waiveRes.status,
                    'condonación sin mora bloqueada',
                  ).to.eq(409);
                  expect(
                    waiveRes.body?.message,
                    'mensaje real de "no tiene mora aplicada"',
                  ).to.match(/no tiene mora aplicada/i);
                });
              });
            });
          }),
      );
    });
  });

  it('alta de venta: enganche >= monto total es rechazado (400)', () => {
    cy.apiCreateCustomer({
      full_name: `NegEnganche QA ${Date.now().toString().slice(-6)}`,
      dni: `1${Date.now().toString().slice(-7)}`,
      address: 'Calle NegEnganche',
      phone: `385${Date.now().toString().slice(-6)}`,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest('GET', '/product-units?status=AVAILABLE', null, token)
          .then((unitsRes) => {
            const units = (unitsRes.body?.data ?? []) as Array<
              Record<string, unknown>
            >;
            const withPrice = units.find((u) => Number(u['current_price']) > 0);
            expect(withPrice, 'unidad disponible para el intento inválido').to
              .exist;
            const unitId = String(withPrice?.['id']);
            const unitPrice = Number(withPrice?.['current_price']);

            cy.apiRequest(
              'POST',
              '/credits',
              {
                customer_id: customerId,
                type: 'SALE',
                unit_ids: [unitId],
                installments_count: 2,
                payment_frequency: 'MONTHLY',
                down_payment_cash: unitPrice,
              },
              token,
            ).then((res) => {
              expect(
                res.status,
                'enganche igual al monto total rechazado',
              ).to.eq(400);
              expect(
                res.body?.message,
                'mensaje real de "no puede ser igual o mayor"',
              ).to.match(/no puede ser igual o mayor/i);
            });
          }),
      );
    });
  });

  it('alta de venta: cuotas adelantadas >= cantidad total de cuotas es rechazado (400)', () => {
    cy.apiCreateCustomer({
      full_name: `NegAdelanto QA ${Date.now().toString().slice(-6)}`,
      dni: `2${Date.now().toString().slice(-7)}`,
      address: 'Calle NegAdelanto',
      phone: `386${Date.now().toString().slice(-6)}`,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest('GET', '/product-units?status=AVAILABLE', null, token)
          .then((unitsRes) => {
            const units = (unitsRes.body?.data ?? []) as Array<
              Record<string, unknown>
            >;
            expect(
              units,
              'unidad disponible para el intento inválido',
            ).to.have.length.greaterThan(0);
            const unitId = String(units[0]['id']);

            cy.apiRequest(
              'POST',
              '/credits',
              {
                customer_id: customerId,
                type: 'SALE',
                unit_ids: [unitId],
                installments_count: 2,
                payment_frequency: 'MONTHLY',
                prepaid_installments: 2,
                prepaid_installments_method: 'CASH',
              },
              token,
            ).then((res) => {
              expect(res.status, 'cuotas adelantadas >= total rechazado').to.eq(
                400,
              );
              expect(
                res.body?.message,
                'mensaje real de "deben ser menores a la cantidad total"',
              ).to.match(/menores a la cantidad total de cuotas/i);
            });
          }),
      );
    });
  });

  it('cron creditExpiry: también expira un LOAN viejo (no solo SALE con unidad reservada)', () => {
    const stamp = Date.now().toString().slice(-6);
    cy.apiCreateCustomer({
      full_name: `NegExpiryLoan QA ${stamp}`,
      dni: `3${stamp}`,
      address: 'Calle NegExpiryLoan',
      phone: `387${stamp}`,
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
              total_amount: 60000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            expect(
              createRes.status,
              'alta de préstamo (setup, queda pendiente)',
            ).to.eq(201);
            const creditId = String(createRes.body?.data?.id);

            cy.apiRequest(
              'GET',
              '/system-config/credit_expiry_days',
              null,
              token,
            ).then((configRes) => {
              const expiryDays = Number(
                (configRes.body?.data as { value?: string } | undefined)
                  ?.value ?? 7,
              );
              const oldCreatedAt = new Date();
              oldCreatedAt.setDate(oldCreatedAt.getDate() - (expiryDays + 2));

              cy.apiForceCreditCreatedAt(
                creditId,
                oldCreatedAt.toISOString(),
              ).then(() => {
                cy.task('cron:run', 'creditExpiry').then((result) => {
                  const taskResult = result as { ok: boolean; error?: string };
                  expect(
                    taskResult.ok,
                    `cron:run creditExpiry — ${taskResult.error ?? ''}`,
                  ).to.eq(true);
                });

                cy.apiRequest('GET', `/credits/${creditId}`, null, token).then(
                  (res) => {
                    expect(
                      res.body?.data?.status,
                      'LOAN vencido también expira',
                    ).to.eq('EXPIRED');
                  },
                );
              });
            });
          }),
      );
    });
  });
});
