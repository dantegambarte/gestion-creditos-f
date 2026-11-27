/**
 * SUITE REAL (QA): bordes del módulo de caja contra backend E2E aislado.
 *
 * Modelo real (backend V4):
 *  - Una sola cash_session por jornada (business_day), en TODA su vida: no hay reapertura.
 *  - Caja operativa: ingresos manuales, gastos DAILY, conversiones DAILY y cobros se imputan
 *    a la sesión activa. Esperado por medio = apertura + ingresos - egresos ± conversiones - drops.
 *  - Cierre: declared por medio, diferencia EXACT/SURPLUS/SHORTAGE y auto-fondeo DROP_IN a
 *    Caja General (cash_accounts GENERAL_CASH, a.k.a. "Caja Fuerte").
 *  - Caja General: saldo único current_balance + desglose por medio (transfer calculado de
 *    movimientos + conversiones COMPANY; cash = current - transfer). Nunca negativo.
 *  - Liquidaciones de comisiones salen de Caja General, no de la caja operativa.
 */

/** Respuesta de cy.apiRequest (envelope con payload dinámico por endpoint). */
type Res = ReturnType<typeof cy.apiRequest> extends Cypress.Chainable<infer R> ? R : never;

/** Monto desglosado por medio de pago. */
interface ByMethod {
  cash: number;
  transfer: number;
}

/** Snapshot vivo de la sesión (campos que usa esta suite). */
interface Snapshot {
  opening: ByMethod;
  expected: ByMethod;
  collections: { manual_incomes: ByMethod; payments: ByMethod };
  outflows: { expenses: ByMethod; loans: ByMethod; commissions: ByMethod };
  conversions: { cash_delta: number };
}

interface Balance {
  current_balance: number;
  cash_balance: number;
  transfer_balance: number;
}

const API = () => String(Cypress.env('apiBaseUrl'));
let catId = '';
let seq = Math.floor(Math.random() * 500);
/** Monto único para evitar el guard de gasto duplicado (30s). */
const uniq = (base: number) => base + ++seq / 100;

/** YYYY-MM-DD local Buenos Aires. */
function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

/** Token ADMIN real. */
const admin = () => cy.getAuthToken('ADMIN');

/** Resetea la jornada de hoy y abre caja con apertura dada. */
function resetAndOpen(token: string, opening: number): Cypress.Chainable<string> {
  return cy
    .apiRequest('DELETE', '/test/business-days/today', null, token)
    .then((r) => {
      expect(r.status, 'reset jornada').to.eq(200);
      return cy.apiRequest('POST', '/cash-sessions', { opening_amount: opening }, token);
    })
    .then((r) => {
      expect(r.status, JSON.stringify(r.body)).to.eq(201);
      return r.body.data.id as string;
    });
}

/** Snapshot vivo de la sesión. */
function snap(token: string, id: string): Cypress.Chainable<Snapshot> {
  return cy.apiRequest('GET', `/cash-sessions/${id}/snapshot`, null, token).then((r) => {
    expect(r.status, 'snapshot').to.eq(200);
    return r.body.data as Snapshot;
  });
}

/** Id de Caja General. */
function generalId(token: string): Cypress.Chainable<string> {
  return cy.apiRequest('GET', '/cash-accounts', null, token).then((r) => {
    const g = (r.body.data as Array<{ id: string; type: string }>).find((a) => a.type === 'GENERAL_CASH');
    expect(g, 'GENERAL_CASH').to.exist;
    return g.id as string;
  });
}

/** Saldo de Caja General con invariante cash+transfer == current. */
function balance(token: string, id: string): Cypress.Chainable<Balance> {
  return cy.apiRequest('GET', `/cash-accounts/${id}/balance`, null, token).then((r) => {
    expect(r.status).to.eq(200);
    const b = r.body.data as Balance;
    expect(b.cash_balance + b.transfer_balance, 'invariante cash+transfer=current').to.be.closeTo(
      b.current_balance,
      0.005,
    );
    expect(b.cash_balance, 'cash_balance >= 0').to.be.gte(-0.005);
    expect(b.transfer_balance, 'transfer_balance >= 0').to.be.gte(-0.005);
    return b;
  });
}

/** Audit: cache vs movimientos sin drift. */
function noDrift(token: string, id: string) {
  cy.apiRequest('GET', `/cash-accounts/${id}/audit-balance`, null, token)
    .its('body.data.drift')
    .should('eq', 0);
}

/** Movimiento de Caja General. */
const move = (token: string, id: string, body: object) =>
  cy.apiRequest('POST', `/cash-accounts/${id}/movements`, body, token);

/** Ingreso manual a caja operativa. */
const income = (token: string, sid: string, body: object) =>
  cy.apiRequest('POST', `/cash-sessions/${sid}/manual-incomes`, { description: 'QA ingreso', ...body }, token);

/** Gasto. */
const expense = (token: string, body: object) =>
  cy.apiRequest(
    'POST',
    '/expenses',
    { description: 'QA gasto', expense_date: today(), payment_method: 'CASH', category_id: catId, ...body },
    token,
  );

/** Conversión. */
const convert = (token: string, body: object) =>
  cy.apiRequest('POST', '/cash-register/conversions', { criteria: 'DAILY', register_date: today(), ...body }, token);

/** Cierra sesión con declarado. */
const close = (token: string, sid: string, cash: number, transfer: number) =>
  cy.apiRequest(
    'POST',
    `/cash-sessions/${sid}/close`,
    {
      declared: [
        { payment_method: 'CASH', declared_amount: cash },
        { payment_method: 'TRANSFER', declared_amount: transfer },
      ],
    },
    token,
  );

describe('Caja — bordes reales (API)', () => {
  let t = '';
  let gid = '';

  before(() => {
    admin().then((tok) => {
      t = tok;
      generalId(t).then((id) => (gid = id));
      cy.apiRequest('GET', '/expense-categories', null, t).then((r) => (catId = r.body.data[0].id));
    });
  });

  context('Ciclo de vida de sesión', () => {
    it('abrir dos veces la misma jornada → 409 ACTIVE_SESSION_IN_BUSINESS_DAY', () => {
      resetAndOpen(t, 1000).then(() => {
        cy.apiRequest('POST', '/cash-sessions', { opening_amount: 1000 }, t).then((r: Res) => {
          expect(r.status).to.eq(409);
          expect(r.body.message).to.match(/sola caja/); // note: controller drops `code` from body
        });
      });
    });

    it('apertura inválida: negativa / no numérica → 400; 0 permitido', () => {
      cy.apiRequest('DELETE', '/test/business-days/today', null, t);
      cy.apiRequest('POST', '/cash-sessions', { opening_amount: -1 }, t).its('status').should('eq', 400);
      cy.apiRequest('POST', '/cash-sessions', { opening_amount: 'abc' }, t).its('status').should('eq', 400);
      cy.apiRequest('POST', '/cash-sessions', {}, t).its('status').should('eq', 400);
      cy.apiRequest('POST', '/cash-sessions', { opening_amount: 0 }, t).its('status').should('eq', 201);
    });

    it('cerrar sesión inexistente → 404; id no-UUID → 400; declared vacío → 400', () => {
      cy.apiRequest('POST', '/cash-sessions/00000000-0000-4000-8000-000000000000/close',
        { declared: [{ payment_method: 'CASH', declared_amount: 0 }] }, t).its('status').should('eq', 404);
      cy.apiRequest('POST', '/cash-sessions/xyz/close', { declared: [] }, t).its('status').should('eq', 400);
      resetAndOpen(t, 0).then((sid) => {
        cy.apiRequest('POST', `/cash-sessions/${sid}/close`, { declared: [] }, t).its('status').should('eq', 400);
        cy.apiRequest('POST', `/cash-sessions/${sid}/close`,
          { declared: [{ payment_method: 'CASH', declared_amount: -5 }] }, t).its('status').should('eq', 400);
      });
    });

    it('cerrar dos veces → 409; reabrir misma jornada tras cierre → 409; ops con caja cerrada fallan cerradas', () => {
      resetAndOpen(t, 500).then((sid) => {
        close(t, sid, 500, 0).then((r: Res) => {
          expect(r.status, JSON.stringify(r.body)).to.eq(200);
          expect(r.body.data.status).to.eq('CLOSED');
        });
        close(t, sid, 500, 0).its('status').should('eq', 409);
        cy.apiRequest('POST', '/cash-sessions', { opening_amount: 1 }, t).its('status').should('eq', 409);
        income(t, sid, { amount: 10, payment_method: 'CASH' }).its('status').should('eq', 409);
        expense(t, { amount: uniq(1) }).then((r: Res) => {
          expect(r.status).to.eq(409);
        });
        convert(t, { source_method: 'CASH', amount: 1 }).its('status').should('eq', 409);
        cy.apiRequest('POST', `/cash-sessions/${sid}/drops`, { amount: 1, payment_method: 'CASH' }, t)
          .its('status').should('eq', 409);
        cy.apiRequest('POST', `/cash-sessions/${sid}/mark-pending`, { reason: 'qa test' }, t)
          .its('status').should('eq', 409);
        cy.apiRequest('GET', '/cash-sessions/active', null, t).its('body.data').should('be.null');
      });
    });

    it('mark-pending → reconcile cierra con late_reconciliation y auto-fondea', () => {
      resetAndOpen(t, 300).then((sid) => {
        cy.apiRequest('POST', `/cash-sessions/${sid}/mark-pending`, { reason: 'falta arqueo' }, t)
          .its('status').should('eq', 200);
        income(t, sid, { amount: 5, payment_method: 'CASH' }).its('status').should('eq', 409);
        close(t, sid, 300, 0).its('status').should('eq', 409);
        balance(t, gid).then((before) => {
          cy.apiRequest('POST', `/cash-sessions/${sid}/reconcile`,
            { declared: [{ payment_method: 'CASH', declared_amount: 300 }, { payment_method: 'TRANSFER', declared_amount: 0 }] }, t)
            .then((r: Res) => {
              expect(r.status, JSON.stringify(r.body)).to.eq(200);
              expect(r.body.data.status).to.eq('CLOSED');
            });
          balance(t, gid).its('current_balance').should('be.closeTo', before.current_balance + 300, 0.005);
        });
      });
    });
  });

  context('Ingresos manuales', () => {
    let sid = '';
    beforeEach(() => resetAndOpen(t, 0).then((id) => (sid = id)));

    it('cash / transfer / mixto se reflejan por medio en el snapshot', () => {
      income(t, sid, { amount: 100, payment_method: 'CASH' }).its('status').should('eq', 201);
      income(t, sid, { amount: 200, payment_method: 'TRANSFER', receipt_reference: 'R1' }).its('status').should('eq', 201);
      income(t, sid, { amount_cash: 30, amount_transfer: 70, receipt_reference: 'R2' }).its('status').should('eq', 201);
      snap(t, sid).then((s) => {
        expect(s.collections.manual_incomes.cash).to.be.closeTo(130, 0.005);
        expect(s.collections.manual_incomes.transfer).to.be.closeTo(270, 0.005);
        expect(s.expected.cash).to.be.closeTo(130, 0.005);
        expect(s.expected.transfer).to.be.closeTo(270, 0.005);
      });
    });

    it('montos inválidos: 0, negativo, no numérico, sin método, mixto sin referencia → 400', () => {
      income(t, sid, { amount: 0, payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: -10, payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: 'diez', payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: 10 }).its('status').should('eq', 400);
      income(t, sid, { amount: 10, payment_method: 'MP' }).its('status').should('eq', 400);
      income(t, sid, { amount_cash: 0, amount_transfer: 0 }).its('status').should('eq', 400);
      income(t, sid, { amount_cash: 10, amount_transfer: 5 }).its('status').should('eq', 400);
      income(t, sid, { amount_cash: -5, amount_transfer: 10, receipt_reference: 'x' }).its('status').should('eq', 400);
      income(t, sid, { amount: 10, payment_method: 'CASH', description: 'ab' }).its('status').should('eq', 400);
      snap(t, sid).its('expected.cash').should('eq', 0);
    });

    it('decimales: 0.01 aceptado; 0.005 redondea o rechaza, nunca guarda 3 decimales', () => {
      income(t, sid, { amount: 0.01, payment_method: 'CASH' }).its('status').should('eq', 201);
      income(t, sid, { amount: 0.005, payment_method: 'CASH' }).then((r: Res) => {
        cy.task('log', `income 0.005 → ${r.status} ${JSON.stringify(r.body.data?.amount ?? r.body.message)}`);
        if (r.status === 201) {
          // BUG? si persiste 0.005 tal cual, la caja acumula fracciones de centavo
          expect(Math.round(Number(r.body.data.amount) * 100) / 100, 'persistido a 2 decimales').to.eq(
            Number(r.body.data.amount),
          );
        }
      });
    });

    it('monto fuera de rango (> 99999999) → 400; el tope exacto se acepta (backend#116)', () => {
      income(t, sid, { amount: 1e12, payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: 1e20, payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: 100000000, payment_method: 'CASH' }).its('status').should('eq', 400);
      income(t, sid, { amount: 99999999, payment_method: 'CASH' }).its('status').should('eq', 201);
    });
  });

  context('Gastos DAILY contra saldo por medio', () => {
    let sid = '';
    beforeEach(() =>
      resetAndOpen(t, 1000).then((id) => {
        sid = id;
        income(t, sid, { amount: 500, payment_method: 'TRANSFER', receipt_reference: 'T' });
      }),
    );

    it('gasto CASH mayor al efectivo → 409 INSUFFICIENT_CASH; exacto → 201 y queda 0', () => {
      expense(t, { amount: 1000.01 }).then((r: Res) => {
        expect(r.status).to.eq(409);
        expect(r.body.message).to.match(/efectivo disponible/);
      });
      expense(t, { amount: 1000 }).its('status').should('eq', 201);
      snap(t, sid).its('expected.cash').should('be.closeTo', 0, 0.005);
      expense(t, { amount: uniq(0.01) - 0 }).its('status').should('eq', 409);
    });

    it('gasto TRANSFER mayor al saldo transferencia → 409 INSUFFICIENT_TRANSFER (backend#118)', () => {
      expense(t, { amount: 800, payment_method: 'TRANSFER' }).then((r: Res) => {
        expect(r.status, JSON.stringify(r.body)).to.eq(409);
        expect(r.body.code).to.eq('INSUFFICIENT_TRANSFER');
      });
      snap(t, sid).its('expected.transfer').should('be.gte', 0);
    });

    it('gasto sin payment_method / monto 0 / negativo / no numérico / sin fecha → 400', () => {
      cy.apiRequest('POST', '/expenses', { amount: 10, description: 'qa', expense_date: today() }, t)
        .its('status').should('eq', 400);
      expense(t, { amount: 0 }).its('status').should('eq', 400);
      expense(t, { amount: -1 }).its('status').should('eq', 400);
      expense(t, { amount: 'x' }).its('status').should('eq', 400);
      expense(t, { amount: 0.001 }).its('status').should('eq', 400);
      expense(t, { amount: 100000000 }).its('status').should('eq', 400);
      cy.apiRequest('POST', '/expenses', { amount: 10, description: 'qa', payment_method: 'CASH' }, t)
        .its('status').should('eq', 400);
    });

    it('gasto idéntico repetido en <30s → 409 duplicado', () => {
      const a = uniq(10);
      expense(t, { amount: a }).its('status').should('eq', 201);
      expense(t, { amount: a }).its('status').should('eq', 409);
    });

    it('concurrencia: dos gastos CASH paralelos que juntos superan el efectivo → sólo uno pasa', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        const send = (amount: number) =>
          win
            .fetch(`${API()}/expenses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
              body: JSON.stringify({ category_id: catId, amount, description: 'QA race', expense_date: today(), payment_method: 'CASH' }),
            })
            .then((r) => r.status);
        return Cypress.Promise.all([send(600), send(601)]).then((codes) => {
          cy.task('log', `race codes ${codes}`);
          expect(codes.filter((c) => c === 201), String(codes)).to.have.length(1);
          expect(codes.filter((c) => c === 409)).to.have.length(1);
        });
      });
      snap(t, sid).its('expected.cash').should('be.gte', 0);
    });
  });

  context('Conversiones', () => {
    let sid = '';
    beforeEach(() => resetAndOpen(t, 100).then((id) => (sid = id)));

    it('DAILY CASH→TRANSFER exacto mueve el esperado por medio', () => {
      convert(t, { source_method: 'CASH', amount: 100 }).its('status').should('eq', 201);
      snap(t, sid).then((s) => {
        expect(s.expected.cash).to.be.closeTo(0, 0.005);
        expect(s.expected.transfer).to.be.closeTo(100, 0.005);
      });
    });

    it('DAILY más que lo disponible en el medio origen → 409 (backend#117)', () => {
      convert(t, { source_method: 'CASH', amount: 1000 }).then((r: Res) => {
        expect(r.status, JSON.stringify(r.body)).to.eq(409);
        expect(r.body.code).to.eq('INSUFFICIENT_CASH');
      });
      convert(t, { source_method: 'TRANSFER', amount: 1 }).then((r: Res) => {
        expect(r.status, JSON.stringify(r.body)).to.eq(409);
        expect(r.body.code).to.eq('INSUFFICIENT_TRANSFER');
      });
    });

    it('validación: monto 0/negativo, método inválido, criterio inválido → 400; origen=destino imposible por diseño', () => {
      convert(t, { source_method: 'CASH', amount: 0 }).its('status').should('eq', 400);
      convert(t, { source_method: 'CASH', amount: -5 }).its('status').should('eq', 400);
      convert(t, { source_method: 'MP', amount: 5 }).its('status').should('eq', 400);
      convert(t, { source_method: 'CASH', amount: 5, criteria: 'OTHER' }).its('status').should('eq', 400);
      // target_method se deriva del origen: no existe CASH→CASH. Un target explícito se ignora.
      convert(t, { source_method: 'CASH', target_method: 'CASH', amount: 1 }).then((r: Res) => {
        expect(r.status).to.eq(201);
        expect(r.body.data.target_method).to.eq('TRANSFER');
      });
    });

    it('COMPANY: exacto disponible en medio → 201 y desglose se mueve; más del medio → 409', () => {
      balance(t, gid).then((b) => {
        if (b.cash_balance < 0.01) {
          move(t, gid, { movement_type: 'MANUAL_INCOME', amount: 50, payment_method: 'CASH', description: 'QA fondeo' })
            .its('status').should('eq', 201);
        }
      });
      balance(t, gid).then((b) => {
        convert(t, { criteria: 'COMPANY', source_method: 'TRANSFER', amount: b.transfer_balance + 0.01 }).then((r: Res) => {
          expect(r.status).to.eq(409);
        });
        convert(t, { criteria: 'COMPANY', source_method: 'CASH', amount: b.cash_balance }).its('status').should('eq', 201);
        balance(t, gid).then((a) => {
          expect(a.current_balance).to.be.closeTo(b.current_balance, 0.005);
          expect(a.cash_balance).to.be.closeTo(0, 0.005);
          expect(a.transfer_balance).to.be.closeTo(b.transfer_balance + b.cash_balance, 0.005);
        });
        noDrift(t, gid);
        // Devolver a efectivo para no dejar Caja General sin efectivo a otras suites.
        convert(t, { criteria: 'COMPANY', source_method: 'TRANSFER', amount: b.cash_balance }).its('status').should('eq', 201);
      });
    });
  });

  context('Caja General (caja fuerte)', () => {
    it('egreso sin payment_method → 422 PAYMENT_METHOD_REQUIRED (backend#99)', () => {
      move(t, gid, { movement_type: 'EXPENSE', amount: 1, description: 'qa' }).then((r: Res) => {
        expect([400, 422]).to.include(r.status);
        cy.task('log', `GC EXPENSE sin método → ${r.status} ${r.body.message ?? ''}`);
      });
      move(t, gid, { movement_type: 'ADJUSTMENT', direction: 'OUT', amount: 1 }).then((r: Res) => {
        expect([400, 422]).to.include(r.status);
      });
    });

    it('egreso por medio > saldo del medio → 409; exacto → 201 y medio queda 0; split inconsistente → 400', () => {
      move(t, gid, { movement_type: 'MANUAL_INCOME', amount: 77, payment_method: 'TRANSFER', description: 'qa' })
        .its('status').should('eq', 201);
      balance(t, gid).then((b) => {
        move(t, gid, { movement_type: 'EXPENSE', amount: b.transfer_balance + 1, payment_method: 'TRANSFER' }).then((r: Res) => {
          expect(r.status).to.eq(409);
          expect(r.body.message).to.match(/insuficiente/i);
        });
        move(t, gid, { movement_type: 'EXPENSE', amount: b.transfer_balance, payment_method: 'TRANSFER' })
          .its('status').should('eq', 201);
        balance(t, gid).its('transfer_balance').should('be.closeTo', 0, 0.005);
        noDrift(t, gid);
      });
      move(t, gid, { movement_type: 'EXPENSE', amount: 10, amount_cash: 3, amount_transfer: 3 }).its('status').should('eq', 400);
      move(t, gid, { movement_type: 'EXPENSE', amount: 1, payment_method: 'CASH', amount_cash: 1 }).its('status').should('eq', 400);
      move(t, gid, { movement_type: 'SALARY_PAYMENT', amount: 1, payment_method: 'CASH' }).its('status').should('eq', 400);
    });

    it('cierre con sobrante/faltante: DROP_IN = declarado y diferencia correcta', () => {
      resetAndOpen(t, 1000).then((sid) => {
        income(t, sid, { amount_cash: 200, amount_transfer: 300, receipt_reference: 'Z' });
        expense(t, { amount: uniq(100) }).its('status').should('eq', 201);
        snap(t, sid).then((s) => {
          const expCash = s.expected.cash;
          const expTr = s.expected.transfer;
          expect(expTr).to.be.closeTo(300, 0.005);
          expect(
            s.opening.cash + s.collections.manual_incomes.cash - s.outflows.expenses.cash + s.conversions.cash_delta,
            'expected == suma de movimientos',
          ).to.be.closeTo(expCash, 0.005);
          balance(t, gid).then((before) => {
            close(t, sid, expCash + 50, expTr - 20).then((r: Res) => {
              expect(r.status, JSON.stringify(r.body)).to.eq(200);
              const c = r.body.data;
              cy.task('log', `close data keys ${Object.keys(c).join(',')} diff=${c.closure_total_difference} status=${c.difference_status ?? c.diff_status}`);
              expect(Number(c.closure_total_difference)).to.be.closeTo(30, 0.005);
            });
            balance(t, gid).then((after) => {
              expect(after.current_balance).to.be.closeTo(before.current_balance + expCash + 50 + expTr - 20, 0.01);
              expect(after.transfer_balance).to.be.closeTo(before.transfer_balance + expTr - 20, 0.01);
            });
            noDrift(t, gid);
          });
        });
      });
    });

    it('cierre declarando 0 con esperado positivo → SHORTAGE y no auto-fondea', () => {
      resetAndOpen(t, 400).then((sid) => {
        balance(t, gid).then((before) => {
          close(t, sid, 0, 0).then((r: Res) => {
            expect(r.status).to.eq(200);
            expect(Number(r.body.data.closure_total_difference)).to.be.closeTo(-400, 0.005);
          });
          balance(t, gid).its('current_balance').should('be.closeTo', before.current_balance, 0.005);
        });
      });
    });
  });

  context('Roles', () => {
    (['SELLER', 'COLLECTOR', 'SELLER_COLLECTOR'] as const).forEach((role) => {
      it(`${role} no accede a operaciones de caja → 403`, () => {
        cy.getAuthToken(role).then((rt) => {
          cy.apiRequest('POST', '/cash-sessions', { opening_amount: 1 }, rt).its('status').should('eq', 403);
          cy.apiRequest('GET', '/cash-sessions/active', null, rt).its('status').should('eq', 403);
          cy.apiRequest('GET', '/cash-accounts', null, rt).its('status').should('eq', 403);
          cy.apiRequest('POST', `/cash-accounts/${gid}/movements`,
            { movement_type: 'MANUAL_INCOME', amount: 1, payment_method: 'CASH' }, rt).its('status').should('eq', 403);
          cy.apiRequest('POST', '/cash-register/conversions', { criteria: 'DAILY', source_method: 'CASH', amount: 1 }, rt)
            .its('status').should('eq', 403);
          cy.apiRequest('POST', '/expenses', { amount: 1, description: 'x', expense_date: today(), payment_method: 'CASH' }, rt)
            .its('status').should('eq', 403);
          cy.apiRequest('POST', '/commissions/liquidate', {}, rt).its('status').should('eq', 403);
          cy.apiRequest('DELETE', '/test/business-days/today', null, rt).its('status').should('eq', 403);
        });
      });
    });

    it('sin token → 401', () => {
      cy.request({ method: 'GET', url: `${API()}/cash-sessions/active`, failOnStatusCode: false })
        .its('status').should('eq', 401);
    });
  });

  context('Cobros y comisiones', () => {
    it('cobro admin-direct mixto entra a la caja operativa por medio; comisiones no salen de la sesión', () => {
      resetAndOpen(t, 100000).then((sid) => {
        cy.apiRequest('GET', '/customers', null, t).then((r) => {
          const d = r.body.data;
          const items = Array.isArray(d) ? d : d?.items ?? [];
          const cid = items[0]?.id;
          expect(cid, 'cliente seed').to.exist;
          cy.apiRequest('POST', '/credits',
            { customer_id: cid, type: 'LOAN', total_amount: 30000, installments_count: 3, payment_frequency: 'MONTHLY' }, t)
            .then((c) => {
              expect(c.status, JSON.stringify(c.body)).to.eq(201);
              return cy.apiRequest('PATCH', `/credits/${c.body.data.id}/approve`, {}, t);
            })
            .then((a) => {
              expect(a.status, JSON.stringify(a.body)).to.eq(200);
              snap(t, sid).then((s0) => {
                cy.task('log', `after loan disbursement loans.cash=${s0.outflows.loans.cash} expected.cash=${s0.expected.cash}`);
                cy.apiRequest('POST', '/payments/admin-direct',
                  { installment_id: a.body.data.installments[0].id, amount_cash: 500, amount_transfer: 700, transfer_reference: 'QA-MIX' }, t)
                  .its('status').should('eq', 201);
                snap(t, sid).then((s1) => {
                  expect(s1.collections.payments.cash - s0.collections.payments.cash).to.be.closeTo(500, 0.005);
                  expect(s1.collections.payments.transfer - s0.collections.payments.transfer).to.be.closeTo(700, 0.005);
                  expect(s1.outflows.commissions.cash + s1.outflows.commissions.transfer, 'sin comisiones en sesión').to.eq(0);
                });
              });
            });
        });
      });
    });

    it('liquidación duplicada del mismo período es rechazada (no doble conteo)', () => {
      cy.getAuthToken('SELLER').then((st) =>
        cy.apiRequest('GET', '/auth/me', null, st).then((me) => {
          const uid = me.body.data.id ?? me.body.data.user?.id;
          cy.apiRequest('POST', '/commissions/liquidate', { user_id: uid, payment_method: 'CASH' }, t).then((r1: Res) => {
            cy.task('log', `liquidate#1 → ${r1.status} ${r1.body.message ?? ''}`);
            cy.apiRequest('POST', '/commissions/liquidate', { user_id: uid, payment_method: 'CASH' }, t).then((r2: Res) => {
              cy.task('log', `liquidate#2 → ${r2.status} ${r2.body.message ?? ''}`);
              expect(r2.status, 'segunda liquidación').to.be.oneOf([400, 409]);
            });
          });
          noDrift(t, gid);
        }),
      );
    });
  });

  context('Fechas', () => {
    it('conversión DAILY con register_date distinto a la jornada / fecha inválida', () => {
      resetAndOpen(t, 100).then((sid) => {
        convert(t, { source_method: 'CASH', amount: 1, register_date: '2026-13-40' }).its('status').should('eq', 400);
        convert(t, { source_method: 'CASH', amount: 1, register_date: '2020-01-01' }).then((r: Res) => {
          // backend#119: register_date se ignora; la conversión se imputa a la jornada activa.
          expect(r.status, JSON.stringify(r.body)).to.eq(201);
          expect(String(r.body.data.register_date ?? '')).to.not.contain('2020');
        });
        cy.apiRequest('GET', '/cash-sessions/active', null, t).its('body.data.id').should('eq', sid);
      });
    });

    it('gasto con expense_date fuera de [jornada, hoy] → 400 (backend#119)', () => {
      resetAndOpen(t, 100).then(() => {
        expense(t, { amount: uniq(1), expense_date: '2099-01-01' }).its('status').should('eq', 400);
        expense(t, { amount: uniq(1), expense_date: '2020-01-01' }).its('status').should('eq', 400);
        expense(t, { amount: uniq(1), expense_date: today() }).its('status').should('eq', 201);
      });
    });
  });
});

describe('Caja — UI desktop y mobile', () => {
  const viewports: Array<[string, number, number]> = [
    ['desktop', 1280, 720],
    ['mobile', 375, 667],
  ];
  before(() => admin().then((tok) => resetAndOpen(tok, 1234)));

  viewports.forEach(([name, w, h]) => {
    it(`${name}: caja operativa y caja general renderizan sin error ni scroll horizontal`, () => {
      cy.viewport(w, h);
      cy.intercept('GET', '**/cash-sessions/active').as('active');
      cy.loginReal('ADMIN', '/admin/cash-register');
      cy.wait('@active').its('response.statusCode').should('be.oneOf', [200, 304]);
      cy.get('[data-cy="admin-cash-register-title"]').should('be.visible').and('contain.text', 'Caja');
      cy.get('body').should('not.contain.text', 'Error al cargar');
      cy.document().then((d) => {
        expect(d.documentElement.scrollWidth, 'sin overflow horizontal').to.be.lte(w + 1);
      });
    });
  });
});
