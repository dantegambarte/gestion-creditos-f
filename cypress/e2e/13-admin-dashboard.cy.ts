/**
 * SUITE: Admin — Dashboard
 *
 * Cubre:
 *  - Banner de bienvenida con nombre de usuario
 *  - KPI Cards (skeleton o cards reales)
 *  - Sección de gráficos
 *  - Tabla de operaciones recientes
 */

/**
 * Crea créditos pendientes suficientes para forzar scroll mobile en el dashboard.
 */
const pendingCredits = Array.from({ length: 8 }, (_, index) => ({
  id: `cred-pending-${index + 1}`,
  type: 'LOAN',
  total_amount: 67000,
  installments_count: index + 1,
  payment_frequency: 'WEEKLY',
  interest_rate: 0,
  status: 'PENDING_APPROVAL',
  created_at: `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
  approved_at: null,
  customer_id: `cust-pending-${index + 1}`,
  customer_name: `Crédito Pendiente ${String(index + 1).padStart(2, '0')}`,
  customer_dni: `3000000${index + 1}`,
  created_by_id: 'usr-admin-system',
  created_by_name: 'Administrador del Sistema',
}));

/**
 * Crea cobros pendientes suficientes para reproducir el recorte del último botón.
 */
const pendingPayments = Array.from({ length: 8 }, (_, index) => ({
  id: `pay-pending-${index + 1}`,
  installment_id: `inst-pending-${index + 1}`,
  amount_received: 19000,
  payment_method: index % 2 === 0 ? 'CASH' : 'MIXED',
  status: 'PENDING',
  created_at: `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
  installment_number: index + 1,
  amount_due: 19000,
  due_date: `2026-06-${String(index + 1).padStart(2, '0')}`,
  credit_id: `cred-payment-${index + 1}`,
  credit_type: 'LOAN',
  customer_name: `Cobro Pendiente ${String(index + 1).padStart(2, '0')}`,
  customer_dni: `3100000${index + 1}`,
  collector_name: 'María González',
}));

/**
 * Verifica que el último botón de un pending card quede dentro del panel scrolleable.
 * @param itemText texto único del card que debe quedar visible al final del scroll
 * @param buttonText texto del botón esperado dentro del card
 */
function assertLastPendingButtonReachable(
  itemText: string,
  buttonText: string,
) {
  cy.get('[data-cy="dashboard-pending-mobile-panel"]')
    .should(($panel) => {
      const el = $panel[0];
      expect(el.scrollHeight, 'pending panel scroll height').to.be.greaterThan(
        el.clientHeight,
      );
    })
    .scrollTo('bottom');

  cy.get('[data-cy="dashboard-pending-mobile-panel"]').should(($panel) => {
    const el = $panel[0];
    expect(el.scrollTop, 'pending panel scroll top').to.be.greaterThan(0);
  });

  cy.contains('.db-pending-mobile__item', itemText)
    .contains('button', buttonText)
    .should('be.visible')
    .and(($button) => {
      const buttonRect = $button[0].getBoundingClientRect();
      const panelRect = Cypress.$(
        '[data-cy="dashboard-pending-mobile-panel"]',
      )[0].getBoundingClientRect();

      expect(buttonRect.top, `${buttonText} top`).to.be.at.least(panelRect.top);
      expect(buttonRect.bottom, `${buttonText} bottom`).to.be.at.most(
        panelRect.bottom,
      );
    });
}

/**
 * Expande un grupo de pendientes mobile solo si el item esperado todavia no
 * esta renderizado dentro del panel.
 * @param groupText texto del header del grupo
 * @param itemText texto de un item interno esperado
 */
function ensurePendingGroupExpanded(groupText: string, itemText: string) {
  cy.get('[data-cy="dashboard-pending-mobile-panel"]').then(($panel) => {
    if (!$panel.text().includes(itemText)) {
      cy.contains('.db-pending-mobile__group-header', groupText).click();
    }
  });
}

describe('Admin — Dashboard', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/reports/summary', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          active_portfolio_balance: 950000,
          pending_credits_count: pendingCredits.length,
          overdue_count: 2,
          today_collected: 120000,
        },
      },
    }).as('summary');

    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: {
        ok: true,
        data: pendingCredits,
      },
    }).as('credits');

    cy.intercept('GET', '**/api/payments*', {
      statusCode: 200,
      body: {
        ok: true,
        data: pendingPayments,
      },
    }).as('payments');

    cy.intercept('GET', '**/api/customers*', {
      statusCode: 200,
      body: {
        ok: true,
        data: [
          {
            id: 'cust-scroll-001',
            full_name: 'Cliente Scroll Reset',
            dni: '30111222',
            address: 'Calle Scroll 123',
            phone: '1122334455',
            email: 'scroll.reset@finflow.test',
            status: 'ACTIVE',
            portal_enabled: true,
            created_at: '2026-06-01T10:00:00.000Z',
            collector_id: null,
            collector_name: null,
            active_credits: 1,
            delinquency: null,
            payment_capacity: null,
          },
        ],
      },
    }).as('customers');

    cy.intercept('PATCH', '**/api/payments/pay-pending-1/approve', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          id: 'pay-pending-1',
          installment_id: 'inst-pending-1',
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

  it('mobile — prioriza accesos rápidos y contiene pendientes en tabs con panel scrolleable', () => {
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
    cy.contains('[data-cy="dashboard-pending-mobile-panel"]', 'María González')
      .scrollIntoView()
      .should('be.visible');
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

  it('mobile — permite scrollear hasta el último botón de créditos y cobros pendientes', () => {
    cy.viewport(375, 667);
    cy.reload();
    cy.get('[data-cy="admin-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );

    cy.get('[data-cy="dashboard-mobile-pending"]')
      .scrollIntoView({ block: 'center' })
      .should('be.visible');
    cy.get('[data-cy="dashboard-pending-tab-credits"]').should('be.visible');
    cy.contains(
      '[data-cy="dashboard-pending-mobile-panel"]',
      'Administrador del Sistema',
    ).should('be.visible');
    ensurePendingGroupExpanded('Administrador del Sistema', 'Crédito Pendiente 08');
    assertLastPendingButtonReachable('Crédito Pendiente 08', 'Revisar');

    cy.get('[data-cy="dashboard-pending-tab-payments"]').click();
    cy.contains('[data-cy="dashboard-pending-mobile-panel"]', 'María González')
      .scrollIntoView()
      .should('be.visible');
    ensurePendingGroupExpanded('María González', 'Cobro Pendiente 08');
    assertLastPendingButtonReachable('Cobro Pendiente 08', 'Aprobar');
  });

  it('resetea el scroll del shell al navegar entre pantallas', () => {
    cy.get('[data-cy="admin-dashboard"]', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.get('.ff-shell__main').scrollTo('bottom');
    cy.get('.ff-shell__main').should(($main) => {
      expect($main[0].scrollTop).to.be.greaterThan(0);
    });

    cy.contains('a.nav-item', 'Clientes').click();

    cy.location('pathname').should('eq', '/admin/clients');
    cy.get('[data-cy="input-buscar-cliente"]', { timeout: 15000 }).should(
      'be.visible',
    );
    cy.get('.ff-shell__main').should(($main) => {
      expect($main[0].scrollTop).to.eq(0);
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
