/**
 * SUITE: Admin — Caja Fuerte Central V4 (Dark Premium) — operatoria diaria
 *
 * Cubre la operatoria diaria de la jornada activa contra el backend real
 * (login real, sin mocks de respuesta):
 *   CASO 1 — Apertura de caja (estado OPEN + Pendiente de Arqueo)
 *   CASO 2 — Ingreso manual
 *   CASO 3 — Registrar gasto
 *   CASO 4 — Convertir dinero (Efectivo → Transferencia)
 *
 * Cada test es independiente: el beforeEach garantiza que la caja quede
 * abierta (vía ensureCajaAbierta) sin depender del orden de ejecución ni
 * del estado dejado por otros tests.
 *
 * CASO 5 (cierre de jornada) vive en un describe.skip aparte porque cierra
 * formalmente la jornada del día (business_day pasa a CLOSED, estado NO
 * reversible vía UI/API normal). Correrlo solo manualmente y nunca contra
 * producción.
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

/** Si la caja está cerrada (y la apertura está habilitada), la abre con un monto inicial. */
function ensureCajaAbierta(): void {
  cy.get('body').then(($body) => {
    const abrirBtn = $body.find('button:contains("Abrir Caja")');

    if (abrirBtn.length > 0 && !abrirBtn.is(':disabled')) {
      cy.intercept('POST', '**/api/cash-sessions').as('postOpenSession');

      cy.contains('button', 'Abrir Caja').click();
      cy.contains(
        '.p-dialog:visible .p-dialog-title',
        'Abrir caja operativa',
      ).should('be.visible');

      cy.get('.p-dialog:visible #opening-amount').clear().type('10000');
      cy.contains('.p-dialog:visible button', 'Abrir caja').click();

      cy.wait('@postOpenSession').its('response.statusCode').should('eq', 201);
      cy.wait('@getActiveSession');
      cy.wait('@getDashboard');
    }
  });
}

describe('Admin — Caja Fuerte Central V4 — operatoria diaria', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

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
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');

    ensureCajaAbierta();
  });

  it('muestra la pantalla de Caja Fuerte sin estado de error', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="admin-cash-register-kpis"]').should('be.visible');
    cy.get('[data-cy="admin-cash-register-history-title"]').should(
      'be.visible',
    );
  });

  it('CASO 1 — Apertura de Caja: la jornada queda OPEN y pendiente de arqueo', () => {
    cy.contains('span', 'OPEN', { timeout: 15000 }).should('be.visible');
    cy.contains('Pendiente de Arqueo').should('be.visible');
  });

  it('CASO 2 — Ingreso Manual: registra un ingreso, suben los Ingresos y aparece badge INGRESO', () => {
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

  it('CASO 3 — Registrar Gasto: registra un gasto, sube Gastos y aparece badge EGRESO', () => {
    cy.intercept('POST', '**/api/expenses').as('postExpense');

    kpiValueText('Gastos').then((before) => {
      const gastosAntes = parseAmount(before);

      cy.contains('button', 'Registrar Gasto').click();
      cy.contains('.p-dialog:visible h2', 'Registrar gasto').should(
        'be.visible',
      );

      cy.get('.p-dialog:visible p-inputnumber input')
        .first()
        .clear()
        .type('1500');
      cy.get(
        '.p-dialog:visible input[placeholder="Descripción del gasto..."]',
      ).type('Gasto E2E - prueba automatizada');

      // Categoría es requerida por el validador del backend (category_id obligatorio);
      // las categorías se cargan en ngOnInit, ya disponibles al abrir el diálogo.
      // El primer item del panel es "Sin categoría" (value: null), por eso se
      // selecciona el segundo (una categoría real).
      cy.get('.p-dialog:visible .p-dropdown').click();
      cy.get('.p-dropdown-panel .p-dropdown-item', { timeout: 10000 })
        .eq(1)
        .click();

      cy.contains('.p-dialog:visible button', 'Registrar gasto').click();

      cy.wait('@postExpense').its('response.statusCode').should('eq', 201);
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
      });
  });

  it('CASO 4 — Convertir Dinero: Efectivo → Transferencia, aparece badge CONVERSION y el Saldo Estimado se mantiene', () => {
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
});

/**
 * CASO 5 — Cierre de Jornada: DESTRUCTIVO E IRREVERSIBLE.
 *
 * Cierra la caja operativa y, si la jornada queda READY_TO_CLOSE, la cierra
 * automáticamente (business_day pasa a CLOSED). No existe vía UI/API normal
 * para reabrir una jornada CLOSED del mismo día — bloquea toda la operatoria
 * de "Caja Fuerte" hasta el día siguiente.
 *
 * Skipeado por defecto. Para correrlo a propósito, quitar `.skip` y ejecutar
 * solo contra el entorno de pruebas (realAuthEnabled=true), nunca contra
 * producción.
 */
describe.skip('Admin — Caja Fuerte Central V4 — cierre de jornada (DESTRUCTIVO)', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

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
    cy.get('[data-cy="admin-cash-register-title"]').should('be.visible');

    ensureCajaAbierta();
  });

  it('CASO 5 — Cierre de Jornada: cierra caja + jornada en una sola acción y deshabilita las operaciones', () => {
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
    cy.contains('span', 'Caja Fuerte Cerrada', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.contains('span', 'Sin caja abierta').should('be.visible');
    cy.contains('button', 'Abrir Caja').should('be.disabled');
  });
});
