/**
 * SUITE REAL — Enterprise: feriados afectando fechas reales de vencimiento.
 *
 * `43-admin-config-holidays.cy.ts` solo prueba el CRUD de feriados (alta,
 * edición, listado). Ningún test real verifica el EFECTO que un feriado
 * tiene sobre el cronograma de cuotas — la regla de negocio que vive en
 * `applyBusinessDayRuleToDueDates` (credits.service.js) + `businessDay.js`:
 * toda fecha de vencimiento que cae en un feriado ACTIVO con
 * `affects_due_dates=true` se corre al próximo día hábil. Si el feriado NO
 * afecta vencimientos (`affects_due_dates=false`), la fecha NO se mueve.
 *
 * Para que el test sea determinístico se usa `first_payment_date` (campo
 * real de alta de crédito) fijado exactamente en el feriado creado, en vez
 * de depender de la fecha de aprobación + frecuencia.
 */

function nextWeekday(date: Date): Date {
  const d = new Date(date);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('Feriados afectando fechas reales de vencimiento (real)', () => {
  const stamp = Date.now().toString().slice(-6);

  // Offset variable por corrida — holidays.date es único en la DB, así que
  // reusar el mismo offset fijo entre corridas chocaría con un feriado real
  // creado en una corrida anterior (409). Dos feriados bien separados en el
  // tiempo, cada uno garantizado día de semana (lunes a viernes) y con el
  // día siguiente también hábil, para que el resultado no dependa de qué
  // día caiga el fin de semana.
  const dayOffset = 100 + (Date.now() % 2000);
  const holidayThatMoves = nextWeekday(new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000));
  const holidayThatDoesNotMove = nextWeekday(
    new Date(Date.now() + (dayOffset + 20) * 24 * 60 * 60 * 1000),
  );
  const dayAfterMoves = nextWeekday(
    new Date(holidayThatMoves.getTime() + 24 * 60 * 60 * 1000),
  );

  it('feriado con affects_due_dates=true corre el vencimiento real al próximo día hábil', () => {
    cy.apiCreateCustomer({
      full_name: `Feriado Mueve QA ${stamp}`,
      dni: `1${stamp}3`,
      address: 'Calle Feriado Mueve',
      phone: `391${stamp}`,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/holidays',
            {
              date: toIsoDate(holidayThatMoves),
              name: `Feriado QA mueve ${stamp}`,
              type: 'EXTRAORDINARY',
              affects_due_dates: true,
              active: true,
              repeats_annually: false,
            },
            token,
          )
          .then((holidayRes) => {
            expect(holidayRes.status, 'alta de feriado real (afecta vencimientos)').to.eq(201);

            cy.apiRequest(
              'POST',
              '/credits',
              {
                customer_id: customerId,
                type: 'LOAN',
                total_amount: 90000,
                installments_count: 2,
                payment_frequency: 'MONTHLY',
                first_payment_date: toIsoDate(holidayThatMoves),
              },
              token,
            ).then((createRes) => {
              expect(createRes.status, 'alta de préstamo con 1er pago en el feriado').to.eq(201);
              const creditId = String(createRes.body?.data?.id);

              cy.apiApproveCredit(creditId).then((approved) => {
                expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');

                cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then(
                  (instRes) => {
                    const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                    const first = rows.sort(
                      (a, b) =>
                        Number(a['installment_number']) - Number(b['installment_number']),
                    )[0];

                    expect(
                      String(first['due_date']).slice(0, 10),
                      'el vencimiento NO cae en el feriado',
                    ).to.not.eq(toIsoDate(holidayThatMoves));
                    expect(
                      String(first['due_date']).slice(0, 10),
                      'se corrió exactamente al próximo día hábil real',
                    ).to.eq(toIsoDate(dayAfterMoves));
                  },
                );
              });
            });
          }),
      );
    });
  });

  it('feriado con affects_due_dates=false NO mueve el vencimiento real', () => {
    cy.apiCreateCustomer({
      full_name: `Feriado NoMueve QA ${stamp}`,
      dni: `2${stamp}4`,
      address: 'Calle Feriado NoMueve',
      phone: `392${stamp}`,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/holidays',
            {
              date: toIsoDate(holidayThatDoesNotMove),
              name: `Feriado QA no mueve ${stamp}`,
              type: 'BANKING',
              affects_due_dates: false,
              active: true,
              repeats_annually: false,
            },
            token,
          )
          .then((holidayRes) => {
            expect(holidayRes.status, 'alta de feriado real (NO afecta vencimientos)').to.eq(201);

            cy.apiRequest(
              'POST',
              '/credits',
              {
                customer_id: customerId,
                type: 'LOAN',
                total_amount: 90000,
                installments_count: 2,
                payment_frequency: 'MONTHLY',
                first_payment_date: toIsoDate(holidayThatDoesNotMove),
              },
              token,
            ).then((createRes) => {
              expect(createRes.status, 'alta de préstamo con 1er pago en el feriado').to.eq(201);
              const creditId = String(createRes.body?.data?.id);

              cy.apiApproveCredit(creditId).then(() => {
                cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then(
                  (instRes) => {
                    const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                    const first = rows.sort(
                      (a, b) =>
                        Number(a['installment_number']) - Number(b['installment_number']),
                    )[0];

                    expect(
                      String(first['due_date']).slice(0, 10),
                      'el vencimiento se mantiene exacto: el feriado no afecta fechas',
                    ).to.eq(toIsoDate(holidayThatDoesNotMove));
                  },
                );
              });
            });
          }),
      );
    });
  });
});
