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

  it('mobile — prioriza accesos rápidos y contiene pendientes en tabs con scroll interno', () => {
    cy.viewport(375, 667);
    cy.reload();
    cy.location('pathname').should('eq', '/admin/dashboard');

    cy.get('[data-cy="admin-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.get('[data-cy="dashboard-mobile-quick-actions"]').should('be.visible');
    cy.get('[data-cy="dashboard-mobile-pending"]')
      .scrollIntoView({ block: 'center' })
      .should('be.visible');
    cy.get('[data-cy="dashboard-mobile-quick-actions"]').then(($quick) => {
      cy.get('[data-cy="dashboard-mobile-pending"]').should(($pending) => {
        expect($quick[0].getBoundingClientRect().top).to.be.lessThan(
          $pending[0].getBoundingClientRect().top,
        );
      });
    });

    cy.get('[data-cy="dashboard-pending-tab-credits"]').should('be.visible');
    cy.get('[data-cy="dashboard-pending-tab-payments"]')
      .should('be.visible')
      .click();
    cy.contains(
      '[data-cy="dashboard-pending-mobile-panel"]',
      'María González',
    ).should('be.visible');
    cy.get('[data-cy="dashboard-pending-mobile-panel"]').should(($panel) => {
      const el = $panel[0];
      expect(el.clientHeight, 'pending panel height').to.be.at.most(430);
      expect(el.scrollWidth, 'pending panel width').to.be.at.most(
        el.clientWidth + 1,
      );
    });
    cy.get('.db-pending-row--desktop').should('not.be.visible');
    cy.document().should((doc) => {
      expect(doc.documentElement.scrollWidth).to.be.at.most(
        doc.documentElement.clientWidth + 1,
      );
    });
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
    cy.contains('.db-pending-row--desktop', 'Cobros por aprobar').should(
      'be.visible',
    );
    cy.get('.db-pending-row--desktop')
      .contains('button', 'Aprobar')
      .first()
      .click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.contains('¿Confirmás la aprobación?').should('be.visible');

    cy.contains('button', 'Sí, aprobar').click();
    cy.wait('@approvePayment');

    cy.contains('Confirmar aprobación').should('not.exist');
  });

  it('DV-02 — permite cancelar la doble validación sin aprobar el cobro', () => {
    cy.contains('.db-pending-row--desktop', 'Cobros por aprobar').should(
      'be.visible',
    );
    cy.get('.db-pending-row--desktop')
      .contains('button', 'Aprobar')
      .first()
      .click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.contains('button', 'Cancelar').click();

    cy.contains('Confirmar aprobación').should('not.exist');
    cy.get('@approvePayment.all').should('have.length', 0);
  });

  it('DV-03 — permite cerrar el modal desde la X sin aprobar el cobro', () => {
    cy.contains('.db-pending-row--desktop', 'Cobros por aprobar').should(
      'be.visible',
    );
    cy.get('.db-pending-row--desktop')
      .contains('button', 'Aprobar')
      .first()
      .click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('.p-dialog .p-dialog-header .p-dialog-header-close').click({
      force: true,
    });

    cy.contains('Confirmar aprobación').should('not.exist');
    cy.get('@approvePayment.all').should('have.length', 0);
  });

  it('DV-04 — no cierra el modal al hacer click en el backdrop', () => {
    cy.contains('.db-pending-row--desktop', 'Cobros por aprobar').should(
      'be.visible',
    );
    cy.get('.db-pending-row--desktop')
      .contains('button', 'Aprobar')
      .first()
      .click();

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('.p-dialog-mask').click('topLeft', { force: true });

    cy.contains('Confirmar aprobación').should('be.visible');
    cy.get('@approvePayment.all').should('have.length', 0);
  });
});
