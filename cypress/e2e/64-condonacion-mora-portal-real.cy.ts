/**
 * SUITE REAL — Enterprise: condonación de mora, multi-rol con verificación
 * de portal.
 *
 * Cubre PATCH /installments/:id/waive-penalty. Regla de negocio
 * (installments.service.js): solo ADMIN, solo si la cuota tiene mora > 0 y
 * no está PAID. waivePenalty resetea amount_due a original_amount,
 * penalty_amount a 0 y "consume" los días de gracia hasta hoy
 * (last_penalty_applied_at = CURRENT_DATE) para que el próximo cron no
 * vuelva a aplicar mora retroactiva sobre días ya condonados.
 *
 * Setup por API: mismo patrón que 57/59 (due_date forzado vía ruta
 * test-only + cron real `overdueInstallments`) para llegar a "cuota OVERDUE
 * con mora real". Se habilita portal para el cliente y se verifica que,
 * tras la condonación, el cliente ve el saldo sin mora.
 */

describe('Condonación de mora — multi-rol con portal (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Waive QA ${stamp}`,
    dni: `7${stamp}3`,
    address: `Calle Waive ${stamp}`,
    phone: `387${stamp}`,
  };
  const portalPassword = `Portal#${stamp}`;

  let creditId: string;
  let installmentId: string;
  let installmentNumber: number;
  let originalAmountDue: number;
  let portalTempPassword: string;

  before(() => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('DELETE', '/test/business-days/today', null, token),
    );
  });

  it('setup — crédito ACTIVE con mora real (API + cron real) y portal habilitado', () => {
    cy.apiCreateCustomer({
      full_name: customer.fullName,
      dni: customer.dni,
      address: customer.address,
      phone: customer.phone,
    }).then((createdCustomer) => {
      const customerId = String(createdCustomer['id']);

      cy.getAuthToken('ADMIN').then((token) => {
        cy.apiRequest('PATCH', `/customers/${customerId}/enable-portal`, null, token).then(
          (enableRes) => {
            expect(enableRes.status, 'habilitar portal del cliente').to.eq(200);
            portalTempPassword = String(enableRes.body?.data?.tempPassword ?? '');
            expect(portalTempPassword, 'temp password de portal').to.not.equal('');
          },
        );

        cy.apiRequest(
          'POST',
          '/credits',
          {
            customer_id: customerId,
            type: 'LOAN',
            total_amount: 180000,
            installments_count: 4,
            payment_frequency: 'MONTHLY',
          },
          token,
        ).then((createRes) => {
          expect(createRes.status, 'alta de préstamo (setup)').to.eq(201);
          creditId = String(createRes.body?.data?.id);

          cy.apiApproveCredit(creditId).then((approved) => {
            expect(approved['status'], 'crédito activo tras aprobación').to.eq('ACTIVE');

            cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, token).then(
              (instRes) => {
                const rows = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
                installmentId = String(rows[0]['id']);
                installmentNumber = Number(rows[0]['installment_number']);
                originalAmountDue = Number(rows[0]['amount_due']);

                cy.apiRequest('GET', '/system-config/penalty_grace_days', null, token).then(
                  (configRes) => {
                    const graceDays = Number(
                      (configRes.body?.data as { value?: string } | undefined)?.value ?? 3,
                    );
                    const due = new Date();
                    due.setDate(due.getDate() - (graceDays + 5));
                    const forcedDueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;

                    cy.apiForceInstallmentDueDate(installmentId, forcedDueDate).then(() => {
                      cy.task('cron:run', 'overdueInstallments').then((result) => {
                        const taskResult = result as { ok: boolean; error?: string };
                        expect(taskResult.ok, `cron:run overdueInstallments — ${taskResult.error ?? ''}`).to.eq(
                          true,
                        );
                      });

                      cy.apiRequest('GET', `/installments/${installmentId}`, null, token).then(
                        (afterRes) => {
                          expect(afterRes.body?.data?.status, 'cuota vencida tras cron').to.eq(
                            'OVERDUE',
                          );
                          expect(
                            Number(afterRes.body?.data?.penalty_amount),
                            'mora aplicada',
                          ).to.be.greaterThan(0);
                        },
                      );
                    });
                  },
                );
              },
            );
          });
        });
      });
    });
  });

  it('ADMIN condona la mora por UI desde el cronograma del crédito', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'crédito con mora (setup)').to.be.a('string').and.not.be.empty;

    cy.loginReal('ADMIN', `/admin/operations/${creditId}`);
    cy.contains('tbody tr td.ff-mono', String(installmentNumber), { timeout: 20000 }).should(
      'be.visible',
    );

    cy.intercept('PATCH', /\/api\/installments\/[^/]+\/waive-penalty$/).as('waivePenalty');
    cy.get('button:has(.pi-minus-circle)', { timeout: 15000 }).first().click({ force: true });

    cy.contains('.p-dialog', 'Condonar Mora', { timeout: 10000 }).should('be.visible');
    cy.contains('.p-dialog button', 'Condonar').click();

    cy.wait('@waivePenalty').then((interception) => {
      expect(interception.response?.statusCode, 'condonación de mora').to.eq(200);
    });
  });

  it('verificación dura — mora en 0 y saldo de la cuota vuelve al monto original', () => {
    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments/${installmentId}`, null, token).then((res) => {
        expect(res.status, 'cuota tras condonación').to.eq(200);
        expect(Number(res.body?.data?.penalty_amount), 'mora condonada a 0').to.eq(0);
        expect(Number(res.body?.data?.amount_due), 'saldo vuelve al monto original').to.be.closeTo(
          originalAmountDue,
          1,
        );
      }),
    );
  });

  it('el PORTAL del cliente refleja el saldo sin mora tras la condonación', () => {
    cy.viewport(1280, 720);
    expect(portalTempPassword, 'temp password obtenida en el setup').to.be.a('string').and.not.be
      .empty;

    cy.visit('/portal/login');
    cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
    cy.get('p-password[formControlName="password"] input').clear().type(portalTempPassword);
    cy.contains('button', 'Iniciar sesión').click();

    cy.location('pathname', { timeout: 15000 }).should((pathname) => {
      expect(['/portal/dashboard', '/portal/change-password']).to.include(pathname);
    });
    cy.location('pathname').then((pathname) => {
      if (!pathname.includes('change-password')) return;

      cy.window()
        .then((win) => {
          const token = win.localStorage.getItem('sgcf_portal_token');
          expect(token, 'token portal tras login temp').to.be.a('string').and.not.be.empty;

          return cy.request({
            method: 'POST',
            url: `${String(Cypress.env('apiBaseUrl'))}/auth/portal/change-password`,
            headers: { Authorization: `Bearer ${token}` },
            body: { current_password: portalTempPassword, new_password: portalPassword },
          });
        })
        .then((changeRes) => {
          expect(changeRes.status, 'cambio de contraseña temporal').to.eq(200);

          cy.clearAllLocalStorage();
          cy.visit('/portal/login');
          cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
          cy.get('p-password[formControlName="password"] input').clear().type(portalPassword);
          cy.contains('button', 'Iniciar sesión').click();
        });
    });

    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/dashboard');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="portal-dashboard-summary-card"]', { timeout: 15000 }).should('be.visible');

    cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('GET', `/installments/${installmentId}`, null, token).then((res) => {
        expect(Number(res.body?.data?.penalty_amount), 'mora sigue en 0 tras login portal').to.eq(
          0,
        );
      }),
    );
  });
});
