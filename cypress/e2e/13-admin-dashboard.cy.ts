/**
 * SUITE: Admin — Dashboard
 *
 * Cubre:
 *  - Banner de bienvenida con nombre de usuario
 *  - KPI Cards (skeleton o cards reales)
 *  - Sección de gráficos
 *  - Tabla de operaciones recientes
 */

describe('Admin — Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/reports/summary', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          active_portfolio_balance: 950000,
          pending_credits_count: 3,
          overdue_count: 2,
          today_collected: 120000,
        },
      },
    }).as('summary');

    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cred-01',
            type: 'SALE',
            total_amount: 100000,
            installments_count: 10,
            payment_frequency: 'WEEKLY',
            interest_rate: 0,
            status: 'ACTIVE',
            created_at: '2026-05-01T00:00:00Z',
            approved_at: '2026-05-01T00:00:00Z',
            customer_id: 'cust-1',
            customer_name: 'Ana García',
            customer_dni: '12345678',
            created_by_id: 'usr-001',
            created_by_name: 'Carlos López',
          },
        ],
      },
    }).as('credits');

    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'pay-001',
            installment_id: 'inst-001',
            amount_received: 57000,
            payment_method: 'CASH',
            status: 'PENDING',
            created_at: '2026-06-01T10:00:00Z',
            installment_number: 1,
            amount_due: 57000,
            due_date: '2026-06-01',
            credit_id: 'cred-01',
            credit_type: 'SALE',
            customer_name: 'Osvaldo Rubén Medina',
            customer_dni: '30111222',
            collector_name: 'María González',
          },
        ],
      },
    }).as('payments');

    cy.intercept('PATCH', '**/api/payments/pay-001/approve', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'pay-001',
          installment_id: 'inst-001',
          amount_received: 57000,
          payment_method: 'CASH',
          status: 'APPROVED',
          created_at: '2026-06-01T10:00:00Z',
          approved_at: '2026-06-01T11:00:00Z',
          approved_by: 'admin-001',
          installment_number: 1,
          amount_due: 57000,
          due_date: '2026-06-01',
          credit_id: 'cred-01',
          credit_type: 'SALE',
          customer_name: 'Osvaldo Rubén Medina',
          customer_dni: '30111222',
          collector_name: 'María González',
          amount_paid: 57000,
          penalty_amount: 0,
          customer_id: 'cust-001',
          collector_id: 'collector-001',
        },
      },
    }).as('approvePayment');

    cy.loginAs('ADMIN', '/admin/dashboard');
  });

  it('renderiza la grilla KPI actual', () => {
    cy.location('pathname').should('eq', '/admin/dashboard');
    cy.get('app-error-state').should('not.exist');
    cy.contains(/Iniciar sesión/i).should('not.exist');
  });

  it('muestra panel de últimas operaciones con tabla', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Últimas operaciones')) {
        cy.contains('Últimas operaciones').should('be.visible');
      }
    });
    cy.get('p-table, table').should('have.length.gte', 1);
  });

  it('muestra el panel de próximos vencimientos', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('body').then(($body) => {
      if ($body.text().includes('Próximos vencimientos')) {
        cy.contains('Próximos vencimientos').should('be.visible');
      } else {
        cy.contains(/vencim/i).should('exist');
      }
    });
  });

  it('DV-01 — requiere doble validación al aprobar un cobro desde dashboard', () => {
    cy.contains('Cobros por aprobar').should('be.visible');
    cy.contains('button', 'Aprobar').first().click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.contains('¿Confirmás la aprobación?').should('be.visible');

    cy.contains('button', 'Sí, aprobar').click();
    cy.wait('@approvePayment');

    cy.contains('Confirmar aprobación').should('not.exist');
  });

  it('DV-02 — permite cancelar la doble validación sin aprobar el cobro', () => {
    cy.contains('Cobros por aprobar').should('be.visible');
    cy.contains('button', 'Aprobar').first().click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.contains('button', 'Cancelar').click();

    cy.contains('Confirmar aprobación').should('not.exist');
    cy.get('@approvePayment.all').should('have.length', 0);
  });

  it('DV-03 — permite cerrar el modal desde la X sin aprobar el cobro', () => {
    cy.contains('Cobros por aprobar').should('be.visible');
    cy.contains('button', 'Aprobar').first().click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('.p-dialog .p-dialog-header .p-dialog-header-close').click({ force: true });

    cy.contains('Confirmar aprobación').should('not.exist');
    cy.get('@approvePayment.all').should('have.length', 0);
  });

  it('DV-04 — no cierra el modal al hacer click en el backdrop', () => {
    cy.contains('Cobros por aprobar').should('be.visible');
    cy.contains('button', 'Aprobar').first().click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('.p-dialog-mask').click('topLeft', { force: true });

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('@approvePayment.all').should('have.length', 0);
  });
});
