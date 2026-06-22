/**
 * SUITE REAL — Enterprise: El Viaje de la Venta (SALE, Multi-Rol, ciclo completo).
 *
 * Hermana de 56-flujo-transversal.cy.ts (LOAN) pero para SALE, con la parte
 * de negocio que LOAN no tiene (comisión) y el resto del ciclo de vida del
 * pago que esa suite no cubre: rechazo de pre-carga, reintento, liquidación
 * total (SETTLED) y reversión de un cobro aprobado.
 *
 * Reglas (mismas que 56):
 * - Backend real (realAuthEnabled=true). Sin intercepts que reemplacen
 *   endpoints de negocio.
 * - Cambio de rol = cy.logout() + cy.loginReal/loginPortalReal (cacheado por
 *   cy.session, ver commands.ts).
 * - El rechazo/aprobación/reversión de cobros y el cobro directo de las
 *   cuotas restantes se hacen por API (ADMIN): son acciones de back-office
 *   que la UI de aprobaciones/payments ya cubre en otras suites (10-, 17-);
 *   acá interesa la cadena de estados real, no repetir esos flujos de UI.
 */

type MeResponse = { id?: string };
type CommissionRow = {
  id: string;
  credit_id: string;
  user_id: string;
  status: string;
  amount: number;
};

function digitsToLetters(stamp: string): string {
  return stamp
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('');
}

function localIsoToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('El Viaje de la Venta — SALE Multi-Rol (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Venta QA ${digitsToLetters(stamp)}`,
    dni: `7${stamp}3`,
    phone: `385${stamp}`,
  };
  const portalPassword = `Portal#${stamp}`;

  let customerId: string;
  let creditId: string;
  let sheetId: string;
  let installments: Array<{ id: string; amount_due: number }>;
  let firstPaymentId: string;
  let secondPaymentId: string;
  let portalTempPassword: string;

  it('paso a — SELLER origina una venta real con producto, variante, unidad y enganche', () => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/clients/new');

    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/seller/clients/new',
    );
    cy.get('input[formControlName="fullName"]', { timeout: 15000 })
      .clear()
      .type(customer.fullName);
    cy.get('input[formControlName="dni"]').clear().type(customer.dni);
    cy.get('input[formControlName="address"]')
      .clear()
      .type(`Av. Venta ${stamp}`);
    cy.get('input[formControlName="phone"]').clear().type(customer.phone);
    cy.intercept('POST', '/api/customers').as('createCustomer');
    cy.contains('button', 'Registrar cliente').click();
    cy.wait('@createCustomer').then((interception) => {
      customerId = String(interception.response?.body?.data?.id ?? '');
      expect(customerId, 'id de cliente creado').to.not.equal('');
    });

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

    cy.contains('Configurar Plan de Pagos', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains('label', 'Enganche').click({ force: true });
    cy.get('p-inputNumber[formControlName="downPayment"] input', {
      timeout: 15000,
    })
      .scrollIntoView()
      .clear()
      .type('5000')
      .blur();
    cy.get('[formControlName="downPaymentMethod"]')
      .first()
      .click({ force: true });
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
      expect(
        interception.response?.body?.data?.type,
        'tipo de operación',
      ).to.eq('SALE');
    });
  });

  it('paso b — ADMIN aprueba la venta: se genera comisión SALE y la planilla del cobrador', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'venta originada en paso a').to.be.a('string').and.not.be
      .empty;

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
        cy.get('button').eq(1).click();
      });
    cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', {
      timeout: 10000,
    }).should('be.visible');
    cy.contains('.p-dialog button', 'Confirmar Aprobación').click();

    cy.wait('@approveCredit').then((interception) => {
      expect(interception.response?.statusCode, 'aprobación de venta').to.eq(
        200,
      );
    });

    // Regla de negocio exclusiva de SALE (no aplica a LOAN, ver CLAUDE.md
    // backend): aprobar genera una comisión PENDING = total_amount × rate,
    // en la misma transacción que activa el crédito.
    cy.getAuthToken('SELLER').then((sellerToken) =>
      cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
        expect(meRes.status, 'auth/me seller').to.eq(200);
        const sellerId = String(
          (meRes.body?.data as MeResponse | undefined)?.id ?? '',
        );
        expect(sellerId, 'id real del seller').to.not.equal('');

        cy.apiRequest(
          'GET',
          `/commissions?status=PENDING&user_id=${sellerId}`,
          null,
          sellerToken,
        ).then((commRes) => {
          expect(commRes.status, 'comisiones pendientes del seller').to.eq(200);
          const rows = (commRes.body?.data ?? []) as CommissionRow[];
          const mine = rows.find((r) => r.credit_id === creditId);
          expect(mine, 'comisión generada para esta venta').to.exist;
          expect(
            Number(mine?.amount),
            'monto de comisión > 0',
          ).to.be.greaterThan(0);
        });
      }),
    );

    cy.getAuthToken('ADMIN').then((adminToken) => {
      cy.getAuthToken('COLLECTOR').then((collectorToken) =>
        cy.apiRequest('GET', '/auth/me', null, collectorToken).then((meRes) => {
          const collectorId = String(
            (meRes.body?.data as MeResponse | undefined)?.id ?? '',
          );
          expect(collectorId, 'id real del cobrador').to.not.equal('');

          cy.apiRequest(
            'PUT',
            `/customers/${customerId}`,
            { assigned_collector_id: collectorId },
            adminToken,
          ).then((assignRes) => {
            expect(assignRes.status, 'asignar cobrador al cliente').to.eq(200);
          });

          cy.apiRequest(
            'POST',
            '/collections',
            {
              collector_id: collectorId,
              date: localIsoToday(),
              filter: 'ALL_PENDING',
              skip_if_exists: false,
            },
            adminToken,
          ).then((sheetRes) => {
            expect([200, 201], 'generar planilla del cobrador').to.include(
              sheetRes.status,
            );
            sheetId = String(sheetRes.body?.data?.sheet?.id ?? '');
            expect(sheetId, 'id de planilla generada').to.not.equal('');
          });
        }),
      );

      cy.apiRequest(
        'GET',
        `/installments?credit_id=${creditId}`,
        null,
        adminToken,
      ).then((instRes) => {
        expect(instRes.status, 'cuotas de la venta aprobada').to.eq(200);
        const rows = (instRes.body?.data ?? []) as Array<
          Record<string, unknown>
        >;
        expect(rows, 'al menos una cuota generada').to.have.length.greaterThan(
          0,
        );
        installments = rows.map((r) => ({
          id: String(r['id']),
          amount_due: Number(r['amount_due']),
        }));
      });
    });
  });

  it('paso c — COLLECTOR cobra parcial, ADMIN rechaza, COLLECTOR reintenta completo, ADMIN aprueba', () => {
    cy.viewport(1280, 720);
    expect(sheetId, 'planilla generada en paso b').to.be.a('string').and.not.be
      .empty;
    expect(
      installments,
      'cuotas obtenidas en paso b',
    ).to.have.length.greaterThan(0);

    const firstInstallmentAmount = installments[0].amount_due;
    const partialAmount = Math.floor(firstInstallmentAmount / 2);

    cy.logout();
    cy.loginReal('COLLECTOR', `/collector/route/${sheetId}`);
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      `/collector/route/${sheetId}`,
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
      .type(String(partialAmount))
      .blur();
    // Cobro parcial: la app exige fecha de próxima visita.
    cy.get('.p-dialog p-calendar input').first().type(localIsoToday());
    cy.contains('.p-dialog button', 'Confirmar')
      .should('not.be.disabled')
      .click();

    cy.wait('@createPayment').then((interception) => {
      firstPaymentId = String(interception.response?.body?.data?.id ?? '');
      expect(firstPaymentId, 'id de pre-carga parcial').to.not.equal('');
      expect(
        interception.response?.statusCode,
        'alta de pre-carga parcial',
      ).to.eq(201);
    });

    cy.logout();
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy
        .apiRequest(
          'PATCH',
          `/payments/${firstPaymentId}/reject`,
          {
            rejection_reason:
              'Rechazo de control QA — reintento con monto completo.',
          },
          adminToken,
        )
        .then((res) => {
          expect(res.status, 'rechazo de pre-carga (control negativo)').to.eq(
            200,
          );
        }),
    );

    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy
        .apiRequest(
          'GET',
          `/installments/${installments[0].id}`,
          null,
          adminToken,
        )
        .then((res) => {
          expect(res.status, 'cuota tras rechazo').to.eq(200);
          expect(
            Number(res.body?.data?.amount_paid),
            'rechazo no movió saldo',
          ).to.eq(0);
        }),
    );

    // Regla documentada en collections.queries.js: una pre-carga rechazada
    // libera la cuota — vuelve a aparecer en la planilla para re-cobrarla.
    cy.loginReal('COLLECTOR', `/collector/route/${sheetId}`);
    cy.intercept('POST', '/api/payments').as('createPaymentRetry');
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
      .type(String(firstInstallmentAmount))
      .blur();
    cy.contains('.p-dialog button', 'Confirmar')
      .should('not.be.disabled')
      .click();

    cy.wait('@createPaymentRetry').then((interception) => {
      secondPaymentId = String(interception.response?.body?.data?.id ?? '');
      expect(secondPaymentId, 'id de pre-carga completa').to.not.equal('');
      expect(
        interception.response?.statusCode,
        'alta de pre-carga completa',
      ).to.eq(201);
    });

    cy.logout();
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy
        .apiRequest(
          'PATCH',
          `/payments/${secondPaymentId}/approve`,
          null,
          adminToken,
        )
        .then((res) => {
          expect(res.status, 'aprobación de la pre-carga completa').to.eq(200);
        }),
    );
  });

  it('paso d — ADMIN liquida las cuotas restantes (cobro directo) y la venta queda SETTLED', () => {
    expect(
      installments,
      'cuotas obtenidas en paso b',
    ).to.have.length.greaterThan(0);

    cy.getAuthToken('ADMIN').then((adminToken) => {
      const remaining = installments.slice(1);
      remaining.forEach((inst) => {
        cy.apiRequest(
          'POST',
          '/payments/admin-direct',
          {
            installment_id: inst.id,
            amount_received: inst.amount_due,
            payment_method: 'CASH',
          },
          adminToken,
        ).then((res) => {
          expect(res.status, `cobro directo de cuota ${inst.id}`).to.eq(201);
        });
      });

      cy.apiRequest('GET', `/credits/${creditId}`, null, adminToken).then(
        (res) => {
          expect(res.status, 'estado final de la venta').to.eq(200);
          expect(
            res.body?.data?.status,
            'venta liquidada automáticamente',
          ).to.eq('SETTLED');
          expect(res.body?.data?.settled_at, 'settled_at seteado').to.not.equal(
            null,
          );
        },
      );
    });
  });

  it('paso e — PORTAL ve la venta liquidada y ADMIN revierte el último cobro', () => {
    cy.viewport(1280, 720);
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy
        .apiRequest(
          'PATCH',
          `/customers/${customerId}/enable-portal`,
          null,
          adminToken,
        )
        .then((res) => {
          expect(res.status, 'habilitar portal del cliente').to.eq(200);
          portalTempPassword = String(res.body?.data?.tempPassword ?? '');
          expect(portalTempPassword, 'temp password de portal').to.not.equal(
            '',
          );
        }),
    );

    cy.then(() => {
      cy.visit('/portal/login');
      cy.get('input[formControlName="dni"]', { timeout: 15000 })
        .clear()
        .type(customer.dni);
      cy.get('p-password[formControlName="password"] input')
        .clear()
        .type(portalTempPassword);
      cy.contains('button', 'Iniciar sesión').click();

      cy.location('pathname', { timeout: 15000 }).should((pathname) => {
        expect(['/portal/dashboard', '/portal/change-password']).to.include(
          pathname,
        );
      });
      cy.location('pathname').then((pathname) => {
        if (!pathname.includes('change-password')) return;

        cy.window()
          .then((win) => {
            const token = win.localStorage.getItem('sgcf_portal_token');
            return cy.request({
              method: 'POST',
              url: `${String(Cypress.env('apiBaseUrl'))}/auth/portal/change-password`,
              headers: { Authorization: `Bearer ${token}` },
              body: {
                current_password: portalTempPassword,
                new_password: portalPassword,
              },
            });
          })
          .then((changeRes) => {
            expect(changeRes.status, 'cambio de contraseña temporal').to.eq(
              200,
            );
            cy.clearAllLocalStorage();
            cy.visit('/portal/login');
            cy.get('input[formControlName="dni"]', { timeout: 15000 })
              .clear()
              .type(customer.dni);
            cy.get('p-password[formControlName="password"] input')
              .clear()
              .type(portalPassword);
            cy.contains('button', 'Iniciar sesión').click();
          });
      });

      cy.location('pathname', { timeout: 15000 }).should(
        'eq',
        '/portal/dashboard',
      );
      cy.get('app-error-state').should('not.exist');
      cy.visit('/portal/credits');
      cy.get('app-error-state').should('not.exist');
    });

    // Reversión real (Admin) del último cobro aprobado: la venta deja de
    // estar saldada y la cuota vuelve a tener saldo pendiente.
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy
        .apiRequest(
          'POST',
          `/payments/${secondPaymentId}/reverse`,
          {
            reason: 'Reversión de control QA — verificación de ciclo completo.',
          },
          adminToken,
        )
        .then((res) => {
          expect(res.status, 'reversión del cobro aprobado').to.eq(200);

          cy.apiRequest('GET', `/credits/${creditId}`, null, adminToken).then(
            (creditRes) => {
              expect(
                creditRes.status,
                'estado de la venta tras reversión',
              ).to.eq(200);
              expect(
                creditRes.body?.data?.status,
                'venta vuelve a ACTIVE',
              ).to.eq('ACTIVE');
            },
          );

          cy.apiRequest(
            'GET',
            `/installments/${installments[0].id}`,
            null,
            adminToken,
          ).then((instRes) => {
            expect(instRes.status, 'cuota tras reversión').to.eq(200);
            expect(
              Number(instRes.body?.data?.amount_paid),
              'saldo revertido',
            ).to.eq(0);
          });
        }),
    );
  });
});
