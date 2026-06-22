/**
 * SUITE REAL — Enterprise: reasignación de cobrador a mitad de ciclo.
 *
 * Ninguna otra suite real toca qué pasa cuando `assigned_collector_id` de un
 * cliente cambia DESPUÉS de que ya existe una planilla activa para el
 * cobrador original. Tres hallazgos reales de cómo el sistema se comporta
 * (no supuestos — verificados contra el código real):
 *
 *   1. La planilla es INMUTABLE (snapshot_version >= 1, ver
 *      collections.queries.js findById) — el cobrador original sigue
 *      pudiendo gestionarla normalmente sin importar que el cliente ya
 *      tenga otro cobrador asignado.
 *
 *   2. `findInstallmentsForSheet` filtra por `cu.assigned_collector_id`
 *      LIVE (el valor actual, no un snapshot) y NO excluye cuotas que ya
 *      estén en OTRA planilla ACTIVE — generar una planilla nueva para el
 *      cobrador nuevo el mismo día incluye la MISMA cuota: double-booking
 *      real, sin guard de exclusión cross-sheet a nivel de generación.
 *
 *   3. La red de seguridad real está en el backend de pagos, no en el
 *      front: `payments.service.js create()` rechaza con 409 si
 *      `installment.status === 'PAID'`. La capa "live" que el backend
 *      adjunta a planillas ACTIVE de hoy (ver findById) refleja ese estado
 *      real en la planilla nueva — pero el botón "Cobrar" del cobrador
 *      nuevo NO chequea esa capa live para habilitarse/deshabilitarse
 *      (collection-sheet-detail.component.ts canRegisterPayment), así que
 *      sigue clickeable. El intento de todas formas es rechazado por el
 *      guard real del backend al confirmar — no hay cobro duplicado
 *      posible, solo una rugosidad de UX.
 */

describe('Reasignación de cobrador a mitad de ciclo (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Reasignar QA ${stamp}`,
    dni: `7${stamp}9`,
    address: 'Calle Reasignar',
    phone: `397${stamp}`,
  };

  let customerId: string;
  let creditId: string;
  let installmentId: string;
  let amountDue: number;
  let collectorAId: string;
  let collectorBId: string;
  let sheetAId: string;
  let sheetBId: string;

  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  before(() => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', '/test/business-days/today', null, token),
    );
  });

  it('setup — cliente con cobrador A, planilla A generada con su cuota', () => {
    cy.getAuthToken('COLLECTOR').then((tokenA) =>
      cy.apiRequest('GET', '/auth/me', null, tokenA).then((meRes) => {
        collectorAId = String(
          (meRes.body?.data as { id?: string } | undefined)?.id ?? '',
        );
      }),
    );
    cy.getAuthToken('SELLER_COLLECTOR').then((tokenB) =>
      cy.apiRequest('GET', '/auth/me', null, tokenB).then((meRes) => {
        collectorBId = String(
          (meRes.body?.data as { id?: string } | undefined)?.id ?? '',
        );
      }),
    );

    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) => {
        cy.apiRequest(
          'PUT',
          `/customers/${customerId}`,
          { assigned_collector_id: collectorAId },
          token,
        ).then((assignRes) => {
          expect(assignRes.status, 'asignación inicial al cobrador A').to.eq(
            200,
          );
        });

        cy.apiRequest(
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
        ).then((createRes) => {
          expect(createRes.status, 'alta de préstamo (setup)').to.eq(201);
          creditId = String(createRes.body?.data?.id);

          cy.apiApproveCredit(creditId).then((approved) => {
            expect(approved['status'], 'crédito activo tras aprobación').to.eq(
              'ACTIVE',
            );

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
              amountDue = Number(rows[0]['amount_due']);

              cy.apiRequest(
                'POST',
                '/collections',
                {
                  collector_id: collectorAId,
                  date: todayIso(),
                  skip_if_exists: false,
                },
                token,
              ).then((sheetRes) => {
                expect([200, 201], 'planilla A generada').to.include(
                  sheetRes.status,
                );
                sheetAId = String(sheetRes.body?.data?.sheet?.id ?? '');
                expect(sheetAId, 'id de planilla A').to.not.equal('');

                cy.apiRequest(
                  'GET',
                  `/collections/${sheetAId}`,
                  null,
                  token,
                ).then((sheetDetailRes) => {
                  const items = (sheetDetailRes.body?.data?.items ??
                    []) as Array<Record<string, unknown>>;
                  const mine = items.find(
                    (it) => it['installment_id'] === installmentId,
                  );
                  expect(mine, 'la cuota está en la planilla A').to.exist;
                });
              });
            });
          });
        });
      });
    });
  });

  it('hallazgo 1+2 — reasignar a cobrador B y generar planilla B incluye la MISMA cuota (double-booking real)', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest(
        'PUT',
        `/customers/${customerId}`,
        { assigned_collector_id: collectorBId },
        token,
      ).then((reassignRes) => {
        expect(
          reassignRes.status,
          'reasignación al cobrador B a mitad de ciclo',
        ).to.eq(200);
      });

      cy.apiRequest(
        'POST',
        '/collections',
        { collector_id: collectorBId, date: todayIso(), skip_if_exists: false },
        token,
      ).then((sheetRes) => {
        expect([200, 201], 'planilla B generada el mismo día').to.include(
          sheetRes.status,
        );
        sheetBId = String(sheetRes.body?.data?.sheet?.id ?? '');
        expect(sheetBId, 'id de planilla B')
          .to.not.equal('')
          .and.to.not.equal(sheetAId);

        cy.apiRequest('GET', `/collections/${sheetBId}`, null, token).then(
          (sheetDetailRes) => {
            const items = (sheetDetailRes.body?.data?.items ?? []) as Array<
              Record<string, unknown>
            >;
            const mine = items.find(
              (it) => it['installment_id'] === installmentId,
            );
            expect(
              mine,
              'la MISMA cuota aparece también en la planilla B — sin guard de exclusión cross-sheet',
            ).to.exist;
          },
        );
      });

      // La planilla A original sigue intacta y operable para el cobrador A —
      // es inmutable, no le importa que el cliente ya tenga otro cobrador.
      cy.apiRequest('GET', `/collections/${sheetAId}`, null, token).then(
        (sheetARes) => {
          const items = (sheetARes.body?.data?.items ?? []) as Array<
            Record<string, unknown>
          >;
          const mine = items.find(
            (it) => it['installment_id'] === installmentId,
          );
          expect(mine, 'la cuota sigue en la planilla A original (inmutable)')
            .to.exist;
          expect(sheetARes.body?.data?.status, 'planilla A sigue ACTIVE').to.eq(
            'ACTIVE',
          );
        },
      );
    });
  });

  it('el cobrador A cobra desde SU planilla original y ADMIN aprueba', () => {
    cy.viewport(1280, 720);
    cy.loginReal('COLLECTOR', `/collector/route/${sheetAId}`);
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      `/collector/route/${sheetAId}`,
    );
    cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

    cy.intercept('POST', '/api/payments').as('createPayment');
    cy.contains(customer.fullName, { timeout: 15000 })
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Cobrar').click({ force: true });
      });

    cy.contains('.p-dialog', 'Registrar Cobro', { timeout: 10000 }).should(
      'be.visible',
    );
    cy.get('.p-dialog p-inputnumber input')
      .first()
      .clear()
      .type(String(amountDue))
      .blur();
    cy.contains('.p-dialog button', 'Confirmar')
      .should('not.be.disabled')
      .click();

    cy.wait('@createPayment').then((interception) => {
      expect(
        interception.response?.statusCode,
        'pre-carga del cobrador A',
      ).to.eq(201);
    });

    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'GET',
          `/payments?installment_id=${installmentId}&status=PENDING`,
          null,
          token,
        )
        .then((paymentsRes) => {
          const rows = (paymentsRes.body?.data ?? []) as Array<
            Record<string, unknown>
          >;
          expect(
            rows,
            'pre-carga pendiente del cobrador A',
          ).to.have.length.greaterThan(0);
          const paymentId = String(rows[0]['id']);

          cy.apiRequest(
            'PATCH',
            `/payments/${paymentId}/approve`,
            null,
            token,
          ).then((approveRes) => {
            expect(approveRes.status, 'aprobación del cobro').to.eq(200);
          });
        }),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('GET', `/installments/${installmentId}`, null, token)
        .then((res) => {
          expect(res.body?.data?.status, 'cuota PAID tras el cobro real').to.eq(
            'PAID',
          );
        }),
    );
  });

  it('hallazgo 3 — la planilla B refleja PAID vía la capa live, y un intento de cobro del cobrador B es rechazado (409 real)', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('GET', `/collections/${sheetBId}`, null, token)
        .then((res) => {
          const items = (res.body?.data?.items ?? []) as Array<
            Record<string, unknown>
          >;
          const mine = items.find(
            (it) => it['installment_id'] === installmentId,
          );
          expect(mine, 'la cuota sigue listada en la planilla B').to.exist;
          const live = mine?.['live'] as
            | Record<string, unknown>
            | null
            | undefined;
          expect(live, 'la planilla B es de hoy y ACTIVE: tiene capa live').to
            .not.be.null;
          expect(
            live?.['installment_status'],
            'la capa live refleja el PAID real, aunque el snapshot diga otra cosa',
          ).to.eq('PAID');
        }),
    );

    // El backend siempre es la red de seguridad real, sin importar lo que
    // muestre el botón del front: el cobrador B no puede cobrar una cuota
    // que ya está PAID de verdad.
    cy.getAuthToken('SELLER_COLLECTOR').then((tokenB) =>
      cy
        .apiRequest(
          'POST',
          '/payments',
          {
            installment_id: installmentId,
            amount_received: 100,
            payment_method: 'CASH',
          },
          tokenB,
        )
        .then((res) => {
          expect(res.status, 'intento de doble cobro real rechazado').to.eq(
            409,
          );
          expect(res.body?.message, 'mensaje real de cuota ya pagada').to.match(
            /ya fue pagada/i,
          );
        }),
    );
  });
});
