/**
 * SUITE REAL: ingresos de dinero mixtos contra backend E2E.
 *
 * Cubre contratos API de split efectivo/transferencia sin depender de flujos UI
 * largos. Cada test resetea la jornada de hoy, abre caja operativa y crea su
 * propio préstamo activo para no compartir cuotas entre casos.
 */

type ApiData<T> = { data: T };

type CreditDetailApi = {
  id: string;
  installments: Array<{
    id: string;
    amount_due: number;
    amount_paid: number;
    penalty_amount: number;
    status: string;
  }>;
};

const unique = () => Date.now().toString().slice(-8);

/** Devuelve el token ADMIN real cacheado por Cypress. */
function adminToken(): Cypress.Chainable<string> {
  return cy.getAuthToken('ADMIN');
}

/**
 * Resetea la jornada y abre una caja operativa limpia para aprobar ingresos.
 * opening_amount alto a propósito: createActiveLoan desembolsa el préstamo
 * (total_amount) desde esta misma caja al aprobar — debe cubrirlo de sobra.
 */
function resetAndOpenSession(token: string): Cypress.Chainable<string> {
  return cy
    .apiRequest('DELETE', '/test/business-days/today', null, token)
    .then((resetRes) => {
      expect(resetRes.status, 'reset jornada').to.eq(200);
      return cy.apiRequest(
        'POST',
        '/cash-sessions',
        { opening_amount: 1000000 },
        token,
      );
    })
    .then((openRes) => {
      expect(openRes.status, 'abrir caja').to.eq(201);
      return (openRes.body as ApiData<{ id: string }>).data.id;
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
          full_name: 'Cliente Mixto E2E',
          dni: `7${unique()}`.slice(0, 8),
          address: 'Calle E2E 123',
          phone: '3815550000',
        },
        token,
      )
      .then((createRes) => {
        expect(createRes.status, 'crear cliente fallback').to.eq(201);
        return (createRes.body as ApiData<{ id: string }>).data.id;
      });
  });
}

/** Crea y aprueba un préstamo chico con tasa seeded estable. */
function createActiveLoan(token: string): Cypress.Chainable<CreditDetailApi> {
  return ensureCustomer(token)
    .then((customerId) =>
      cy.apiRequest(
        'POST',
        '/credits',
        {
          customer_id: customerId,
          type: 'LOAN',
          total_amount: 30000,
          installments_count: 3,
          payment_frequency: 'MONTHLY',
        },
        token,
      ),
    )
    .then((createRes) => {
      expect(createRes.status, 'crear préstamo').to.eq(201);
      const creditId = (createRes.body as ApiData<{ id: string }>).data.id;
      return cy.apiRequest('PATCH', `/credits/${creditId}/approve`, {}, token);
    })
    .then((approveRes) => {
      expect(approveRes.status, 'aprobar préstamo').to.eq(200);
      return (approveRes.body as ApiData<CreditDetailApi>).data;
    });
}

/** Calcula el saldo abierto de una cuota. */
function installmentBalance(
  i: CreditDetailApi['installments'][number],
): number {
  return (
    Number(i.amount_due) + Number(i.penalty_amount) - Number(i.amount_paid)
  );
}

describe('Ingresos mixtos reales — API backend', () => {
  let token = '';
  let sessionId = '';

  beforeEach(() => {
    adminToken().then((t) => {
      token = t;
      resetAndOpenSession(token).then((id) => {
        sessionId = id;
      });
    });
  });

  it('registra pre-carga de cobro mixto y persiste el split', () => {
    createActiveLoan(token).then((credit) => {
      const installment = credit.installments[0];
      const balance = installmentBalance(installment);
      const cash = Math.floor(balance / 2);
      const transfer = balance - cash;

      cy.apiRequest(
        'POST',
        '/payments',
        {
          installment_id: installment.id,
          amount_cash: cash,
          amount_transfer: transfer,
          transfer_reference: 'PAY-MIX-E2E',
        },
        token,
      ).then((createPaymentRes) => {
        expect(createPaymentRes.status, 'crear pre-carga mixta').to.eq(201);
        const payment = (createPaymentRes.body as ApiData<{ id: string }>).data;

        cy.apiRequest('GET', `/payments/${payment.id}`, null, token).then(
          (detailRes) => {
            expect(detailRes.status, 'detalle pre-carga').to.eq(200);
            expect(
              (detailRes.body as ApiData<Record<string, unknown>>).data,
            ).to.include({
              amount_cash: cash,
              amount_transfer: transfer,
              payment_method: 'MIXED',
              status: 'PENDING',
            });
          },
        );

        cy.apiRequest(
          'PATCH',
          `/payments/${payment.id}/reject`,
          { rejection_reason: 'Limpieza E2E' },
          token,
        )
          .its('status')
          .should('eq', 200);
      });
    });
  });

  it('aprueba cobro directo mixto desde admin', () => {
    createActiveLoan(token).then((credit) => {
      cy.apiRequest(
        'POST',
        '/payments/admin-direct',
        {
          installment_id: credit.installments[0].id,
          amount_cash: 500,
          amount_transfer: 700,
          transfer_reference: 'ADM-MIX-E2E',
        },
        token,
      ).then((res) => {
        expect(res.status, 'cobro directo mixto').to.eq(201);
        expect((res.body as ApiData<Record<string, unknown>>).data).to.include({
          amount_cash: 500,
          amount_transfer: 700,
          payment_method: 'MIXED',
          status: 'APPROVED',
        });
      });
    });
  });

  it('paga anticipadamente una cuota con split mixto exacto', () => {
    createActiveLoan(token).then((credit) => {
      const installment = credit.installments[0];
      const balance = installmentBalance(installment);
      const cash = Math.floor(balance / 2);
      const transfer = balance - cash;

      cy.apiRequest(
        'PATCH',
        `/installments/${installment.id}/early-pay`,
        {
          amount_cash: cash,
          amount_transfer: transfer,
          transfer_reference: 'EARLY-MIX-E2E',
        },
        token,
      ).then((res) => {
        expect(res.status, 'early-pay mixto').to.eq(200);
        expect((res.body as ApiData<Record<string, unknown>>).data).to.include({
          status: 'PAID',
        });
      });
    });
  });

  it('cancela anticipadamente un crédito con split mixto total', () => {
    createActiveLoan(token).then((credit) => {
      const total = credit.installments.reduce(
        (sum, installment) => sum + installmentBalance(installment),
        0,
      );
      const cash = Math.floor(total / 2);
      const transfer = total - cash;

      cy.apiRequest(
        'PATCH',
        `/credits/${credit.id}/early-settlement`,
        {
          amount_cash: cash,
          amount_transfer: transfer,
          transfer_reference: 'SET-MIX-E2E',
        },
        token,
      ).then((res) => {
        expect(res.status, 'cancelación anticipada mixta').to.eq(200);
        const data = (res.body as ApiData<Record<string, unknown>>).data;
        expect(data['credit_id']).to.eq(credit.id);
        expect(Number(data['settlement_amount'])).to.eq(total);
        expect(data['payment_method']).to.eq('MIXED');
      });
    });
  });

  it('registra ingreso manual mixto en caja operativa real', () => {
    cy.apiRequest(
      'POST',
      `/cash-sessions/${sessionId}/manual-incomes`,
      {
        amount: 9000,
        amount_cash: 3500,
        amount_transfer: 5500,
        description: 'Ingreso manual mixto API E2E',
        receipt_reference: 'INC-MIX-E2E',
      },
      token,
    ).then((res) => {
      expect(res.status, 'ingreso manual mixto').to.eq(201);
      expect((res.body as ApiData<Record<string, unknown>>).data).to.include({
        amount: 9000,
        amount_cash: 3500,
        amount_transfer: 5500,
        payment_method: 'MIXED',
      });
    });
  });

  it('registra ajuste IN mixto en Caja General', () => {
    cy.apiRequest('GET', '/cash-accounts', null, token).then((accountsRes) => {
      expect(accountsRes.status, 'listar cajas generales').to.eq(200);
      const accounts = (accountsRes.body as ApiData<Array<{ id: string }>>)
        .data;
      expect(accounts, 'cuentas de caja general').to.be.an('array').and.not.be
        .empty;

      cy.apiRequest(
        'POST',
        `/cash-accounts/${accounts[0].id}/movements`,
        {
          movement_type: 'ADJUSTMENT',
          direction: 'IN',
          amount: 11000,
          amount_cash: 4500,
          amount_transfer: 6500,
          description: 'Ajuste mixto API E2E',
        },
        token,
      ).then((res) => {
        expect(res.status, 'ajuste caja general mixto').to.eq(201);
        const data = (
          res.body as ApiData<{
            movement: Record<string, unknown>;
          }>
        ).data;
        expect(data.movement).to.include({
          amount: 11000,
          amount_cash: 4500,
          amount_transfer: 6500,
          direction: 'IN',
          movement_type: 'ADJUSTMENT',
        });
      });
    });
  });
});
