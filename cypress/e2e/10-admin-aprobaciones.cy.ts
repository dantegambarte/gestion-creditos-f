/**
 * SUITE: Admin — Aprobaciones de Créditos
 *
 * Cubre:
 *  - Render y estructura del módulo
 *  - Buscador y filtros sobre datos reales mockeados
 *  - Acciones de aprobar / rechazar
 */

const PENDING_APPROVALS = [
  {
    id: 'cred-001',
    type: 'SALE',
    total_amount: 150000,
    installments_count: 12,
    payment_frequency: 'MONTHLY',
    interest_rate: 0.12,
    status: 'PENDING_APPROVAL',
    created_at: '2026-05-01T10:00:00Z',
    approved_at: null,
    customer_id: 'cus-001',
    customer_name: 'Ana Garcia',
    customer_dni: '30111222',
    created_by_id: 'usr-002',
    created_by_name: 'Maria Sanchez',
  },
  {
    id: 'cred-002',
    type: 'LOAN',
    total_amount: 98000,
    installments_count: 8,
    payment_frequency: 'WEEKLY',
    interest_rate: 0.1,
    status: 'PENDING_APPROVAL',
    created_at: '2026-05-03T14:30:00Z',
    approved_at: null,
    customer_id: 'cus-002',
    customer_name: 'Bruno Diaz',
    customer_dni: '28999111',
    created_by_id: 'usr-003',
    created_by_name: 'Juan Pedraza',
  },
];

describe('Admin — Aprobaciones de Créditos', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/credits*', {
      statusCode: 200,
      body: { ok: true, data: PENDING_APPROVALS },
    }).as('listApprovals');

    cy.intercept('PATCH', '**/api/credits/*/approve', {
      statusCode: 200,
      body: { ok: true, data: PENDING_APPROVALS[0] },
    }).as('approveCredit');

    cy.intercept('PATCH', '**/api/credits/*/reject', {
      statusCode: 200,
      body: { ok: true, data: null },
    }).as('rejectCredit');

    cy.loginAs('ADMIN', '/admin/approvals');
    cy.wait('@listApprovals');
    cy.get('p-table').should('be.visible');
  });

  it('muestra el título y descripción del módulo', () => {
    cy.contains('h1', 'Aprobación de Operaciones').should('be.visible');
    cy.contains('Revisa y valida las solicitudes entrantes').should('be.visible');
  });

  it('renderiza tabla con columnas esperadas y badge de pendientes', () => {
    const cols = ['Fecha', 'Cliente / DNI', 'Operación', 'Monto', 'Vendedor', 'Estado', 'Acciones'];
    cols.forEach((col) => cy.get('p-table thead th').contains(col).should('be.visible'));
    cy.get('.p-badge').should('contain.text', '2');
    cy.get('p-table tbody tr').should('have.length', 2);
  });

  it('filtra por buscador', () => {
    cy.get('input[placeholder*="Buscar por cliente o vendedor"]').should('not.be.disabled').type('ana');
    cy.get('p-table tbody tr').should('have.length', 1);
    cy.contains('p-table tbody tr td', 'Ana Garcia').should('be.visible');
  });

  it('permite abrir y cerrar flujo de aprobar', () => {
    cy.get('p-table tbody tr').first().find('button').eq(0).click();
    cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación').should('be.visible');
    cy.contains('.p-dialog button', 'Confirmar Aprobación').click();
    cy.wait('@approveCredit');
  });

  it('permite abrir y confirmar flujo de rechazar', () => {
    cy.get('p-table tbody tr').first().find('button').eq(1).click();
    cy.contains('.p-dialog .p-dialog-title', 'Rechazar Operación').should('be.visible');
    cy.get('.p-dialog textarea').type('No cumple politica minima');
    cy.contains('.p-dialog button', 'Rechazar Operación').click();
    cy.wait('@rejectCredit');
  });
});
