/**
 * SUITE REAL — Enterprise: enganche MIXED + cuotas adelantadas, flujo
 * multi-rol completo.
 *
 * Ninguna otra suite real combina estas dos condiciones de alta en un mismo
 * crédito SALE (el wizard del seller las modela como mutuamente excluyentes
 * — "Enganche" vs "Cuotas adelantadas" son radios del mismo grupo
 * `initialPaymentType`, ver step-conditions.component.html — pero el
 * backend sí las soporta combinadas en una sola alta vía API, ver
 * credits.service.js `create`/`approve`):
 *   - down_payment_cash + down_payment_transfer ambos > 0 → paymentMethod
 *     resuelto a "MIXED" (normalizeCreditIntake).
 *   - prepaid_installments > 0 → cuotas iniciales se marcan PAID al
 *     aprobar y las restantes corren sus fechas (shiftInstallmentDates).
 *
 * Tras el alta combinada, el flujo sigue siendo real y multi-rol: ADMIN
 * aprueba, se asigna cobrador y se genera planilla para la única cuota que
 * sobrevive, el COLLECTOR la cobra por UI, ADMIN aprueba el cobro (el
 * crédito pasa a SETTLED automáticamente al ser la última cuota pendiente),
 * y el PORTAL del cliente refleja el saldo final en 0.
 */

type MeResponse = { id?: string };

describe('Enganche MIXED + cuotas adelantadas — flujo multi-rol real', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Mixto QA ${stamp}`,
    dni: `9${stamp}1`,
    address: `Calle Mixto ${stamp}`,
    phone: `389${stamp}`,
  };
  const portalPassword = `Portal#${stamp}`;

  let creditId: string;
  let customerId: string;
  let collectorId: string;
  let unitPrice: number;
  let downPaymentCash: number;
  let downPaymentTransfer: number;
  let survivingInstallmentId: string;
  let sheetId: string;
  let portalTempPassword: string;

  it('setup — SALE con enganche MIXED + 1 cuota adelantada en una sola alta real', () => {
    cy.getAuthToken('COLLECTOR').then((collectorToken) =>
      cy.apiRequest('GET', '/auth/me', null, collectorToken).then((meRes) => {
        collectorId = String((meRes.body?.data as MeResponse | undefined)?.id ?? '');
        expect(collectorId, 'id real del collector').to.not.equal('');
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
        cy.apiRequest('PATCH', `/customers/${customerId}/enable-portal`, null, token).then(
          (enableRes) => {
            expect(enableRes.status, 'habilitar portal del cliente').to.eq(200);
            portalTempPassword = String(enableRes.body?.data?.tempPassword ?? '');
            expect(portalTempPassword, 'temp password de portal').to.not.equal('');
          },
        );

        cy.apiRequest('GET', '/product-units?status=AVAILABLE', null, token).then((unitsRes) => {
          const units = (unitsRes.body?.data ?? []) as Array<Record<string, unknown>>;
          const withPrice = units.find((u) => Number(u['current_price']) >= 5000);
          expect(withPrice, 'unidad disponible con precio suficiente para el split').to.exist;
          const unitId = String(withPrice?.['id']);
          unitPrice = Number(withPrice?.['current_price']);

          downPaymentCash = Math.floor(unitPrice * 0.1);
          downPaymentTransfer = Math.floor(unitPrice * 0.1);

          cy.getAuthToken('SELLER').then((sellerToken) =>
            cy
              .apiRequest(
                'POST',
                '/credits',
                {
                  customer_id: customerId,
                  type: 'SALE',
                  unit_ids: [unitId],
                  installments_count: 2,
                  payment_frequency: 'MONTHLY',
                  down_payment_cash: downPaymentCash,
                  down_payment_transfer: downPaymentTransfer,
                  down_payment_transfer_reference: 'QA-ENGANCHE-MIXTO',
                  prepaid_installments: 1,
                  prepaid_installments_method: 'TRANSFER',
                  prepaid_installments_transfer_reference: 'QA-ADELANTO',
                },
                sellerToken,
              )
              .then((createRes) => {
                expect(createRes.status, 'alta combinada enganche MIXED + adelanto (setup)').to.eq(
                  201,
                );
                creditId = String(createRes.body?.data?.id);

                cy.apiApproveCredit(creditId).then((approved) => {
                  expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');
                });
              }),
          );
        });
      });
    });
  });

  it('verificación dura — el enganche resolvió a MIXED y la cuota adelantada quedó PAID', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.status, 'detalle del crédito tras aprobación').to.eq(200);
        const data = res.body?.data as Record<string, unknown>;
        expect(Number(data['down_payment_cash']), 'enganche en efectivo persistido').to.eq(
          downPaymentCash,
        );
        expect(Number(data['down_payment_transfer']), 'enganche por transferencia persistido').to.eq(
          downPaymentTransfer,
        );
        expect(data['down_payment_method'], 'método resuelto a MIXED').to.eq('MIXED');
        expect(Number(data['prepaid_installments']), 'una cuota adelantada declarada').to.eq(1);
      });

      cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((res) => {
        const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        expect(rows, 'dos cuotas generadas').to.have.length(2);
        const sorted = rows.sort(
          (a, b) => Number(a['installment_number']) - Number(b['installment_number']),
        );

        expect(sorted[0]['status'], 'cuota 1 cubierta por el adelanto, queda PAID').to.eq('PAID');
        expect(['PENDING', 'PARTIAL'], 'cuota 2 sobrevive como pendiente').to.include(
          sorted[1]['status'],
        );
        survivingInstallmentId = String(sorted[1]['id']);
      });
    });
  });

  it('multi-rol — ADMIN asigna cobrador y genera planilla para la cuota sobreviviente', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('PUT', `/customers/${customerId}`, { assigned_collector_id: collectorId }, token).then(
        (assignRes) => {
          expect(assignRes.status, 'asignación de cobrador').to.eq(200);
        },
      );

      const today = new Date();
      const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      cy.apiRequest(
        'POST',
        '/collections',
        { collector_id: collectorId, date: todayIso, skip_if_exists: false },
        token,
      ).then((sheetRes) => {
        expect([200, 201], 'generar planilla con la cuota sobreviviente').to.include(sheetRes.status);
        sheetId = String(sheetRes.body?.data?.sheet?.id ?? '');
        expect(sheetId, 'id de planilla generada').to.not.equal('');
      });
    });
  });

  it('multi-rol — COLLECTOR cobra la última cuota desde su ruta', () => {
    cy.viewport(1280, 720);
    expect(sheetId, 'planilla generada en el paso anterior').to.be.a('string').and.not.be.empty;

    cy.loginReal('COLLECTOR', `/collector/route/${sheetId}`);
    cy.location('pathname', { timeout: 15000 }).should('eq', `/collector/route/${sheetId}`);
    cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments/${survivingInstallmentId}`, null, token).then((res) => {
        const amountDue = Number(res.body?.data?.amount_due);

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
          expect(interception.response?.statusCode, 'alta de pre-carga de la última cuota').to.eq(
            201,
          );
        });
      }),
    );
  });

  it('ADMIN aprueba el cobro — el crédito queda SETTLED y el PORTAL refleja saldo en 0', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('GET', `/payments?installment_id=${survivingInstallmentId}&status=PENDING`, null, token)
        .then((paymentsRes) => {
          const rows = (paymentsRes.body?.data ?? []) as Array<Record<string, unknown>>;
          expect(rows, 'pre-carga pendiente del paso anterior').to.have.length.greaterThan(0);
          const paymentId = String(rows[0]['id']);

          cy.apiRequest('PATCH', `/payments/${paymentId}/approve`, null, token).then((approveRes) => {
            expect(approveRes.status, 'aprobación del cobro final').to.eq(200);
          });
        }),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.body?.data?.status, 'crédito liquidado automáticamente').to.eq('SETTLED');
      }),
    );

    cy.viewport(1280, 720);
    cy.visit('/portal/login');
    cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
    cy.get('p-password[formControlName="password"] input').clear().type(portalTempPassword);
    cy.contains('button', 'Iniciar sesión').click();

    cy.location('pathname', { timeout: 15000 }).should((pathname) => {
      expect(['/portal/dashboard', '/portal/change-password']).to.include(pathname);
    });
    cy.location('pathname').then((pathname) => {
      if (!pathname.includes('change-password')) return;

      cy.window()
        .then((win) => {
          const token = win.localStorage.getItem('sgcf_portal_token');
          expect(token, 'token portal tras login temp').to.be.a('string').and.not.be.empty;

          return cy.request({
            method: 'POST',
            url: `${String(Cypress.env('apiBaseUrl'))}/auth/portal/change-password`,
            headers: { Authorization: `Bearer ${token}` },
            body: { current_password: portalTempPassword, new_password: portalPassword },
          });
        })
        .then((changeRes) => {
          expect(changeRes.status, 'cambio de contraseña temporal').to.eq(200);

          cy.clearAllLocalStorage();
          cy.visit('/portal/login');
          cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
          cy.get('p-password[formControlName="password"] input').clear().type(portalPassword);
          cy.contains('button', 'Iniciar sesión').click();
        });
    });

    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/dashboard');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="portal-dashboard-summary-card"]', { timeout: 15000 }).should('be.visible');

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((res) => {
        const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        const pendingBalance = rows.reduce(
          (sum, r) => sum + (Number(r['amount_due']) - Number(r['amount_paid'])),
          0,
        );
        expect(pendingBalance, 'saldo final del crédito en 0').to.eq(0);
      }),
    );
  });
});
