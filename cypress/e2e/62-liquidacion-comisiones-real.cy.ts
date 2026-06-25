/**
 * SUITE REAL — Enterprise: Liquidación semanal de comisiones.
 *
 * Cierra el loop que 58-flujo-transversal-sale.cy.ts deja abierto: ahí la
 * comisión SALE queda PENDING y nunca se paga. Cubre POST
 * /commissions/liquidate — la comisión se paga vía Caja General (tesorería),
 * no requiere caja diaria abierta (ver commissions.service.js, Fase 3).
 *
 * La comisión se imputa a `credit.created_by` (ver credits.service.js,
 * aprobación SALE) — por eso la venta tiene que originarse con el token del
 * SELLER real, no con el de ADMIN, aunque apruebe ADMIN.
 */

type MeResponse = { id?: string; full_name?: string };

function digitsToLetters(stamp: string): string {
  return stamp
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('');
}

describe('Liquidación semanal de comisiones (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Liquid QA ${digitsToLetters(stamp)}`,
    dni: `3${stamp}7`,
    phone: `389${stamp}`,
  };

  let sellerFullName: string;
  let creditId: string;

  it('setup — SELLER origina venta real y ADMIN la aprueba (comisión PENDING real)', () => {
    cy.viewport(1280, 720);
    cy.getAuthToken('SELLER').then((sellerToken) =>
      cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
        expect(meRes.status, 'auth/me seller').to.eq(200);
        sellerFullName = String((meRes.body?.data as MeResponse | undefined)?.full_name ?? '');
        expect(sellerFullName, 'nombre real del seller').to.not.equal('');
      }),
    );

    cy.then(() => {
      cy.loginReal('SELLER', '/seller/clients/new');
      cy.get('input[formControlName="fullName"]', { timeout: 15000 }).clear().type(customer.fullName);
      cy.get('input[formControlName="dni"]').clear().type(customer.dni);
      cy.get('input[formControlName="address"]').clear().type(`Calle Liquid ${stamp}`);
      cy.get('input[formControlName="phone"]').clear().type(customer.phone);
      cy.contains('button', 'Registrar cliente').click();
      cy.contains('.p-toast-message', 'Cliente registrado correctamente.', { timeout: 15000 }).should(
        'be.visible',
      );

      cy.intercept('POST', '/api/credits').as('createCredit');
      cy.visit('/seller/operations/new');
      cy.get('[data-cy="btn-type-sale"]', { timeout: 20000 }).should('be.visible').click();

      cy.get('[data-cy="input-search-client"]', { timeout: 15000 }).clear().type(customer.dni);
      cy.contains('[data-cy^="client-card-"]', customer.fullName, { timeout: 15000 }).click();
      cy.contains('button', 'Continuar con este cliente', { timeout: 15000 }).should('be.enabled').click();

      cy.contains('h3', 'Catálogo', { timeout: 20000 }).should('be.visible');
      cy.get('[data-cy^="sale-product-"]', { timeout: 20000 }).first().click({ force: true });
      cy.get('[data-cy^="sale-variant-"]', { timeout: 15000 }).first().click({ force: true });
      cy.get('[data-cy="sale-add-unit"]', { timeout: 20000 }).first().click({ force: true });
      cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 }).should('not.be.disabled').click();

      cy.contains('Configurar Plan de Pagos', { timeout: 15000 }).should('be.visible');
      cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

      cy.contains('Declaraciones y Autorizaciones', { timeout: 15000 }).scrollIntoView().should('be.visible');
      cy.get('[data-cy="btn-mark-all"]').click({ force: true });
      cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click();

      cy.wait('@createCredit').then((interception) => {
        creditId = String(interception.response?.body?.data?.id ?? '');
        expect(creditId, 'id de venta originada por SELLER').to.not.equal('');
        expect(interception.response?.statusCode).to.eq(201);
      });
    });

    cy.then(() => {
      cy.logout();
      cy.loginReal('ADMIN', '/admin/approvals');
      cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should('be.visible');

      cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as('approveCredit');
      cy.contains('p-table tbody tr', customer.dni, { timeout: 20000 })
        .should('be.visible')
        .within(() => {
          cy.get('button').eq(1).click();
        });
      cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', { timeout: 10000 }).should('be.visible');
      cy.contains('.p-dialog button', 'Confirmar Aprobación').click();

      cy.wait('@approveCredit').then((interception) => {
        expect(interception.response?.statusCode, 'aprobación de venta').to.eq(200);
      });
    });

    cy.then(() => {
      cy.getAuthToken('SELLER').then((sellerToken) =>
        cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
          const sellerId = String((meRes.body?.data as MeResponse | undefined)?.id ?? '');
          cy.apiRequest('GET', `/commissions?status=PENDING&user_id=${sellerId}`, null, sellerToken).then(
            (commRes) => {
              const rows = (commRes.body?.data ?? []) as Array<Record<string, unknown>>;
              const mine = rows.find((r) => r['credit_id'] === creditId);
              expect(mine, 'comisión PENDING real generada para el seller').to.exist;
              expect(Number(mine?.['amount']), 'monto de comisión > 0').to.be.greaterThan(0);
            },
          );
        }),
      );
    });
  });

  it('ADMIN liquida al seller por UI: Caja General recibe el movimiento y la comisión queda PAID', () => {
    cy.viewport(1280, 720);
    expect(sellerFullName, 'nombre real del seller (setup)').to.be.a('string').and.not.be.empty;

    let generalCashId = '';
    let generalCashBalanceBefore = 0;
    let sellerId = '';
    cy.getAuthToken('SELLER').then((sellerToken) =>
      cy.apiRequest('GET', '/auth/me', null, sellerToken).then((meRes) => {
        sellerId = String((meRes.body?.data as MeResponse | undefined)?.id ?? '');
      }),
    );

    // Constraint único "una liquidación por usuario por semana" — si este
    // seller real ya fue liquidado en una corrida previa de esta misma
    // suite (misma semana calendario), hay que liberar el período antes de
    // reintentar (ver test.service.js resetCommissionLiquidations).
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', `/test/commission-liquidations/${sellerId}`, null, token).then((res) => {
        expect(res.status, 'limpieza de liquidaciones previas del seller').to.eq(200);
      }),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', '/cash-accounts', null, token).then((res) => {
        expect(res.status, 'caja general antes de liquidar').to.eq(200);
        const accounts = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        const general = accounts.find((a) => a['type'] === 'GENERAL_CASH') ?? accounts[0];
        generalCashId = String(general?.['id']);

        // Tesorería puede no tener fondos suficientes acumulados (depende de
        // corridas previas de otras suites) — la liquidación SIEMPRE descuenta
        // de Caja General sin importar el método de pago elegido (es la regla
        // real: ver commissions.service.js, insertMovementWithBalance). Se
        // inyecta un ingreso manual grande para no depender de ese estado.
        cy.apiRequest(
          'POST',
          `/cash-accounts/${generalCashId}/movements`,
          {
            movement_type: 'MANUAL_INCOME',
            amount: 5000000,
            description: 'Fondeo de tesorería — control QA liquidación de comisiones.',
          },
          token,
        ).then((topUpRes) => {
          expect(topUpRes.status, 'fondeo manual de Caja General').to.eq(201);
        });

        cy.apiRequest('GET', `/cash-accounts/${generalCashId}`, null, token).then((afterTopUp) => {
          generalCashBalanceBefore = Number(afterTopUp.body?.data?.current_balance ?? 0);
        });
      }),
    );

    cy.loginReal('ADMIN', '/admin/commissions');
    cy.contains('p-table tbody tr', sellerFullName, { timeout: 20000 })
      .should('be.visible')
      .within(() => {
        cy.contains('button', 'Liquidar').should('not.be.disabled').click();
      });

    cy.contains('.p-dialog', 'Liquidar empleado', { timeout: 10000 }).should('be.visible');
    cy.contains('.p-dialog', 'Total a pagar').should('be.visible');
    cy.contains('.p-dialog button', 'Confirmar liquidación').click();

    cy.contains('.p-dialog', '¿Confirmar liquidación?', { timeout: 10000 }).should('be.visible');
    cy.intercept('POST', '/api/commissions/liquidate').as('liquidate');
    cy.contains('.p-dialog button', 'Sí, liquidar').click();

    cy.wait('@liquidate').then((interception) => {
      expect(interception.response?.statusCode, 'liquidación de comisiones').to.eq(201);
    });

    cy.getAuthToken('SELLER').then((sellerToken) =>
      cy.apiRequest('GET', `/commissions?status=PAID`, null, sellerToken).then((res) => {
        const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        const mine = rows.find((r) => r['credit_id'] === creditId);
        expect(mine?.['status'], 'comisión queda PAID').to.eq('PAID');
      }),
    );

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', '/cash-accounts', null, token).then((res) => {
        const accounts = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        const general = accounts.find((a) => a['type'] === 'GENERAL_CASH') ?? accounts[0];
        const balanceAfter = Number(general?.['current_balance'] ?? 0);
        expect(balanceAfter, 'Caja General bajó por el pago de comisión').to.be.lessThan(
          generalCashBalanceBefore,
        );
      }),
    );
  });
});
