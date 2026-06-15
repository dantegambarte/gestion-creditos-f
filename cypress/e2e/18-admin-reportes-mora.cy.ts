/**
 * SUITE: Admin — Reportes y Morosidad (real backend)
 */

describe('Admin — Reportes', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/reports');
  });

  it('renderiza sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/reports');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra al menos 2 tabs de navegación', () => {
    cy.get('button.ff-tab').should('have.length.gte', 2);
  });

  it('la primera tab está activa con estilo resaltado', () => {
    cy.get('button.ff-tab--active').should('exist');
  });

  it('muestra contenido financiero (montos o skeletons)', () => {
    cy.get('app-error-state').should('not.exist');
    cy.get('p-card, app-loading-state, p-skeleton, p-table').should('exist');
  });

  it('se puede navegar entre tabs sin error', () => {
    cy.get('button.ff-tab').eq(1).click({ force: true });
    cy.get('app-error-state').should('not.exist');
  });
});

describe('Admin — Reportes — Movimientos de caja', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/reports');
    cy.contains('button.ff-tab', 'Movimientos de caja').click();
  });

  it('renderiza la tab sin error', () => {
    cy.get('app-cash-movements-report').should('exist');
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra el selector de rango de fechas y el botón de búsqueda', () => {
    cy.get('app-cash-movements-report').within(() => {
      cy.get('p-calendar').should('have.length', 2);
      cy.contains('button', 'Buscar jornadas').should('exist');
    });
  });

  it('al buscar, muestra jornadas, estado vacío o reporte sin romper', () => {
    cy.get('app-cash-movements-report')
      .find('button')
      .contains('Buscar jornadas')
      .click();
    cy.get('app-cash-movements-report')
      .find('app-loading-state')
      .should('not.exist');
    cy.get('app-cash-movements-report')
      .find('app-error-state')
      .should('not.exist');

    cy.get('app-cash-movements-report').then(($el) => {
      const hasDropdown = $el.find('p-dropdown').length > 0;
      const hasEmptyMessage = $el
        .text()
        .includes('No hay jornadas en el período seleccionado');
      expect(hasDropdown || hasEmptyMessage).to.be.true;
    });
  });

  it('si hay una jornada disponible, muestra el resumen de movimientos o el estado vacío de la caja', () => {
    cy.get('app-cash-movements-report')
      .find('button')
      .contains('Buscar jornadas')
      .click();

    cy.get('app-cash-movements-report').then(($el) => {
      if ($el.find('p-dropdown').length === 0) {
        cy.log(
          'Sin jornadas en el período por defecto, se omite la verificación del reporte.',
        );
        return;
      }

      cy.get('app-cash-movements-report').find('.p-dropdown').click();
      cy.get('.p-dropdown-panel .p-dropdown-item').first().click();

      cy.get('app-cash-movements-report')
        .find('app-error-state')
        .should('not.exist');
      cy.get('app-cash-movements-report').should(($report) => {
        const text = $report.text();
        const hasSummary =
          text.includes('Movimientos') && text.includes('Cobros');
        const hasEmptySession = text.includes(
          'Esta jornada no tiene una caja registrada',
        );
        const hasEmptyReport = text.includes(
          'Esta caja no tiene movimientos registrados',
        );
        expect(hasSummary || hasEmptySession || hasEmptyReport).to.be.true;
      });
    });
  });
});

describe('Admin — Morosidad', () => {
  beforeEach(() => {
    cy.viewport(1280, 720);
    cy.loginReal('ADMIN', '/admin/delinquency');
  });

  it('renderiza sin error', () => {
    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      '/admin/delinquency',
    );
    cy.get('app-error-state').should('not.exist');
  });

  it('muestra KPI cards de mora (skeleton o reales)', () => {
    cy.get('p-card').should('exist');
  });

  it('muestra métricas o estados visuales sin romper', () => {
    cy.get('p-card, app-loading-state, p-skeleton').should('exist');
  });

  it('muestra grilla o estado de carga', () => {
    cy.get('p-table, app-loading-state, p-skeleton').should('exist');
  });
});
