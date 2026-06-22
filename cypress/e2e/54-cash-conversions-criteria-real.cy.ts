/**
 * SUITE REAL: criterio de la conversión (`criteria`: DAILY/COMPANY) contra backend E2E.
 *
 * Mismo patrón que `expenses.source`:
 *   - DAILY (default): imputa la conversión a la caja activa de la jornada
 *     (`cash_session_id` = sesión activa).
 *   - COMPANY: la conversión es de Caja General. Como `cash_accounts.current_balance`
 *     es un pool único (no separa efectivo/transferencia), una conversión CASH<->TRANSFER
 *     tiene delta neto 0 sobre ese saldo — se valida contra `current_balance` pero no
 *     se inserta movimiento, y la conversión queda con `cash_session_id: null`.
 */

type ApiData<T> = { data: T };

interface CashConversionApi {
  id: string;
  criteria: string;
  source_method: string;
  target_method: string;
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

describe('Cash conversions criteria (DAILY/COMPANY) — real backend', () => {
  const OPENING_AMOUNT = 10000;
  let token = '';
  let sessionId = '';

  beforeEach(function () {
    if (!Cypress.env('realAuthEnabled')) this.skip();

    adminToken().then((t) => {
      token = t;
      resetAndOpenSession(token, OPENING_AMOUNT).then((id) => {
        sessionId = id;
      });
    });
  });

  it('DAILY (default) con caja activa → 201 imputado a la caja activa', () => {
    cy.apiRequest(
      'POST',
      '/cash-register/conversions',
      {
        criteria: 'DAILY',
        source_method: 'CASH',
        amount: 100,
        register_date: today(),
      },
      token,
    ).then((res) => {
      expect(res.status, JSON.stringify(res.body)).to.eq(201);
      const conversion = (res.body as ApiData<CashConversionApi>).data;
      expect(conversion.criteria).to.eq('DAILY');
      expect(conversion.cash_session_id).to.eq(sessionId);
    });
  });

  it('COMPANY dentro del saldo de Caja General → 201 sin cash_session_id', () => {
    getGeneralCashAccount(token).then((account) => {
      const amount = Math.min(50, account.current_balance);

      cy.apiRequest(
        'POST',
        '/cash-register/conversions',
        {
          criteria: 'COMPANY',
          source_method: 'CASH',
          amount,
          register_date: today(),
        },
        token,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(201);
        const conversion = (res.body as ApiData<CashConversionApi>).data;
        expect(conversion.criteria).to.eq('COMPANY');
        expect(conversion.cash_session_id).to.be.null;

        getGeneralCashAccount(token).then((after) => {
          // Pool único: conversión CASH<->TRANSFER tiene delta neto 0.
          expect(after.current_balance).to.be.closeTo(
            account.current_balance,
            0.001,
          );
        });
      });
    });
  });

  it('COMPANY + monto supera el saldo de Caja General → 409 saldo insuficiente', () => {
    getGeneralCashAccount(token).then((account) => {
      const amount = account.current_balance + 1;

      cy.apiRequest(
        'POST',
        '/cash-register/conversions',
        {
          criteria: 'COMPANY',
          source_method: 'CASH',
          amount,
          register_date: today(),
        },
        token,
      ).then((res) => {
        expect(res.status, JSON.stringify(res.body)).to.eq(409);
        expect(res.body.message).to.match(/saldo insuficiente/i);
      });
    });
  });
});
