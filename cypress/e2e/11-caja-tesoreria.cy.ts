/**
 * SUITE: Admin — Caja Fuerte Central V4 (Dark Premium) — operatoria diaria (E2E independiente)
 *
 * Cada test es FIRST-compliant: el beforeEach resetea la jornada de hoy vía
 * `DELETE /api/test/business-days/today` (requiere ENABLE_TEST_ROUTES=true en
 * el backend), abre una caja operativa vía API y siembra (API Seeding):
 *   - un Gasto ("Pago de Sueldo E2E") → aparece como EGRESO
 *   - un Ingreso Manual ("Venta E2E - ingreso en efectivo") → aparece como INGRESO
 *
 * Esto deja la jornada en estado conocido y OPEN al iniciar cada test, sin
 * depender de la UI ni del estado dejado por corridas anteriores — incluido
 * el cierre de jornada (TEST 4), que ya no necesita estar skipeado porque el
 * siguiente beforeEach vuelve a resetear la jornada.
 */

/** Extrae un número comparable desde un texto con formato moneda es-AR (ej: "$ 12.345,67"). */
function parseAmount(text: string): number {
  return Number(text.replace(/[^\d]/g, ''));
}

/** Devuelve el valor (texto) de la tarjeta KPI con la etiqueta indicada. */
function kpiValueText(label: string) {
  return cy
    .contains('[data-cy="admin-cash-register-kpis"] > div', label)
    .find('p.font-mono')
    .invoke('text');
}

/** Fecha de hoy en formato YYYY-MM-DD usando hora local (evita el corrimiento UTC de toISOString). */
function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Arma una URL absoluta contra el backend real configurado en Cypress.env('apiBaseUrl'). */
function apiUrl(path: string): string {
  return `${String(Cypress.env('apiBaseUrl'))}${path}`;
}

/** Hace login real de ADMIN por API y devuelve el JWT para usar en los requests de seeding. */
function adminApiToken(): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: apiUrl('/auth/login'),
      body: {
        dni: String(Cypress.env('realAdminDni')),
        password: String(Cypress.env('realAdminPassword')),
      },
    })
    .then((res) => {
      const token = res.body?.data?.token as string;
      expect(token, '[seed] token admin').to.be.a('string').and.not.be.empty;
      return token;
    });
}

/** Resetea la jornada de hoy (Automated Teardown) vía endpoint de testing. */
function resetJornadaHoy(token: string) {
  return cy.request({
    method: 'DELETE',
    url: apiUrl('/test/business-days/today'),
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Abre una caja operativa por API y devuelve su id. */
function abrirCajaApi(token: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'POST',
      url: apiUrl('/cash-sessions'),
      headers: { Authorization: `Bearer ${token}` },
      body: { opening_amount: 10000 },
    })
    .then((res) => {
      expect(res.status, '[seed] abrir caja').to.eq(201);
      return res.body.data.id as string;
    });
}

/**
 * Siembra un gasto ("Pago de Sueldo E2E") imputado a la caja activa de la jornada.
 *
 * El monto varía por corrida (basado en Date.now()) porque el backend tiene un
 * guard anti-duplicados de 30s (mismo amount + category_id + expense_date +
 * created_by). El reset de jornada desvincula gastos previos pero no los
 * borra, así que un monto fijo colisionaría con el gasto sembrado por el
 * `beforeEach` anterior si corrió hace menos de 30s.
 */
function seedGastoSueldo(token: string) {
  return cy
    .request({
      method: 'GET',
      url: apiUrl('/expense-categories'),
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((catsRes) => {
      const categoryId = catsRes.body?.data?.[0]?.id as string;
      expect(categoryId, '[seed] category_id').to.be.a('string').and.not.be
        .empty;

      return cy.request({
        method: 'POST',
        url: apiUrl('/expenses'),
        headers: { Authorization: `Bearer ${token}` },
        body: {
          amount: 1500 + (Date.now() % 1000),
          description: 'Pago de Sueldo E2E',
          expense_date: todayIso(),
          payment_method: 'CASH',
          category_id: categoryId,
        },
      });
    })
    .then((res) => {
      expect(res.status, '[seed] crear gasto').to.eq(201);
    });
}

/** Siembra un ingreso manual ("Venta E2E - ingreso en efectivo") en la caja activa. */
function seedIngresoVenta(token: string, sessionId: string) {
  return cy
    .request({
      method: 'POST',
      url: apiUrl(`/cash-sessions/${sessionId}/manual-incomes`),
      headers: { Authorization: `Bearer ${token}` },
      body: {
        amount: 8000,
        payment_method: 'CASH',
        description: 'Venta E2E - ingreso en efectivo',
      },
    })
    .then((res) => {
      expect(res.status, '[seed] crear ingreso manual').to.eq(201);
    });
}

describe('Admin — Caja Fuerte Central V4 — operatoria diaria', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    // ── Automated Teardown + API Seeding ──────────────────────────────────
    adminApiToken().then((token) => {
      resetJornadaHoy(token).then(() => {
        abrirCajaApi(token).then((sessionId) => {
          seedGastoSueldo(token);
          seedIngresoVenta(token, sessionId);
        });
      });
    });

    // ── Setup UI ────────────────────────────────────────────────────────
    cy.intercept('GET', '**/api/business-days/active').as(
      'getActiveBusinessDay',
    );
    cy.intercept('GET', '**/api/cash-sessions/active').as('getActiveSession');
    cy.intercept('GET', '**/api/cash-register/dashboard*').as('getDashboard');
    cy.intercept('GET', '**/api/cash-register/sessions/*/movements').as(
      'getMovements',
    );

    cy.loginReal('ADMIN', '/admin/cash-register');

    cy.wait('@getActiveBusinessDay');
    cy.wait('@getActiveSession');
    cy.wait('@getDashboard');
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');
  });

  it('muestra la pantalla de Caja Fuerte sin estado de error', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-history-title"]').should(
      'be.visible',
    );
  });

  it('CASO 1 — Apertura de Caja: la jornada queda OPEN (sembrada por API)', () => {
    cy.contains('span', 'OPEN', { timeout: 15000 }).should('be.visible');
  });

  it('TEST 1 — Lectura Unificada: la Caja Fuerte muestra el gasto (EGRESO) y la venta (INGRESO) sembrados por API', () => {
    cy.contains(
      '[data-cy="admin-cash-register-history-table"] tbody tr',
      'Pago de Sueldo E2E',
    ).should('contain.text', 'EGRESO');

    cy.contains(
      '[data-cy="admin-cash-register-history-table"] tbody tr',
      'Venta E2E - ingreso en efectivo',
    ).should('contain.text', 'INGRESO');
  });

  it('TEST 2 — Ingreso Manual (UI): registra un ingreso, suben los Ingresos y aparece badge INGRESO', () => {
    cy.intercept('POST', '**/api/cash-sessions/*/manual-incomes').as(
      'postManualIncome',
    );

    kpiValueText('Ingresos').then((before) => {
      const ingresosAntes = parseAmount(before);

      cy.contains('button', 'Ingreso Manual').click();
      cy.contains('.p-dialog:visible h2', 'Ingreso Manual').should(
        'be.visible',
      );

      cy.get('.p-dialog:visible #manual-income-amount').clear().type('5000');
      cy.get('.p-dialog:visible #manual-income-description').type(
        'Ingreso E2E - aporte de prueba',
      );
      cy.contains('.p-dialog:visible button', 'Registrar ingreso').click();

      cy.wait('@postManualIncome').its('response.statusCode').should('eq', 201);
      cy.wait('@getMovements');
      cy.wait('@getDashboard');

      cy.contains('[data-cy="admin-cash-register-kpis"] > div', 'Ingresos')
        .find('p.font-mono')
        .should(($el) => {
          expect(parseAmount($el.text())).to.be.greaterThan(ingresosAntes);
        });
    });

    cy.get('[data-cy="admin-cash-register-history-table"] tbody tr')
      .first()
      .within(() => {
        cy.contains('INGRESO').should('be.visible');
        cy.contains('Ingreso E2E - aporte de prueba').should('be.visible');
      });
  });

  it('TEST 2b — Ingreso Manual Mixto (UI): envía efectivo y transferencia al backend real', () => {
    cy.intercept('POST', '**/api/cash-sessions/*/manual-incomes').as(
      'postManualIncomeMixed',
    );

    kpiValueText('Ingresos').then((before) => {
      const ingresosAntes = parseAmount(before);

      cy.contains('button', 'Ingreso Manual').click();
      cy.contains('.p-dialog:visible h2', 'Ingreso Manual').should(
        'be.visible',
      );

      cy.get('.p-dialog:visible #manual-income-amount').clear().type('7000');
      cy.get('.p-dialog:visible #manual-income-method').click();
      cy.contains('.p-dropdown-item', 'Efectivo + transferencia').click();
      cy.get('.p-dialog:visible #manual-income-cash-amount')
        .clear()
        .type('3000');
      cy.get('.p-dialog:visible #manual-income-transfer-amount')
        .clear()
        .type('4000');
      cy.get('.p-dialog:visible #manual-income-description').type(
        'Ingreso E2E - mixto',
      );
      cy.get('.p-dialog:visible #manual-income-reference').type('MIX-E2E-001');
      cy.contains('.p-dialog:visible button', 'Registrar ingreso').click();

      cy.wait('@postManualIncomeMixed').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        expect(interception.request.body).to.include({
          amount: 7000,
          amount_cash: 3000,
          amount_transfer: 4000,
          description: 'Ingreso E2E - mixto',
          receipt_reference: 'MIX-E2E-001',
        });
        expect(interception.request.body.payment_method).to.equal(undefined);
      });
      cy.wait('@getMovements');
      cy.wait('@getDashboard');

      cy.contains('[data-cy="admin-cash-register-kpis"] > div', 'Ingresos')
        .find('p.font-mono')
        .should(($el) => {
          expect(parseAmount($el.text())).to.be.greaterThan(ingresosAntes);
        });
    });

    cy.get('[data-cy="admin-cash-register-history-table"] tbody tr')
      .first()
      .within(() => {
        cy.contains('INGRESO').should('exist');
        cy.contains('Ingreso E2E - mixto').should('exist');
      });
  });

  it('TEST 3 — Convertir Dinero: Efectivo → Transferencia, aparece badge CONVERSION y el Saldo Estimado se mantiene', () => {
    cy.intercept('POST', '**/api/cash-register/conversions').as(
      'postConversion',
    );

    cy.contains('span', 'Saldo Estimado')
      .parent()
      .find('span.font-mono')
      .invoke('text')
      .then((before) => {
        const saldoAntes = parseAmount(before);

        cy.contains('button', 'Convertir Dinero').click();
        cy.contains('.p-dialog:visible h2', 'Convertir Dinero').should(
          'be.visible',
        );

        // Defaults: origen Efectivo (CASH) → destino Transferencia
        cy.contains('.p-dialog:visible', 'Hacia').should(
          'contain',
          'Transferencia',
        );

        cy.get('.p-dialog:visible #conversion-amount').clear().type('100');
        cy.contains('.p-dialog:visible button', 'Convertir').click();

        cy.wait('@postConversion').its('response.statusCode').should('eq', 201);
        cy.wait('@getMovements');
        cy.wait('@getDashboard');

        cy.contains('span', 'Saldo Estimado')
          .parent()
          .find('span.font-mono')
          .should(($el) => {
            expect(parseAmount($el.text())).to.eq(saldoAntes);
          });
      });

    cy.get('[data-cy="admin-cash-register-history-table"] tbody tr')
      .first()
      .within(() => {
        cy.contains('CONVERSION').should('be.visible');
      });
  });

  it('TEST 4 — Cierre de Jornada: cierra caja + jornada y deshabilita la botonera', () => {
    cy.intercept('GET', '**/api/cash-sessions/*/snapshot').as('getSnapshot');
    cy.intercept('POST', '**/api/cash-sessions/*/close').as('postCloseSession');
    cy.intercept('POST', '**/api/business-days/*/close').as(
      'postCloseBusinessDay',
    );

    cy.contains('button', 'Cierre de Jornada').click();
    cy.contains('.p-dialog:visible h2', 'Cerrar caja operativa').should(
      'be.visible',
    );
    cy.wait('@getSnapshot').then((interception) => {
      const expectedCash =
        interception.response?.body?.data?.expected?.cash ?? 0;

      cy.contains('.p-dialog:visible tr', 'Efectivo')
        .find('p-inputnumber input')
        .clear()
        .type(String(expectedCash));
    });

    cy.contains('.p-dialog:visible button', 'Cerrar caja').click();

    cy.wait('@postCloseSession').its('response.statusCode').should('eq', 200);
    cy.wait('@postCloseBusinessDay', { timeout: 20000 })
      .its('response.statusCode')
      .should('eq', 200);

    cy.contains('Cierre de Jornada', { timeout: 20000 }).should('not.exist');
    cy.get('.p-dialog-mask', { timeout: 15000 }).should('not.exist');

    // V4: tras cerrar la jornada, "Abrir Caja" queda habilitado a propósito
    // (el admin puede iniciar la jornada siguiente sin esperar).
    cy.contains('button', 'Abrir Caja').should('be.visible').and('be.enabled');
  });

  it('TEST 5 — Registrar Gasto (UI): registra un gasto y sube el KPI Gastos con badge EGRESO', () => {
    cy.intercept('POST', '**/api/expenses').as('postExpense');

    kpiValueText('Gastos').then((before) => {
      const gastosAntes = parseAmount(before);

      cy.contains('button', 'Registrar Gasto').click();
      cy.contains('.p-dialog:visible h2', 'Registrar gasto').should(
        'be.visible',
      );

      // Origen del gasto: radio "Caja del día" / "Caja General", visible solo al crear
      cy.contains('.p-dialog:visible label', 'Origen del gasto').should(
        'be.visible',
      );
      cy.contains('.p-dialog:visible', 'Caja del día').should('be.visible');
      cy.contains('.p-dialog:visible', 'Caja General').should('be.visible');

      cy.get('.p-dialog:visible input[placeholder="0"]').clear().type('750');

      cy.get(
        '.p-dialog:visible input[placeholder="Descripción del gasto..."]',
      ).type('Gasto E2E - insumos de oficina');

      cy.contains('.p-dialog:visible label', 'Categoría')
        .parent()
        .find('.p-dropdown')
        .click();
      cy.get('.p-dropdown-panel .p-dropdown-item')
        .not(':contains("Sin categoría")')
        .first()
        .click();

      cy.contains('.p-dialog:visible button', 'Registrar gasto').click();

      cy.wait('@postExpense').then((interception) => {
        expect(interception.response?.statusCode).to.eq(201);
        expect(interception.request.body.source).to.eq('DAILY');
      });
      cy.wait('@getMovements');
      cy.wait('@getDashboard');

      cy.contains('[data-cy="admin-cash-register-kpis"] > div', 'Gastos')
        .find('p.font-mono')
        .should(($el) => {
          expect(parseAmount($el.text())).to.be.greaterThan(gastosAntes);
        });
    });

    cy.get('[data-cy="admin-cash-register-history-table"] tbody tr')
      .first()
      .within(() => {
        cy.contains('EGRESO').should('be.visible');
        cy.contains('Gasto E2E - insumos de oficina').should('be.visible');
      });
  });
});

describe('Admin — Caja Fuerte Central V4 — apertura de jornada (caja cerrada)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    // ── Automated Teardown (sin abrir caja ni sembrar datos) ──────────────
    adminApiToken().then((token) => {
      return resetJornadaHoy(token);
    });

    // ── Setup UI ────────────────────────────────────────────────────────
    cy.intercept('GET', '**/api/business-days/active').as(
      'getActiveBusinessDay',
    );
    cy.intercept('GET', '**/api/cash-sessions/active').as('getActiveSession');
    cy.intercept('GET', '**/api/cash-register/dashboard*').as('getDashboard');

    cy.loginReal('ADMIN', '/admin/cash-register');

    cy.wait('@getActiveBusinessDay');
    cy.wait('@getActiveSession');
    cy.wait('@getDashboard');
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');
  });

  it('CASO 0 — Apertura de Caja (UI): abre la caja operativa y la jornada queda OPEN con Pendiente de Arqueo', () => {
    cy.intercept('POST', '**/api/cash-sessions').as('postOpenSession');

    cy.get('body').then(($body) => {
      if ($body.find('button:contains("Abrir Caja")').length > 0) {
        cy.contains('button', 'Abrir Caja').should('be.visible').click();

        cy.contains('.p-dialog:visible', 'Abrir caja operativa').should(
          'be.visible',
        );
        cy.get('.p-dialog:visible #opening-amount').clear().type('10000');
        cy.contains('.p-dialog:visible button', 'Abrir caja').click();

        cy.wait('@postOpenSession')
          .its('response.statusCode')
          .should('eq', 201);
        cy.wait('@getActiveBusinessDay');
        cy.wait('@getActiveSession');
        cy.wait('@getDashboard');
      }
    });

    cy.contains('span', 'OPEN', { timeout: 15000 }).should('be.visible');
    cy.contains('Pendiente de Arqueo', { timeout: 10000 }).should('exist');
  });
});
