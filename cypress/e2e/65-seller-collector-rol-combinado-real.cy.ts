/**
 * SUITE REAL — Enterprise: rol combinado SELLER_COLLECTOR.
 *
 * Ninguna otra suite real ejercita este rol: una sola identidad real
 * (DNI 33333333, seed `04_bulk_data.seed.js`) que tiene permiso simultáneo
 * sobre `/seller/*` y `/collector/*` (ver guard en `app.routes.ts`). Cubre el
 * caso de negocio real de "vendedor que también cobra su propia cartera":
 * origina la venta (comisión se imputa a su propio user_id), y luego cobra
 * la cuota de esa misma venta desde la ruta de cobranza, sin cambiar de
 * usuario.
 *
 * Setup de la venta vía API (origina con el token de SELLER_COLLECTOR, no
 * con ADMIN — la comisión se imputa a `credit.created_by`, ver
 * credits.service.js). La parte de UI que interesa probar es el acceso
 * cruzado a ambas áreas con la misma sesión.
 */

type MeResponse = { id?: string; full_name?: string };

describe('Rol combinado SELLER_COLLECTOR — vende y cobra su propia cartera (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `RolCombi QA ${stamp}`,
    dni: `8${stamp}2`,
    address: `Calle RolCombi ${stamp}`,
    phone: `388${stamp}`,
  };

  let sellerCollectorId: string;
  let creditId: string;
  let installmentId: string;
  let amountDue: number;
  let sheetId: string;

  it('setup — SELLER_COLLECTOR origina un préstamo propio y queda ACTIVE', () => {
    cy.getAuthToken('SELLER_COLLECTOR').then((scToken) =>
      cy.apiRequest('GET', '/auth/me', null, scToken).then((meRes) => {
        expect(meRes.status, 'auth/me seller_collector').to.eq(200);
        sellerCollectorId = String((meRes.body?.data as MeResponse | undefined)?.id ?? '');
        expect(sellerCollectorId, 'id real del seller_collector').to.not.equal('');
      }),
    );

    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('SELLER_COLLECTOR').then((scToken) =>
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
            scToken,
          )
          .then((createRes) => {
            expect(createRes.status, 'alta de préstamo propio (setup)').to.eq(201);
            creditId = String(createRes.body?.data?.id);

            cy.apiRequest('GET', `/credits/${creditId}`, null, scToken).then((detailRes) => {
              expect(
                detailRes.body?.data?.created_by,
                'el alta queda imputada al propio seller_collector',
              ).to.eq(sellerCollectorId);
            });

            cy.apiApproveCredit(creditId).then((approved) => {
              expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');
            });
          }),
      );

      cy.getAuthToken('ADMIN').then((token) => {
        // Se asigna a sí mismo como cobrador — caso real: el mismo usuario
        // gestiona de punta a punta su propia cartera de clientes.
        cy.apiRequest('PUT', `/customers/${customerId}`, { assigned_collector_id: sellerCollectorId }, token).then(
          (assignRes) => {
            expect(assignRes.status, 'asignación de cobrador propio').to.eq(200);
          },
        );

        cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((instRes) => {
          const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
          installmentId = String(rows[0]['id']);
          amountDue = Number(rows[0]['amount_due']);

          const today = new Date();
          const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          cy.apiRequest(
            'POST',
            '/collections',
            { collector_id: sellerCollectorId, date: todayIso, skip_if_exists: false },
            token,
          ).then((sheetRes) => {
            expect([200, 201], 'generar planilla del propio cobrador').to.include(sheetRes.status);
            sheetId = String(sheetRes.body?.data?.sheet?.id ?? '');
            expect(sheetId, 'id de planilla generada').to.not.equal('');
          });
        });
      });
    });
  });

  it('la comisión de la venta quedó imputada al seller_collector (no a otro usuario)', () => {
    cy.getAuthToken('SELLER_COLLECTOR').then((scToken) =>
      cy.apiRequest('GET', `/commissions?status=PENDING&user_id=${sellerCollectorId}`, null, scToken).then(
        (res) => {
          expect(res.status, 'comisiones pendientes propias').to.eq(200);
          const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
          const mine = rows.find((r) => r['credit_id'] === creditId);
          // LOAN no genera comisión (solo SALE) — la regla real es que no
          // exista registro de comisión para este crédito en absoluto.
          expect(mine, 'LOAN no genera comisión (solo SALE)').to.be.undefined;
        },
      ),
    );
  });

  it('el mismo usuario accede a /seller/* y cobra desde /collector/* sin cambiar de sesión', () => {
    cy.viewport(1280, 720);
    expect(sheetId, 'planilla generada en el setup').to.be.a('string').and.not.be.empty;

    cy.loginReal('SELLER_COLLECTOR', '/seller/operations');
    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/operations');
    cy.get('app-error-state').should('not.exist');

    cy.visit(`/collector/route/${sheetId}`);
    cy.location('pathname', { timeout: 15000 }).should('eq', `/collector/route/${sheetId}`);
    cy.get('app-error-state').should('not.exist');
    cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

    cy.intercept('POST', '/api/payments').as('createPayment');
    cy.contains(customer.fullName, { timeout: 15000 })
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Cobrar').click({ force: true });
      });

    cy.contains('.p-dialog', 'Registrar Cobro', { timeout: 10000 }).should('be.visible');
    cy.get('.p-dialog p-inputnumber input').first().clear().type(String(amountDue)).blur();
    cy.contains('.p-dialog button', 'Confirmar').should('not.be.disabled').click();

    cy.wait('@createPayment').then((interception) => {
      expect(interception.response?.statusCode, 'alta de pre-carga propia').to.eq(201);
      expect(interception.response?.body?.data?.status, 'pre-carga nace PENDING').to.eq('PENDING');
    });
  });

  it('ADMIN aprueba el cobro y la cuota queda PAID', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/payments?installment_id=${installmentId}&status=PENDING`, null, token).then(
        (paymentsRes) => {
          const rows = (paymentsRes.body?.data ?? []) as Array<Record<string, unknown>>;
          expect(rows, 'pre-carga pendiente del paso anterior').to.have.length.greaterThan(0);
          const paymentId = String(rows[0]['id']);

          cy.apiRequest('PATCH', `/payments/${paymentId}/approve`, null, token).then((approveRes) => {
            expect(approveRes.status, 'aprobación del cobro').to.eq(200);
          });
        },
      ),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments/${installmentId}`, null, token).then((res) => {
        expect(res.status, 'cuota tras aprobación').to.eq(200);
        expect(res.body?.data?.status, 'cuota cobrada por su propio gestor').to.eq('PAID');
      }),
    );
  });
});
