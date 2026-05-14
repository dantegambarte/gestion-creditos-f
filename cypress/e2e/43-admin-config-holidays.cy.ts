describe('Admin — Configuración — Feriados', () => {
  const baseHolidays = [
    {
      id: 'holiday-1',
      date: '2026-05-01',
      name: 'Día del trabajador',
      type: 'NATIONAL',
      affects_due_dates: true,
      active: true,
      repeats_annually: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'holiday-2',
      date: '2026-06-15',
      name: 'Puente local',
      type: 'EXTRAORDINARY',
      affects_due_dates: true,
      active: true,
      repeats_annually: false,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    cy.viewport(1280, 720);

    cy.intercept('GET', '**/api/holidays*', {
      statusCode: 200,
      body: { ok: true, data: baseHolidays },
    }).as('getHolidays');

    cy.loginAs('ADMIN', '/admin/config/holidays');
    cy.wait('@getHolidays');
  });

  it('renderiza el listado de feriados', () => {
    cy.contains('h2', 'Feriados').should('be.visible');
    cy.contains('Día del trabajador').should('be.visible');
    cy.contains('Puente local').should('be.visible');
  });

  it('no expande el calendario automáticamente al abrir el modal de alta', () => {
    cy.get('[data-cy="holidays-open-create-btn"]').click();
    cy.contains('.p-dialog .p-dialog-title', 'Nuevo feriado').should('be.visible');
    cy.get('body .p-datepicker').should('not.exist');
  });

  it('crea un feriado extraordinario y envía el payload correcto con recálculo', () => {
    cy.intercept('POST', '**/api/holidays', (req) => {
      expect(req.body).to.deep.equal({
        date: '2026-05-09',
        name: 'Feriado extraordinario',
        type: 'EXTRAORDINARY',
        affects_due_dates: true,
        active: true,
        repeats_annually: false,
        recalculateFutureInstallments: true,
      });

      req.reply({
        statusCode: 201,
        body: {
          ok: true,
          data: {
            holiday: {
              id: 'holiday-3',
              date: '2026-05-09',
              name: 'Feriado extraordinario',
              type: 'EXTRAORDINARY',
              affects_due_dates: true,
              active: true,
              repeats_annually: false,
              created_at: '2026-07-01T00:00:00Z',
              updated_at: '2026-07-01T00:00:00Z',
            },
            recalculated_installments: 2,
          },
          message: 'Feriado registrado correctamente.',
        },
      });
    }).as('createHoliday');

    cy.get('[data-cy="holidays-open-create-btn"]').click();
    cy.get('#create-holiday-date')
      .parents('.p-calendar')
      .find('button.p-datepicker-trigger')
      .click();
    cy.get('body .p-datepicker-calendar td:not(.p-disabled) span')
      .contains(/^9$/)
      .click();
    cy.get('[data-cy="holidays-create-name"]').type('Feriado extraordinario');
    cy.get('p-dropdown').first().click();
    cy.contains('.p-dropdown-item', 'Extraordinario').click();
    cy.contains('Recalcular cuotas futuras').should('be.visible');
    cy.get('[data-cy="holidays-create-recalculate-checkbox"] .p-checkbox-box').click();
    cy.get('[data-cy="holidays-submit-create-btn"]').click();

    cy.wait('@createHoliday');
    cy.contains('Feriado creado').should('be.visible');
    cy.contains('Se recalcularon 2 cuota(s) futura(s).').should('be.visible');
    cy.contains('Feriado extraordinario').should('be.visible');
  });

  it('edita un feriado existente', () => {
    cy.intercept('PUT', '**/api/holidays/holiday-1', (req) => {
      expect(req.body.name).to.equal('Día del trabajador actualizado');
      req.reply({
        statusCode: 200,
        body: {
          ok: true,
          data: {
            ...baseHolidays[0],
            name: 'Día del trabajador actualizado',
          },
          message: 'Feriado actualizado.',
        },
      });
    }).as('updateHoliday');

    cy.contains('tr', 'Día del trabajador').contains('Editar').click();
    cy.get('[data-cy="holidays-edit-name"]').clear().type('Día del trabajador actualizado');
    cy.get('[data-cy="holidays-submit-edit-btn"]').click();

    cy.wait('@updateHoliday');
    cy.contains('Feriado actualizado').should('be.visible');
    cy.contains('Día del trabajador actualizado').should('be.visible');
  });

  it('muestra la vista previa de duplicación y luego confirma la duplicación', () => {
    cy.intercept('POST', '**/api/holidays/duplicate-year/preview', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          sourceYear: 2026,
          targetYear: 2027,
          eligibleCount: 2,
          toCreateCount: 1,
          skippedCount: 1,
          conflictsCount: 0,
          invalidDatesCount: 0,
          nonRecurringCount: 1,
          toCreate: [
            {
              sourceDate: '2026-05-01',
              targetDate: '2027-05-01',
              type: 'NATIONAL',
              name: 'Día del trabajador',
            },
          ],
          skipped: [
            {
              sourceDate: '2026-06-15',
              targetDate: null,
              type: 'EXTRAORDINARY',
              name: 'Puente local',
              reason: 'not_recurring_annual',
            },
          ],
        },
      },
    }).as('previewDuplicate');

    cy.intercept('POST', '**/api/holidays/duplicate-year', {
      statusCode: 200,
      body: {
        ok: true,
        data: {
          sourceYear: 2026,
          targetYear: 2027,
          createdCount: 1,
          skippedCount: 1,
          conflictsCount: 0,
          created: [],
          skipped: [],
        },
      },
    }).as('confirmDuplicate');

    cy.get('[data-cy="holidays-duplicate-source-year"]').clear().type('2026');
    cy.get('[data-cy="holidays-preview-duplicate-btn"]').click();

    cy.wait('@previewDuplicate');
    cy.contains('.p-dialog .p-dialog-title', 'Vista previa de duplicación anual').should('be.visible');
    cy.contains('Se crearán').should('be.visible');
    cy.contains('No marcado como anual repetible').should('be.visible');
    cy.get('[data-cy="holidays-confirm-duplicate-btn"]').click();

    cy.wait('@confirmDuplicate');
    cy.wait('@getHolidays');
    cy.contains('Duplicación completada').should('be.visible');
  });

  it('muestra advertencia si el año del preview es inválido', () => {
    cy.get('[data-cy="holidays-duplicate-source-year"]').clear().type('1999');
    cy.get('[data-cy="holidays-preview-duplicate-btn"]').click();
    cy.contains('Año inválido').should('be.visible');
  });
});
