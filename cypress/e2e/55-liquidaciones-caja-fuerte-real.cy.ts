/**
 * SUITE REAL: Liquidaciones × Caja Fuerte Central — escenarios límite (backend real).
 *
 * ⚠️ Corrección de modelo respecto al pedido original:
 * `commissions.service.js#liquidate` imputa SIEMPRE a Caja General
 * (`cash_accounts`, vía `insertMovementWithBalance`) y nunca a la caja operativa
 * de la jornada (`cash_sessions`). No exige `cash_session` activa (no hay chequeo
 * `NO_ACTIVE_SESSION` en esa ruta) — por diseño, sueldos/comisiones/proveedores
 * SOLO salen de Caja General (ver CLAUDE.md backend, sección "Caja — Modelo
 * Operativo V4"). Por eso:
 *   - CASO 1 fondea y verifica Caja General, no el "Saldo Estimado" de la caja
 *     operativa.
 *   - CASO 2 fuerza saldo insuficiente en Caja General (no en la caja operativa).
 *   - CASO 3 documenta el comportamiento real: con la jornada CERRADA (sin
 *     `cash_session`), la liquidación de todos modos sucede en 201 mientras
 *     Caja General tenga fondos — no hay rechazo por falta de caja operativa.
 */

type ApiData<T> = { data: T };

interface CashAccountApi {
  id: string;
  type: string;
  current_balance: number;
}

interface CommissionApi {
  id: string;
  user_id: string;
  amount: number;
  status: string;
}

interface SaleFixture {
  unitId: string;
  installmentsCount: number;
  paymentFrequency: string;
}

const unique = () => Date.now().toString().slice(-8);

function adminToken(): Cypress.Chainable<string> {
  return cy.getAuthToken('ADMIN');
}

function sellerToken(): Cypress.Chainable<string> {
  return cy.getAuthToken('SELLER');
}

/** Devuelve el id del usuario autenticado (vía /auth/me). */
function meId(token: string): Cypress.Chainable<string> {
  return cy.apiRequest('GET', '/auth/me', null, token).then((res) => {
    expect(res.status, 'auth/me').to.eq(200);
    return (res.body as ApiData<{ id: string }>).data.id;
  });
}

/** Resetea la jornada de hoy (borra business_day + cash_sessions de hoy). */
function resetToday(token: string): Cypress.Chainable<unknown> {
  return cy
    .apiRequest('DELETE', '/test/business-days/today', null, token)
    .then((res) => {
      expect(res.status, 'reset jornada').to.eq(200);
      return res;
    });
}

/** Abre una caja operativa para la jornada de hoy. */
function openSession(
  token: string,
  openingAmount: number,
): Cypress.Chainable<string> {
  return cy
    .apiRequest(
      'POST',
      '/cash-sessions',
      { opening_amount: openingAmount },
      token,
    )
    .then((res) => {
      expect(res.status, 'abrir caja').to.eq(201);
      return (res.body as ApiData<{ id: string }>).data.id;
    });
}

/** Busca la cuenta GENERAL_CASH (Caja General / tesorería). */
function getGeneralCashAccount(
  token: string,
): Cypress.Chainable<CashAccountApi> {
  return cy.apiRequest('GET', '/cash-accounts', null, token).then((res) => {
    expect(res.status, 'listar cash-accounts').to.eq(200);
    const accounts = (res.body as ApiData<CashAccountApi[]>).data ?? [];
    const general = accounts.find((a) => a.type === 'GENERAL_CASH');
    expect(general, 'cuenta GENERAL_CASH').to.exist;
    return general as CashAccountApi;
  });
}

/** Ajusta (IN/OUT) el saldo de Caja General vía movimiento de ajuste. */
function adjustGeneralCash(
  token: string,
  accountId: string,
  direction: 'IN' | 'OUT',
  amount: number,
): Cypress.Chainable<Cypress.Response<unknown>> {
  if (amount <= 0)
    return cy.wrap(null) as unknown as Cypress.Chainable<
      Cypress.Response<unknown>
    >;
  return cy.apiRequest(
    'POST',
    `/cash-accounts/${accountId}/movements`,
    {
      movement_type: 'ADJUSTMENT',
      direction,
      amount,
      description: `Ajuste E2E liquidaciones (${direction})`,
    },
    token,
  );
}

/** Vacía Caja General a $0 (para forzar saldo insuficiente). */
function drainGeneralCashToZero(
  token: string,
): Cypress.Chainable<CashAccountApi> {
  return getGeneralCashAccount(token).then((account) => {
    return adjustGeneralCash(
      token,
      account.id,
      'OUT',
      account.current_balance,
    ).then(() => getGeneralCashAccount(token));
  });
}

/** Busca un cliente existente o crea uno de fallback. */
function ensureCustomer(token: string): Cypress.Chainable<string> {
  return cy.apiRequest('GET', '/customers', null, token).then((res) => {
    const data = (res.body as ApiData<unknown>).data;
    const items = Array.isArray(data)
      ? data
      : ((data as { items?: unknown[] })?.items ?? []);
    const existing = items[0] as { id?: string } | undefined;
    if (existing?.id) return existing.id;

    return cy
      .apiRequest(
        'POST',
        '/customers',
        {
          full_name: 'Cliente Liquidaciones E2E',
          dni: `8${unique()}`.slice(0, 8),
          address: 'Calle E2E 456',
          phone: '3815550001',
        },
        token,
      )
      .then((createRes) => {
        expect(createRes.status, 'crear cliente fallback').to.eq(201);
        return (createRes.body as ApiData<{ id: string }>).data.id;
      });
  });
}

/**
 * Busca un producto con stock AVAILABLE y tasa activa configurada, para poder
 * dar de alta una venta (SALE) aprobable sin tocar seeds manualmente.
 */
function pickSaleFixture(token: string): Cypress.Chainable<SaleFixture | null> {
  return cy.apiRequest('GET', '/products', null, token).then((productsRes) => {
    expect(productsRes.status, 'listar productos').to.eq(200);
    type ProductApi = {
      id: string;
      status: string;
      variants: Array<{ id: string; status: string; available_count: number }>;
    };
    const products = (productsRes.body as ApiData<ProductApi[]>).data ?? [];

    const candidate = products.find(
      (p) =>
        p.status === 'ACTIVE' &&
        p.variants?.some((v) => v.status === 'ACTIVE' && v.available_count > 0),
    );
    if (!candidate) return null;

    const variant = candidate.variants.find(
      (v) => v.status === 'ACTIVE' && v.available_count > 0,
    )!;

    return cy
      .apiRequest(
        'GET',
        `/product-rates?product_id=${candidate.id}`,
        null,
        token,
      )
      .then((ratesRes) => {
        expect(ratesRes.status, 'listar tasas de producto').to.eq(200);
        type RateApi = {
          active: boolean;
          installments_count: number;
          payment_frequency: string;
        };
        const rates = (ratesRes.body as ApiData<RateApi[]>).data ?? [];
        const rate = rates.find((r) => r.active);
        if (!rate) return null;

        return cy
          .apiRequest(
            'GET',
            `/product-units?variant_id=${variant.id}&status=AVAILABLE`,
            null,
            token,
          )
          .then((unitsRes) => {
            expect(unitsRes.status, 'listar unidades disponibles').to.eq(200);
            type UnitApi = { id: string };
            const units = (unitsRes.body as ApiData<UnitApi[]>).data ?? [];
            if (!units.length) return null;

            return {
              unitId: units[0].id,
              installmentsCount: rate.installments_count,
              paymentFrequency: rate.payment_frequency,
            };
          });
      });
  });
}

/**
 * Crea una venta (SALE) como SELLER y la aprueba como ADMIN, generando una
 * comisión PENDING para el seller (`credit.created_by`). Sin enganche ni
 * cuotas adelantadas → no requiere caja operativa abierta para aprobarse.
 */
function createApprovedSaleCommission(
  adminTok: string,
  sellerTok: string,
  fixture: SaleFixture,
): Cypress.Chainable<string> {
  return ensureCustomer(adminTok).then((customerId) =>
    cy
      .apiRequest(
        'POST',
        '/credits',
        {
          customer_id: customerId,
          type: 'SALE',
          unit_ids: [fixture.unitId],
          installments_count: fixture.installmentsCount,
          payment_frequency: fixture.paymentFrequency,
        },
        sellerTok,
      )
      .then((createRes) => {
        expect(
          createRes.status,
          `crear venta — ${JSON.stringify(createRes.body)}`,
        ).to.eq(201);
        const creditId = (createRes.body as ApiData<{ id: string }>).data.id;
        return cy
          .apiRequest('PATCH', `/credits/${creditId}/approve`, {}, adminTok)
          .then((approveRes) => {
            expect(approveRes.status, 'aprobar venta').to.eq(200);
            return creditId;
          });
      }),
  );
}

/** Suma el total PENDING de comisiones de un usuario. */
function pendingCommissionsTotal(
  token: string,
  userId: string,
): Cypress.Chainable<number> {
  return cy
    .apiRequest(
      'GET',
      `/commissions?user_id=${userId}&status=PENDING`,
      null,
      token,
    )
    .then((res) => {
      expect(res.status, 'listar comisiones pendientes').to.eq(200);
      const commissions = (res.body as ApiData<CommissionApi[]>).data ?? [];
      return commissions.reduce((sum, c) => sum + Number(c.amount), 0);
    });
}

/** Pone el sueldo fijo del usuario en $0 para que totalNet = solo comisiones. */
function zeroOutSalary(
  adminTok: string,
  userId: string,
): Cypress.Chainable<unknown> {
  return cy.apiRequest(
    'PUT',
    `/commissions/salary/${userId}`,
    { weekly_amount: 0 },
    adminTok,
  );
}

/**
 * Asegura al menos una comisión PENDING > 0 para el seller, creando una venta
 * aprobada si no hay stock/tasa disponible para generar una nueva (en cuyo
 * caso el test que lo invoque debe abortar con skip).
 */
function ensurePendingCommission(
  adminTok: string,
  sellerTok: string,
  sellerUserId: string,
): Cypress.Chainable<number> {
  return pickSaleFixture(adminTok)
    .then((fixture) => {
      if (!fixture) return cy.wrap(null);
      return createApprovedSaleCommission(adminTok, sellerTok, fixture);
    })
    .then(() => pendingCommissionsTotal(adminTok, sellerUserId));
}

describe('Liquidaciones × Caja Fuerte Central — escenarios límite (real)', () => {
  let adminTok = '';
  let sellerTok = '';
  let sellerId = '';

  beforeEach(function () {
    if (!Cypress.env('realAuthEnabled')) this.skip();

    adminToken().then((t) => {
      adminTok = t;
      sellerToken().then((st) => {
        sellerTok = st;
        meId(sellerTok).then((id) => {
          sellerId = id;
          zeroOutSalary(adminTok, sellerId);
        });
      });
    });
  });

  it('CASO 1 — fondos suficientes en Caja General: liquidación EFECTIVO baja el saldo y marca comisiones PAID', () => {
    resetToday(adminTok).then(() => openSession(adminTok, 10000));

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (pendingTotal) => {
        if (pendingTotal <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 1',
          );
          return;
        }

        getGeneralCashAccount(adminTok).then((before) => {
          adjustGeneralCash(adminTok, before.id, 'IN', pendingTotal).then(
            () => {
              cy.apiRequest(
                'POST',
                '/commissions/liquidate',
                { user_id: sellerId, payment_method: 'CASH' },
                adminTok,
              ).then((liquidateRes) => {
                expect(
                  liquidateRes.status,
                  `liquidar — ${JSON.stringify(liquidateRes.body)}`,
                ).to.eq(201);
                const liquidation = (
                  liquidateRes.body as ApiData<{
                    id: string;
                    total_paid: number;
                    cash_session_id: string | null;
                  }>
                ).data;
                expect(Number(liquidation.total_paid)).to.be.closeTo(
                  pendingTotal,
                  0.01,
                );
                // Documenta el modelo real: la liquidación NUNCA se imputa a la
                // caja operativa de la jornada.
                expect(liquidation.cash_session_id).to.be.null;

                getGeneralCashAccount(adminTok).then((after) => {
                  expect(after.current_balance).to.be.closeTo(
                    before.current_balance,
                    0.01,
                  );
                });

                pendingCommissionsTotal(adminTok, sellerId).then(
                  (remaining) => {
                    expect(
                      remaining,
                      'no debe quedar pendiente lo ya liquidado',
                    ).to.eq(0);
                  },
                );
              });
            },
          );
        });
      },
    );
  });

  it('CASO 2 — Caja General sin fondos: liquidación rechaza 409 INSUFFICIENT_BALANCE y revierte (comisiones siguen PENDING)', () => {
    resetToday(adminTok).then(() => openSession(adminTok, 10000));

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (pendingTotal) => {
        if (pendingTotal <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 2',
          );
          return;
        }

        drainGeneralCashToZero(adminTok).then(() => {
          cy.apiRequest(
            'POST',
            '/commissions/liquidate',
            { user_id: sellerId, payment_method: 'CASH' },
            adminTok,
          ).then((liquidateRes) => {
            expect(
              liquidateRes.status,
              JSON.stringify(liquidateRes.body),
            ).to.eq(409);
            expect(liquidateRes.body.message).to.match(/saldo insuficiente/i);

            // La transacción debe revertir por completo: comisiones vuelven a PENDING.
            pendingCommissionsTotal(adminTok, sellerId).then((stillPending) => {
              expect(stillPending).to.be.closeTo(pendingTotal, 0.01);
            });

            getGeneralCashAccount(adminTok).then((account) => {
              expect(account.current_balance).to.eq(0);
            });
          });
        });
      },
    );
  });

  it('CASO 3 — jornada CERRADA (sin caja operativa): la liquidación de todos modos sucede en 201 porque imputa a Caja General, no a la caja operativa', () => {
    // Resetea y NO abre caja: no existe business_day ni cash_session hoy.
    resetToday(adminTok);

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (pendingTotal) => {
        if (pendingTotal <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 3',
          );
          return;
        }

        // Confirma la precondición: no hay caja operativa activa.
        cy.apiRequest('GET', '/cash-sessions/active', null, adminTok).then(
          (activeRes) => {
            const activeSession = (activeRes.body as ApiData<unknown | null>)
              ?.data;
            expect(
              activeSession,
              'no debe haber caja operativa activa',
            ).to.be.oneOf([null, undefined]);
          },
        );

        getGeneralCashAccount(adminTok).then((before) => {
          adjustGeneralCash(adminTok, before.id, 'IN', pendingTotal).then(
            () => {
              cy.apiRequest(
                'POST',
                '/commissions/liquidate',
                { user_id: sellerId, payment_method: 'CASH' },
                adminTok,
              ).then((liquidateRes) => {
                // Comportamiento real documentado: liquidate no valida caja
                // operativa (no hay chequeo NO_ACTIVE_SESSION en esa ruta).
                expect(
                  liquidateRes.status,
                  `liquidar con jornada cerrada — ${JSON.stringify(liquidateRes.body)}`,
                ).to.eq(201);

                pendingCommissionsTotal(adminTok, sellerId).then(
                  (remaining) => {
                    expect(remaining).to.eq(0);
                  },
                );
              });
            },
          );
        });
      },
    );
  });

  it('CASO 4 — liquidación duplicada en el mismo período: 409 (constraint único user_id+week_start+week_end)', () => {
    resetToday(adminTok).then(() => openSession(adminTok, 10000));

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (firstPending) => {
        if (firstPending <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 4',
          );
          return;
        }

        getGeneralCashAccount(adminTok).then((account) => {
          adjustGeneralCash(adminTok, account.id, 'IN', firstPending).then(
            () => {
              cy.apiRequest(
                'POST',
                '/commissions/liquidate',
                { user_id: sellerId, payment_method: 'CASH' },
                adminTok,
              )
                .its('status')
                .should('eq', 201);
            },
          );
        });

        // Segunda comisión, misma semana (se generó "hoy" igual que la primera).
        ensurePendingCommission(adminTok, sellerTok, sellerId).then(
          (secondPending) => {
            if (secondPending <= 0) {
              cy.log('No se pudo generar segunda comisión — saltando CASO 4');
              return;
            }

            getGeneralCashAccount(adminTok).then((account) => {
              adjustGeneralCash(adminTok, account.id, 'IN', secondPending).then(
                () => {
                  cy.apiRequest(
                    'POST',
                    '/commissions/liquidate',
                    { user_id: sellerId, payment_method: 'CASH' },
                    adminTok,
                  ).then((res) => {
                    expect(res.status, JSON.stringify(res.body)).to.eq(409);
                    expect(res.body.message).to.match(/ya fue liquidado/i);
                  });
                },
              );
            });
          },
        );
      },
    );
  });

  it('CASO 5 — rol no liquidable (ADMIN): 409 "Solo se pueden liquidar Vendedores y Cobradores"', () => {
    meId(adminTok).then((adminId) => {
      cy.apiRequest(
        'POST',
        '/commissions/liquidate',
        { user_id: adminId, payment_method: 'CASH' },
        adminTok,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(409);
        expect(res.body.message).to.match(/Vendedores y Cobradores/i);
      });
    });
  });

  it('CASO 6 — usuario inexistente: 404 "Usuario no encontrado o inactivo"', () => {
    cy.apiRequest(
      'POST',
      '/commissions/liquidate',
      {
        user_id: '00000000-0000-4000-8000-000000000000',
        payment_method: 'CASH',
      },
      adminTok,
    ).then((res) => {
      expect(res.status, JSON.stringify(res.body)).to.eq(404);
      expect(res.body.message).to.match(/no encontrado/i);
    });
  });

  it('CASO 7 — total neto $0 (sin comisiones pendientes ni sueldo): 409 "No hay monto positivo a liquidar"', () => {
    const dni = `9${unique()}`.slice(0, 8);
    cy.apiCreateUser({
      full_name: 'Cobrador Sin Comisiones E2E',
      dni,
      email: `liq-e2e-${dni}@test.com`,
      address: 'Calle E2E 789',
      role: 'COLLECTOR',
    }).then((created) => {
      const user = (created as { user: { id: string } }).user;

      cy.apiRequest(
        'POST',
        '/commissions/liquidate',
        { user_id: user.id, payment_method: 'CASH' },
        adminTok,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(409);
        expect(res.body.message).to.match(/no hay monto positivo/i);
      });
    });
  });

  it('CASO 8 — payment_method TRANSFER: liquida igual contra Caja General y persiste el método', () => {
    resetToday(adminTok).then(() => openSession(adminTok, 10000));

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (pendingTotal) => {
        if (pendingTotal <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 8',
          );
          return;
        }

        getGeneralCashAccount(adminTok).then((before) => {
          adjustGeneralCash(adminTok, before.id, 'IN', pendingTotal).then(
            () => {
              cy.apiRequest(
                'POST',
                '/commissions/liquidate',
                {
                  user_id: sellerId,
                  payment_method: 'TRANSFER',
                  transfer_reference: 'LIQ-TRANSFER-E2E',
                },
                adminTok,
              ).then((res) => {
                expect(res.status, JSON.stringify(res.body)).to.eq(201);
                const liquidation = (
                  res.body as ApiData<{ payment_method: string }>
                ).data;
                expect(liquidation.payment_method).to.eq('TRANSFER');

                getGeneralCashAccount(adminTok).then((after) => {
                  expect(after.current_balance).to.be.closeTo(
                    before.current_balance,
                    0.01,
                  );
                });
              });
            },
          );
        });
      },
    );
  });

  it('CASO 9 — sueldo fijo + comisiones: total_paid suma ambos componentes', () => {
    resetToday(adminTok).then(() => openSession(adminTok, 10000));
    const SALARY = 12345;

    cy.apiRequest(
      'PUT',
      `/commissions/salary/${sellerId}`,
      { weekly_amount: SALARY },
      adminTok,
    )
      .its('status')
      .should('eq', 200);

    ensurePendingCommission(adminTok, sellerTok, sellerId).then(
      (pendingTotal) => {
        if (pendingTotal <= 0) {
          cy.log(
            'Sin catálogo vendible (producto+tasa+stock) — saltando CASO 9',
          );
          return;
        }

        const expectedTotal = pendingTotal + SALARY;

        getGeneralCashAccount(adminTok).then((before) => {
          adjustGeneralCash(adminTok, before.id, 'IN', expectedTotal).then(
            () => {
              cy.apiRequest(
                'POST',
                '/commissions/liquidate',
                { user_id: sellerId, payment_method: 'CASH' },
                adminTok,
              ).then((res) => {
                expect(res.status, JSON.stringify(res.body)).to.eq(201);
                const liquidation = (
                  res.body as ApiData<{
                    commissions_total: number;
                    salary_amount: number;
                    total_paid: number;
                  }>
                ).data;
                expect(Number(liquidation.salary_amount)).to.be.closeTo(
                  SALARY,
                  0.01,
                );
                expect(Number(liquidation.total_paid)).to.be.closeTo(
                  expectedTotal,
                  0.01,
                );

                getGeneralCashAccount(adminTok).then((after) => {
                  expect(after.current_balance).to.be.closeTo(
                    before.current_balance - expectedTotal,
                    0.01,
                  );
                });
              });
            },
          );
        });
      },
    );
  });

  it('CASO 10 — payment_method inválido (MIXED no soportado en liquidación): 400 validación', () => {
    cy.apiRequest(
      'POST',
      '/commissions/liquidate',
      { user_id: sellerId, payment_method: 'MIXED' },
      adminTok,
    ).then((res) => {
      expect(res.status, JSON.stringify(res.body)).to.eq(400);
    });
  });

  // CASO NO CUBIERTO — Caja General inactiva (ACCOUNT_INACTIVE, 409): no existe
  // endpoint público para desactivar cash_accounts (cashAccounts.routes.js no
  // expone PATCH .../deactivate). Requeriría tocar la BD directamente, fuera
  // del alcance de un test E2E por API.
});
