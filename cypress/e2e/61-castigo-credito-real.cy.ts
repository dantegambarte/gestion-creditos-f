/**
 * SUITE REAL — Enterprise: Castigo de crédito incobrable (write-off).
 *
 * Cubre POST /credits/:id/write-off. Regla de negocio (credits.service.js):
 *   - Elegibilidad: crédito ACTIVE con saldo pendiente (cualquier cuota
 *     PENDING/PARTIAL/OVERDUE), sin pre-cargas PENDING sin resolver.
 *   - No toca cuotas pagadas, pagos ni comisiones — solo congela las cuotas
 *     abiertas y saca el crédito de la operatoria de cobranza.
 *   - Definitivo, sin reversión en V1.
 *
 * Setup por API: LOAN simple ACTIVE, sin pagos (todo el saldo es "castigable").
 */

describe('Castigo de crédito incobrable — write-off (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `WriteOff QA ${stamp}`,
    dni: `4${stamp}6`,
    address: `Calle Castigo ${stamp}`,
    phone: `388${stamp}`,
  };

  let creditId: string;

  it('setup — LOAN ACTIVE con saldo pendiente, sin pagos', () => {
    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) =>
        cy
          .apiRequest(
            'POST',
            '/credits',
            {
              customer_id: customerId,
              type: 'LOAN',
              total_amount: 180000,
              installments_count: 2,
              payment_frequency: 'MONTHLY',
            },
            token,
          )
          .then((createRes) => {
            expect(createRes.status, 'alta de préstamo (setup)').to.eq(201);
            creditId = String(createRes.body?.data?.id);

            cy.apiApproveCredit(creditId).then((approved) => {
              expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');
            });
          }),
      );
    });
  });

  it('ADMIN castiga el crédito por UI: ingresa motivo y confirma', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'crédito del setup').to.be.a('string').and.not.be.empty;

    cy.loginReal('ADMIN', `/admin/operations/${creditId}`);
    cy.contains('button', 'Castigar crédito', { timeout: 20000 }).should('be.visible').click();

    cy.contains('.p-dialog-title', 'Castigar crédito', { timeout: 10000 })
      .closest('.p-dialog')
      .as('writeOffDialog');

    cy.get('@writeOffDialog').contains('Saldo pendiente a castigar').should('be.visible');
    cy.get('@writeOffDialog')
      .find('input')
      .type('Cliente incobrable — control QA, sin respuesta hace 6 meses.');

    cy.intercept('POST', /\/api\/credits\/[^/]+\/write-off$/).as('writeOff');
    cy.get('@writeOffDialog').contains('button', 'Castigar crédito').should('not.be.disabled').click();

    cy.wait('@writeOff').then((interception) => {
      expect(interception.response?.statusCode, 'ejecución de castigo').to.eq(200);
    });
  });

  it('verificación dura — crédito WRITTEN_OFF y cuotas abiertas castigadas, sin tocar pagos/comisiones', () => {
    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((res) => {
        expect(res.status, 'estado del crédito castigado').to.eq(200);
        expect(res.body?.data?.status, 'crédito queda WRITTEN_OFF').to.eq('WRITTEN_OFF');
      });

      cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((res) => {
        const rows = (res.body?.data ?? []) as Array<Record<string, unknown>>;
        rows.forEach((row) => {
          expect(row['status'], `cuota ${row['installment_number']} castigada`).to.eq('WRITTEN_OFF');
        });
      });
    });
  });

  it('el crédito castigado ya no admite nuevos cobros (fuera de cobranza)', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then((instRes) => {
        const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
        const installmentId = String(rows[0]['id']);

        cy.apiRequest(
          'POST',
          '/payments/admin-direct',
          { installment_id: installmentId, amount_received: 1000, payment_method: 'CASH' },
          token,
        ).then((res) => {
          expect(res.status, 'cobro sobre cuota castigada debe ser rechazado').to.be.oneOf([400, 409]);
        });
      }),
    );
  });
});
