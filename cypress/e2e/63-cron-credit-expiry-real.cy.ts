/**
 * SUITE REAL — Enterprise: cron creditExpiry.
 *
 * Cubre el job `creditExpiry.job.js`: créditos PENDING_APPROVAL que llevan
 * más de `credit_expiry_days` desde su alta pasan a EXPIRED y, si reservaron
 * unidades de producto (SALE), esas unidades vuelven a AVAILABLE.
 *
 * Setup vía API: crédito SALE creado pero nunca aprobado (queda
 * PENDING_APPROVAL con la unidad en RESERVED), su `created_at` se fuerza
 * hacia atrás vía ruta test-only para simular el paso del tiempo real, y se
 * corre el cron real (`run-cron.js`) — no se mockea ninguna regla de negocio.
 */

describe('Cron creditExpiry — expira pre-aprobaciones vencidas (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Expiry QA ${stamp}`,
    dni: `1${stamp}9`,
    address: `Calle Expiry ${stamp}`,
    phone: `381${stamp}`,
  };

  let creditId: string;
  let unitId: string;

  it('setup — SALE en PENDING_APPROVAL con unidad RESERVED, alta forzada a vieja', () => {
    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy.apiRequest('GET', '/product-units?status=AVAILABLE', null, token).then((unitsRes) => {
          const units = (unitsRes.body?.data ?? []) as Array<Record<string, unknown>>;
          expect(units, 'al menos una unidad disponible (cualquier producto)').to.have.length.greaterThan(0);
          unitId = String(units[0]['id']);

          cy.apiRequest(
            'POST',
            '/credits',
            {
              customer_id: customerId,
              type: 'SALE',
              unit_ids: [unitId],
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          ).then((createRes) => {
            expect(createRes.status, 'alta de venta (setup, queda pendiente)').to.eq(201);
            creditId = String(createRes.body?.data?.id);

            cy.apiRequest('GET', `/product-units/${unitId}`, null, token).then((unitRes) => {
              expect(unitRes.body?.data?.status, 'unidad reservada al crear la venta').to.eq(
                'RESERVED',
              );
            });

            cy.apiRequest('GET', '/system-config/credit_expiry_days', null, token).then(
              (configRes) => {
                const expiryDays = Number(
                  (configRes.body?.data as { value?: string } | undefined)?.value ?? 7,
                );
                const oldCreatedAt = new Date();
                oldCreatedAt.setDate(oldCreatedAt.getDate() - (expiryDays + 2));

                cy.apiForceCreditCreatedAt(creditId, oldCreatedAt.toISOString());
              },
            );
          });
        }),
      );
    });
  });

  it('corre el cron real creditExpiry: el crédito vencido expira y la unidad se libera', () => {
    cy.task('cron:run', 'creditExpiry').then((result) => {
      const taskResult = result as { ok: boolean; error?: string };
      expect(taskResult.ok, `cron:run creditExpiry — ${taskResult.error ?? ''}`).to.eq(true);
    });

    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.status, 'crédito tras el cron').to.eq(200);
        expect(res.body?.data?.status, 'crédito vencido pasa a EXPIRED').to.eq('EXPIRED');
      });

      cy.apiRequest('GET', `/product-units/${unitId}`, null, token).then((res) => {
        expect(res.body?.data?.status, 'unidad liberada de vuelta a AVAILABLE').to.eq('AVAILABLE');
      });
    });
  });

  it('un crédito PENDING_APPROVAL reciente no es tocado por el cron', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiCreateCustomer({
        full_name: `Expiry Fresh QA ${stamp}`,
        dni: `2${stamp}8`,
        address: `Calle Fresh ${stamp}`,
        phone: `382${stamp}`,
      }).then((createdCustomer) => {
        cy.apiRequest(
          'POST',
          '/credits',
          {
            customer_id: String(createdCustomer['id']),
            type: 'LOAN',
            total_amount: 80000,
            installments_count: 2,
            payment_frequency: 'MONTHLY',
          },
          token,
        ).then((createRes) => {
          expect(createRes.status, 'alta de préstamo reciente (control)').to.eq(201);
          const freshCreditId = String(createRes.body?.data?.id);

          cy.task('cron:run', 'creditExpiry').then((result) => {
            const taskResult = result as { ok: boolean; error?: string };
            expect(taskResult.ok, `cron:run creditExpiry — ${taskResult.error ?? ''}`).to.eq(true);
          });

          cy.apiRequest('GET', `/credits/${freshCreditId}`, null, token).then((res) => {
            expect(res.body?.data?.status, 'crédito reciente sigue pendiente').to.eq(
              'PENDING_APPROVAL',
            );
          });
        });
      }),
    );
  });
});
