/**
 * SUITE REAL: origen del gasto (`source`: DAILY/COMPANY) contra backend E2E.
 *
 * Cubre los casos nuevos introducidos por la columna `expenses.source`:
 *   - DAILY (default): imputa a la caja activa, validado contra el efectivo disponible.
 *   - COMPANY: sale de Caja General (cash_accounts), validado contra current_balance.
 *
 * Cada test resetea la jornada de hoy y abre una caja operativa con
 * `opening_amount` conocido para que el efectivo disponible sea determinístico.
 */

type ApiData<T> = { data: T };

interface ExpenseApi {
  id: string;
  source: string;
  cash_session_id: string | null;
}

interface CashAccountApi {
  id: string;
  type: string;
  current_balance: number;
}

/** YYYY-MM-DD de hoy (hora local Buenos Aires). */
function today(): string {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Devuelve el token ADMIN real cacheado por Cypress. */
function adminToken(): Cypress.Chainable<string> {
  return cy.getAuthToken('ADMIN');
}

/** Resetea la jornada de hoy y abre una caja operativa con opening_amount conocido. */
function resetAndOpenSession(
  token: string,
  openingAmount: number,
): Cypress.Chainable<string> {
  return cy
    .apiRequest('DELETE', '/test/business-days/today', null, token)
    .then((resetRes) => {
      expect(resetRes.status, 'reset jornada').to.eq(200);
      return cy.apiRequest(
        'POST',
        '/cash-sessions',
        { opening_amount: openingAmount },
        token,
      );
    })
    .then((openRes) => {
      expect(openRes.status, 'abrir caja').to.eq(201);
      return (openRes.body as ApiData<{ id: string }>).data.id;
    });
}

/** Busca una categoría de gasto activa (requerida por el validador). */
function getExpenseCategoryId(token: string): Cypress.Chainable<string> {
  return cy
    .apiRequest('GET', '/expense-categories', null, token)
    .then((res) => {
      expect(res.status, 'listar categorías de gasto').to.eq(200);
      const categories = (res.body as ApiData<{ id: string }[]>).data ?? [];
      expect(categories.length, 'categorías de gasto seeded').to.be.greaterThan(
        0,
      );
      return categories[0].id;
    });
}

/** Busca la cuenta GENERAL_CASH (Caja General). */
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

describe('Expenses source (DAILY/COMPANY) — real backend', () => {
  const OPENING_AMOUNT = 10000;
  let token = '';
  let sessionId = '';
  let categoryId = '';

  beforeEach(function () {
    if (!Cypress.env('realAuthEnabled')) this.skip();

    adminToken().then((t) => {
      token = t;
      resetAndOpenSession(token, OPENING_AMOUNT).then((id) => {
        sessionId = id;
      });
      getExpenseCategoryId(token).then((id) => {
        categoryId = id;
      });
    });
  });

  it('DAILY (default) dentro del efectivo disponible → 201 imputado a la caja activa', () => {
    cy.apiRequest(
      'POST',
      '/expenses',
      {
        amount: 1234,
        description: '[source test] DAILY dentro de disponible',
        expense_date: today(),
        payment_method: 'CASH',
        category_id: categoryId,
      },
      token,
    ).then((res) => {
      expect(res.status, JSON.stringify(res.body)).to.eq(201);
      const expense = (res.body as ApiData<ExpenseApi>).data;
      expect(expense.source).to.eq('DAILY');
      expect(expense.cash_session_id).to.eq(sessionId);
    });
  });

  it('DAILY + CASH supera el efectivo disponible de la caja → 409 INSUFFICIENT_CASH', () => {
    cy.apiRequest(
      'POST',
      '/expenses',
      {
        amount: OPENING_AMOUNT + 1,
        description: '[source test] DAILY supera disponible',
        expense_date: today(),
        payment_method: 'CASH',
        category_id: categoryId,
      },
      token,
    ).then((res) => {
      expect(res.status, JSON.stringify(res.body)).to.eq(409);
      expect(res.body.message).to.match(/efectivo disponible/i);
    });
  });

  it('COMPANY → 201 sin cash_session_id, descuenta de Caja General', () => {
    getGeneralCashAccount(token).then((account) => {
      const balanceBefore = account.current_balance;
      const amount = 50;

      cy.apiRequest(
        'POST',
        '/expenses',
        {
          amount,
          description: '[source test] COMPANY OK',
          expense_date: today(),
          payment_method: 'CASH',
          category_id: categoryId,
          source: 'COMPANY',
        },
        token,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(201);
        const expense = (res.body as ApiData<ExpenseApi>).data;
        expect(expense.source).to.eq('COMPANY');
        expect(expense.cash_session_id).to.be.null;

        getGeneralCashAccount(token).then((after) => {
          expect(after.current_balance).to.be.closeTo(
            balanceBefore - amount,
            0.001,
          );

          // Cleanup: restaurar el saldo de Caja General para no afectar otros tests.
          cy.apiRequest(
            'POST',
            `/cash-accounts/${account.id}/movements`,
            {
              movement_type: 'ADJUSTMENT',
              direction: 'IN',
              amount,
              description: '[source test] restock tras COMPANY OK',
            },
            token,
          )
            .its('status')
            .should('eq', 201);
        });
      });
    });
  });

  it('COMPANY + monto supera el saldo de Caja General → 409 INSUFFICIENT_BALANCE', () => {
    getGeneralCashAccount(token).then((account) => {
      const amount = account.current_balance + 1;

      cy.apiRequest(
        'POST',
        '/expenses',
        {
          amount,
          description: '[source test] COMPANY supera saldo',
          expense_date: today(),
          payment_method: 'CASH',
          category_id: categoryId,
          source: 'COMPANY',
        },
        token,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(409);
        expect(res.body.message).to.match(/saldo insuficiente/i);
      });
    });
  });
});
