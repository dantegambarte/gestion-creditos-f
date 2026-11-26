/**
 * SUITE: Liquidaciones — Regresión LI-01, LI-02, LI-03
 *
 * LI-01: Guardar sueldo fijo actualiza la tabla sin refresh manual.
 * LI-02: Editor de sueldo se limpia después de guardar.
 * LI-03: Dialog de liquidación muestra el detalle de ventas individuales.
 */

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_COLLECTOR_USER = {
  id: 'col-001',
  full_name: 'María González',
  email: 'cobrador@test.com',
  dni: '22222222',
  role: 'COLLECTOR',
  status: 'ACTIVE',
  created_at: '2026-01-01T00:00:00Z',
  last_login_at: null,
  is_temp_password: false,
  failed_attempts: 0,
  locked_at: null,
};

const MOCK_SUMMARY_INITIAL = {
  ok: true,
  data: {
    employees: [
      {
        user_id: 'col-001',
        full_name: 'María González',
        role: 'COLLECTOR',
        commissions_total: 50000,
        earliest_week: '2026-05-19',
        latest_week: '2026-05-25',
        salary_amount: 20000,
        total_net: 70000,
      },
    ],
  },
};

const MOCK_SUMMARY_AFTER_SAVE = {
  ok: true,
  data: {
    employees: [
      {
        user_id: 'col-001',
        full_name: 'María González',
        role: 'COLLECTOR',
        commissions_total: 50000,
        earliest_week: '2026-05-19',
        latest_week: '2026-05-25',
        salary_amount: 35000,
        total_net: 85000,
      },
    ],
  },
};

const MOCK_LIQUIDATIONS = { ok: true, data: [] };

const MOCK_SALARY_CURRENT = {
  ok: true,
  data: { user_id: 'col-001', weekly_amount: 20000, active: true },
};

const MOCK_SALARY_SAVED = {
  ok: true,
  data: { user_id: 'col-001', weekly_amount: 35000, active: true },
};

const MOCK_COMMISSIONS_PENDING = {
  ok: true,
  data: [
    {
      id: 'com-001',
      user_id: 'col-001',
      credit_id: 'cred-001',
      amount: 8000,
      status: 'PENDING',
      week_start: '2026-05-19',
      week_end: '2026-05-25',
      created_at: '2026-05-20T00:00:00Z',
      user_name: 'María González',
      user_role: 'COLLECTOR',
      credit_type: 'SALE',
      credit_amount: 100000,
      customer_name: 'Luciana Ramírez',
    },
    {
      id: 'com-002',
      user_id: 'col-001',
      credit_id: 'cred-002',
      amount: 12000,
      status: 'PENDING',
      week_start: '2026-05-19',
      week_end: '2026-05-25',
      created_at: '2026-05-21T00:00:00Z',
      user_name: 'María González',
      user_role: 'COLLECTOR',
      credit_type: 'SALE',
      credit_amount: 150000,
      customer_name: 'Diego Fernández',
    },
  ],
};

const MOCK_CASH_OPEN = {
  ok: true,
  data: { isClosed: false, isOpen: true },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Intercepta todos los endpoints base del módulo de liquidaciones.
 * weekly-summary retorna datos distintos en 1era vs 2da llamada (para LI-01).
 */
function setupBaseIntercepts(summarySecondCall = MOCK_SUMMARY_INITIAL): void {
  let summaryCount = 0;

  cy.intercept('GET', '**/api/commissions/weekly-summary', (req) => {
    summaryCount++;
    req.reply({
      statusCode: 200,
      body: summaryCount === 1 ? MOCK_SUMMARY_INITIAL : summarySecondCall,
    });
  }).as('getSummary');

  cy.intercept('GET', '**/api/commissions/liquidations*', {
    statusCode: 200,
    body: MOCK_LIQUIDATIONS,
  }).as('getLiquidations');

  cy.intercept('GET', '**/api/users*', {
    statusCode: 200,
    body: { ok: true, data: [MOCK_COLLECTOR_USER] },
  }).as('getUsers');

  cy.intercept('GET', '**/api/cash-register/**', {
    statusCode: 200,
    body: MOCK_CASH_OPEN,
  }).as('getCashRegister');
}

// ── LI-01 + LI-02: Sueldo Fijo ───────────────────────────────────────────────

describe('LI-01/LI-02 — Sueldo Fijo: actualización y limpieza del editor (Admin)', () => {
  beforeEach(() => {
    setupBaseIntercepts(MOCK_SUMMARY_AFTER_SAVE);

    cy.intercept('GET', '**/api/commissions/salary/*', {
      statusCode: 200,
      body: MOCK_SALARY_CURRENT,
    }).as('getSalary');

    cy.intercept('PUT', '**/api/commissions/salary/*', {
      statusCode: 200,
      body: MOCK_SALARY_SAVED,
    }).as('putSalary');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/commissions');
    cy.wait('@getSummary');
    cy.wait('@getLiquidations');
  });

  it('LI-01 — la tabla de cobradores refleja el nuevo sueldo sin refresh manual', () => {
    // Ir a tab Sueldo fijo
    cy.contains('button', 'Sueldo fijo').click();

    // Abrir editor haciendo click en "Editar" del cobrador
    cy.contains('td button', 'Editar').click();
    cy.wait('@getSalary');

    // El inputNumber del editor debe aparecer
    cy.get('p-inputNumber input').should('be.visible');

    // Limpiar y escribir el nuevo sueldo (35000)
    cy.get('p-inputNumber input').clear().type('35000');

    // Guardar
    cy.contains('p-button[label="Guardar"] button, button', /^Guardar$/).click();
    cy.wait('@putSalary');

    // loadSummary() se llama → segunda petición weekly-summary devuelve AFTER
    cy.wait('@getSummary');

    // La tabla debe mostrar el nuevo monto sin reload
    cy.contains('td', /\$\s*35\.000|35000|35,000/).should('exist');
  });

  it('LI-02 — el editor de sueldo queda limpio después de guardar', () => {
    // Ir a tab Sueldo fijo
    cy.contains('button', 'Sueldo fijo').click();

    // Abrir editor
    cy.contains('td button', 'Editar').click();
    cy.wait('@getSalary');

    // El editor tiene el cobrador seleccionado y el input visible
    cy.get('p-inputNumber input').should('be.visible');

    // Guardar
    cy.get('p-inputNumber input').clear().type('35000');
    cy.contains('p-button[label="Guardar"] button, button', /^Guardar$/).click();
    cy.wait('@putSalary');
    cy.wait('@getSummary');

    // Después del save: el editor de sueldo (p-inputNumber) debe desaparecer
    // porque selectedCollectorId y currentSalary se resetearon a null
    cy.get('p-inputNumber input').should('not.exist');

    // El dropdown del editor debe mostrar el placeholder (sin cobrador seleccionado)
    cy.contains('Seleccioná un cobrador').should('be.visible');
  });
});

// ── LI-03: Dialog de liquidación muestra ventas ───────────────────────────────

describe('LI-03 — Dialog de liquidación muestra el detalle de ventas (Admin)', () => {
  beforeEach(() => {
    setupBaseIntercepts();

    cy.intercept('GET', '**/api/commissions*', (req) => {
      // Distinguir getCommissions (tiene user_id param) de weekly-summary y liquidations
      const url = req.url;
      if (url.includes('weekly-summary') || url.includes('liquidations')) {
        req.continue();
        return;
      }
      req.reply({ statusCode: 200, body: MOCK_COMMISSIONS_PENDING });
    }).as('getCommissionsList');

    cy.viewport(1280, 720);
    cy.loginAs('ADMIN', '/admin/commissions');
    cy.wait('@getSummary');
    cy.wait('@getLiquidations');
  });

  it('LI-03 — abre el dialog con tabla de ventas al hacer click en "Liquidar"', () => {
    // Tab Resumen semanal es el default
    cy.contains('button', 'Liquidar').should('exist').click();

    // Esperar la carga de comisiones
    cy.wait('@getCommissionsList');

    // El host <p-dialog> siempre tiene 0×0; el contenido visual está en .p-dialog-content
    cy.contains('Liquidar empleado').should('be.visible');
  });

  it('LI-03 — el dialog muestra la tabla con las ventas individuales del empleado', () => {
    cy.contains('button', 'Liquidar').click();
    cy.wait('@getCommissionsList');

    // Tabla de ventas incluidas
    cy.contains('Ventas incluidas').should('be.visible');

    // Encabezados de columna
    cy.get('p-dialog table').within(() => {
      cy.contains('th', 'Cliente').should('exist');
      cy.contains('th', /Venta|Monto/).should('exist');
      cy.contains('th', /Comisión/).should('exist');
    });

    // Filas de datos
    cy.contains('td', 'Luciana Ramírez').should('exist');
    cy.contains('td', 'Diego Fernández').should('exist');
  });

  it('LI-03 — muestra "Sin ventas pendientes." si no hay comisiones', () => {
    // Re-interceptar con lista vacía
    cy.intercept('GET', '**/api/commissions*', (req) => {
      if (req.url.includes('weekly-summary') || req.url.includes('liquidations')) {
        req.continue();
        return;
      }
      req.reply({ statusCode: 200, body: { ok: true, data: [] } });
    }).as('getEmptyCommissions');

    cy.contains('button', 'Liquidar').click();
    cy.wait('@getEmptyCommissions');

    cy.contains('Sin ventas pendientes.').should('be.visible');
  });
});
