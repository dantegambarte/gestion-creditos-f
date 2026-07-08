/**
 * SUITE REAL: egreso del préstamo (LOAN) en caja — backend real, sin mocks.
 *
 * Antes de este cambio, aprobar un LOAN generaba cuotas pero no descontaba
 * nada de ninguna caja. Cubre:
 *   - aprobar sin caja abierta → 409 NO_ACTIVE_SESSION.
 *   - aprobar con caja abierta pero efectivo insuficiente → 409 INSUFFICIENT_CASH.
 *   - aprobar con efectivo suficiente → 200 y el snapshot de la caja refleja
 *     el egreso (outflows.loans).
 */

type ApiData<T> = { data: T };

interface CashSessionSnapshotApi {
  outflows: {
    loans: { cash: number; transfer: number };
  };
  expected: { cash: number; transfer: number };
}

const unique = () => Date.now().toString().slice(-8);

function adminToken(): Cypress.Chainable<string> {
  return cy.getAuthToken('ADMIN');
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

/** Busca un cliente existente o crea uno si la seed no dejó clientes activos. */
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
          full_name: 'Cliente Préstamo E2E',
          dni: `6${unique()}`.slice(0, 8),
          address: 'Calle E2E 789',
          phone: '3815550002',
        },
        token,
      )
      .then((createRes) => {
        expect(createRes.status, 'crear cliente fallback').to.eq(201);
        return (createRes.body as ApiData<{ id: string }>).data.id;
      });
  });
}

/** Crea un préstamo PENDING_APPROVAL sin aprobar. */
function createPendingLoan(
  token: string,
  totalAmount: number,
): Cypress.Chainable<string> {
  return ensureCustomer(token).then((customerId) =>
    cy
      .apiRequest(
        'POST',
        '/credits',
        {
          customer_id: customerId,
          type: 'LOAN',
          total_amount: totalAmount,
          installments_count: 3,
          payment_frequency: 'MONTHLY',
        },
        token,
      )
      .then((res) => {
        expect(res.status, 'crear préstamo').to.eq(201);
        return (res.body as ApiData<{ id: string }>).data.id;
      }),
  );
}

describe('Caja — egreso del préstamo (LOAN) real', () => {
  let token = '';

  beforeEach(() => {
    adminToken().then((t) => {
      token = t;
      resetToday(token);
    });
  });

  it('rechaza la aprobación sin caja operativa abierta', () => {
    createPendingLoan(token, 40000).then((creditId) => {
      cy.apiRequest('PATCH', `/credits/${creditId}/approve`, {}, token).then(
        (res) => {
          expect(res.status, 'aprobar sin caja').to.eq(409);
          expect((res.body as { code?: string }).code).to.eq(
            'NO_ACTIVE_SESSION',
          );
        },
      );
    });
  });

  it('rechaza la aprobación si el préstamo supera el efectivo disponible', () => {
    cy.apiRequest('POST', '/cash-sessions', { opening_amount: 10000 }, token).then(
      (openRes) => {
        expect(openRes.status, 'abrir caja').to.eq(201);

        createPendingLoan(token, 40000).then((creditId) => {
          cy.apiRequest(
            'PATCH',
            `/credits/${creditId}/approve`,
            {},
            token,
          ).then((res) => {
            expect(res.status, 'aprobar sin efectivo suficiente').to.eq(409);
            expect((res.body as { code?: string }).code).to.eq(
              'INSUFFICIENT_CASH',
            );
          });
        });
      },
    );
  });

  it('aprueba y descuenta el egreso de la caja activa', () => {
    cy.apiRequest(
      'POST',
      '/cash-sessions',
      { opening_amount: 100000 },
      token,
    ).then((openRes) => {
      expect(openRes.status, 'abrir caja').to.eq(201);
      const sessionId = (openRes.body as ApiData<{ id: string }>).data.id;

      createPendingLoan(token, 40000).then((creditId) => {
        cy.apiRequest('PATCH', `/credits/${creditId}/approve`, {}, token).then(
          (approveRes) => {
            expect(approveRes.status, 'aprobar préstamo').to.eq(200);

            cy.apiRequest(
              'GET',
              `/cash-sessions/${sessionId}/snapshot`,
              null,
              token,
            ).then((snapRes) => {
              expect(snapRes.status, 'snapshot de caja').to.eq(200);
              const snapshot = (snapRes.body as ApiData<CashSessionSnapshotApi>)
                .data;
              expect(snapshot.outflows.loans.cash).to.eq(40000);
              expect(snapshot.expected.cash).to.eq(60000);
            });
          },
        );
      });
    });
  });
});
