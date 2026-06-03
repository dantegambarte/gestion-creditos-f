/**
 * SUITE REAL: Nueva Operación (Préstamo) contra backend real.
 *
 * Reglas:
 * - Usa login real
 * - No intercepta endpoints core de créditos/aprobaciones
 * - Verifica persistencia real consultando pendientes por API
 */

const ADMIN_NEW_OP_URL = '/admin/operations/new';

let latestSaleCreditId: string | null = null;

type CreditDetailApi = {
  customer_dni?: string;
  customerDni?: string;
};

/**
 * Inicia sesión ADMIN por UI y navega al wizard.
 */
const loginFreshAdminToNewOperation = (): void => {
  const dni = String(Cypress.env('realAdminDni') ?? '00000000').trim();
  const password = String(
    Cypress.env('realAdminPassword') ?? 'admin123',
  ).trim();

  cy.clearAllLocalStorage();
  cy.visit('/login');
  cy.get('[data-testid="input-dni"]', { timeout: 20000 }).clear().type(dni);
  cy.get('[data-testid="input-password"] input', { timeout: 20000 })
    .clear()
    .type(password);
  cy.get('[data-testid="btn-login"]').click();

  cy.location('pathname', { timeout: 20000 }).should('include', '/admin');
  cy.visit(ADMIN_NEW_OP_URL);
};

/**
 * Revalida sesión y asegura que el wizard de nueva operación quede cargado.
 */
const ensureNewOperationReady = (): void => {
  const recoverIfRedirectedToLogin = (): void => {
    cy.location('pathname', { timeout: 20000 }).then((pathname) => {
      if (pathname === '/login') {
        loginFreshAdminToNewOperation();
      }
    });
  };

  recoverIfRedirectedToLogin();
  cy.visit(ADMIN_NEW_OP_URL);
  recoverIfRedirectedToLogin();
  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-loan"]', { timeout: 40000 }).should('be.visible');
};

/**
 * Avanza hasta el paso de cliente seleccionando primero el tipo préstamo.
 * El paso de tipo avanza automáticamente al elegir tarjeta.
 */
const goToClientStepFromType = (): void => {
  cy.location('pathname', { timeout: 15000 }).then((pathname) => {
    if (pathname === '/login') {
      loginFreshAdminToNewOperation();
      cy.visit(ADMIN_NEW_OP_URL);
    }
  });

  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-loan"]', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.contains('Paso 2 de 5').should('be.visible');
  cy.contains('Buscar cliente').should('be.visible');
};

/**
 * Avanza al paso de cliente seleccionando tipo venta.
 */
const goToClientStepFromSaleType = (): void => {
  cy.location('pathname', { timeout: 15000 }).then((pathname) => {
    if (pathname === '/login') {
      loginFreshAdminToNewOperation();
      cy.visit(ADMIN_NEW_OP_URL);
    }
  });

  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-sale"]', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.contains('Paso 2 de 5').should('be.visible');
  cy.contains('Buscar cliente').should('be.visible');
};

/**
 * Selecciona el primer cliente activo disponible en la grilla.
 */
const pickFirstActiveClient = (): void => {
  cy.contains('Buscar cliente').should('be.visible');
  cy.contains('[data-cy^="client-card-"]', 'ACTIVO', { timeout: 20000 })
    .should('be.visible')
    .click();
  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 3 de 5').should('be.visible');
};

/**
 * Completa el paso de producto para una operación de préstamo.
 */
const fillLoanProductStep = (): void => {
  cy.contains('Tipo de operación').should('be.visible');
  cy.contains('Monto total').should('be.visible');

  cy.get('p-inputNumber[formControlName="totalAmount"] input')
    .clear()
    .type('65000')
    .blur();

  cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 })
    .should('not.be.disabled')
    .click();
  cy.contains('Paso 4 de 5').should('be.visible');
};

/**
 * Completa condiciones mínimas para habilitar confirmación.
 */
const fillLoanConditionsStep = (): void => {
  cy.contains('Configurar Plan de Pagos').should('be.visible');

  cy.get('[data-cy="ddl-installments"] .p-dropdown', { timeout: 15000 })
    .first()
    .click();
  cy.get('.p-dropdown-panel .p-dropdown-item').first().click();

  cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
  cy.contains('Paso 5 de 5').should('be.visible');
};

/**
 * Selecciona producto+variante y agrega una unidad en flujo venta.
 */
const addOneSaleUnitAndGoToConditions = (): void => {
  cy.contains('h3', 'Catálogo', { timeout: 20000 }).should('be.visible');

  cy.get('[data-cy^="sale-product-"]', { timeout: 20000 })
    .first()
    .click({ force: true });
  cy.get('[data-cy^="sale-variant-"]', { timeout: 15000 })
    .first()
    .click({ force: true });
  cy.get('[data-cy="sale-add-unit"]', { timeout: 20000 })
    .first()
    .click({ force: true });

  cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 })
    .should('not.be.disabled')
    .click();
  cy.contains('Paso 4 de 5').should('be.visible');
};

/**
 * Marca declaraciones requeridas y envía la operación a aprobación.
 */
const submitOperationForApproval = (): void => {
  cy.contains('Declaraciones y Autorizaciones')
    .scrollIntoView()
    .should('be.visible');

  // Usar el nuevo botón 'Marcar todas' y verificar estado.
  cy.get('[data-cy="btn-mark-all"]').click({ force: true });
  cy.get('[data-cy="chk-identity"] input').should('be.checked');
  cy.get('[data-cy="chk-conditions"] input').should('be.checked');
  cy.get('[data-cy="chk-disbursement"] input').should('be.checked');
  cy.get('[data-cy="chk-capacity"] input').should('be.checked');

  cy.get('[data-cy="btn-enviar-aprobacion"] button')
    .should('not.be.disabled')
    .click();
};

describe('Nueva Operación real — Admin', () => {
  it('crea préstamo real y retorna id en alta de crédito', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    ensureNewOperationReady();
    cy.intercept('POST', '/api/credits').as('createCredit');

    goToClientStepFromType();
    pickFirstActiveClient();
    fillLoanProductStep();
    fillLoanConditionsStep();
    submitOperationForApproval();

    cy.wait('@createCredit').then((interception) => {
      const createdId = interception.response?.body?.data?.id as
        | string
        | undefined;
      expect(createdId, 'id de crédito creado').to.be.a('string').and.not.be
        .empty;
      expect(interception.response?.statusCode, 'status de alta').to.eq(201);
    });

    cy.contains('.p-toast-message', 'Operación enviada', {
      timeout: 20000,
    }).should('be.visible');
    cy.url({ timeout: 20000 }).should('include', '/admin/operations');
  });

  it('préstamo: permite cambiar a fecha personalizada en condiciones', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    ensureNewOperationReady();

    goToClientStepFromType();
    pickFirstActiveClient();
    fillLoanProductStep();

    cy.contains(
      'Se calcula automáticamente según la frecuencia seleccionada.',
    ).should('exist');
    cy.contains('label', 'Fecha personalizada').click();
    cy.contains(
      'Se calcula automáticamente según la frecuencia seleccionada.',
    ).should('not.exist');
    cy.contains('Fecha de 1er pago').should('be.visible');
  });

  it('venta: permite configurar enganche en condiciones', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    ensureNewOperationReady();

    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.contains('label', 'Enganche').click({ force: true });
    cy.get('p-inputNumber[formControlName="downPayment"] input', {
      timeout: 15000,
    })
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type('5000')
      .blur();
    cy.contains('Anticipo').should('exist');
  });

  it('venta: permite configurar cuotas adelantadas en condiciones', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    ensureNewOperationReady();
    cy.intercept('GET', '**/api/product-units*').as('availableUnits');
    cy.intercept('POST', '/api/credits').as('createCreditWithAdvanced');

    goToClientStepFromSaleType();
    pickFirstActiveClient();
    cy.wait('@availableUnits');
    addOneSaleUnitAndGoToConditions();

    cy.get('[data-cy="ddl-installments"] .p-dropdown', { timeout: 15000 })
      .scrollIntoView()
      .click();
    cy.contains('.p-dropdown-item', '4 cuotas (Mensual)', { timeout: 10000 })
      .click({ force: true });

    cy.contains('label', 'Cuotas adelantadas').click({ force: true });
    cy.contains('Cantidad de cuotas adelantadas', { timeout: 15000 })
      .scrollIntoView()
      .should('be.visible');
    cy.get('p-inputNumber[formControlName="advancedInstallmentsCount"] input')
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type('2')
      .blur();

    cy.contains('label', 'Efectivo').click({ force: true });
    cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();
    cy.contains('Paso 5 de 5').should('be.visible');
    cy.contains('Cuotas adelantadas').should('exist');

    submitOperationForApproval();

    cy.wait('@createCreditWithAdvanced').then((interception) => {
      const requestBody = interception.request.body as Record<string, unknown>;
      const responseBody = interception.response?.body as Record<string, unknown>;

      const unitIds = requestBody['unit_ids'] as string[];
      const prepaidInstallments = Number(
        requestBody['prepaid_installments'] ?? 0,
      );
      const installmentsCount = Number(requestBody['installments_count'] ?? 0);

      console.log('advanced request', requestBody);
      console.log('advanced response', responseBody);

      expect(requestBody['customer_id']).to.be.a('string');
      expect(requestBody['type']).to.eq('SALE');
      expect(installmentsCount).to.be.greaterThan(1);
      expect(requestBody['payment_frequency']).to.be.oneOf([
        'WEEKLY',
        'BIWEEKLY',
        'MONTHLY',
      ]);
      expect(unitIds).to.be.an('array').and.not.be.empty;
      expect(unitIds[0], 'unidad tomada del runtime').to.be.a('string').and.not.be
        .empty;
      expect(prepaidInstallments).to.eq(2);
      expect(requestBody['prepaid_installments_method']).to.eq('CASH');

      if (interception.response?.statusCode !== 201) {
        throw new Error(
          `Alta SALE con cuotas adelantadas falló. status=${interception.response?.statusCode} body=${JSON.stringify(
            responseBody,
          )} request=${JSON.stringify(requestBody)}`,
        );
      }

      latestSaleCreditId = String(responseBody['data']?.['id'] ?? '');
      expect(latestSaleCreditId, 'id venta creada').to.not.equal('');
    });

    cy.url({ timeout: 20000 }).should('match', /\/admin\/(operations|approvals)$/);
  });

  it('venta: detalle y aprobación respetan cuotas ya definidas', () => {
    cy.viewport(1280, 720);
    expect(latestSaleCreditId, 'crédito SALE previo').to.be.a('string').and.not.be
      .empty;

    loginFreshAdminToNewOperation();
    cy.visit(`/admin/operations/${latestSaleCreditId}`);

    cy.contains('Detalles financieros', { timeout: 20000 }).should('be.visible');
    cy.contains('Cuotas adelantadas').should('be.visible');
    cy.contains('2 cuota(s)').should('be.visible');
    cy.contains('Monto adelantado').should('be.visible');
    cy.contains('Método adelanto').should('be.visible');

    cy.contains('button', 'Aprobar').click();
    cy.contains('Aprobar Crédito').should('be.visible');
    cy.contains(
      'Se aprobará la operación con las cuotas ya definidas en la pre-operación.',
    ).should('be.visible');
    cy.contains('Cantidad de cuotas definida').should('be.visible');
    cy.contains('4 cuota(s)').should('be.visible');
    cy.get('input[type="number"]').should('not.exist');
  });

  it('venta: approvals muestra cuotas adelantadas enriquecidas en modal', () => {
    cy.viewport(1280, 720);
    expect(latestSaleCreditId, 'crédito SALE previo').to.be.a('string').and.not.be
      .empty;

    cy.intercept('GET', `**/api/credits/${latestSaleCreditId}`).as(
      'getSaleApprovalDetail',
    );
    loginFreshAdminToNewOperation();

    cy.getAuthToken('ADMIN').then((token) => {
      cy.apiRequest('GET', `/credits/${latestSaleCreditId}`, null, token).then(
        (response) => {
          const detail = response.body.data as CreditDetailApi;
          const dni = detail.customer_dni ?? detail.customerDni;

          expect(response.status, 'detalle venta creada').to.eq(200);
          expect(dni, 'DNI de venta creada').to.be.a('string').and.not.be.empty;

          cy.visit('/admin/approvals');
          cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should(
            'be.visible',
          );
          cy.contains('tr', String(dni), { timeout: 20000 })
            .should('be.visible')
            .within(() => {
              cy.get('button').filter(':has(.pi-check)').click({ force: true });
            });
        },
      );
    });

    cy.wait('@getSaleApprovalDetail');
    cy.contains('Aprobar Operación').should('be.visible');
    cy.contains('Cuotas adelantadas: 2 cuota(s)').should('be.visible');
    cy.contains('Método: Efectivo').should('be.visible');
    cy.contains('Cantidad de cuotas definida').should('be.visible');
    cy.contains('4 cuota(s)').should('be.visible');
    cy.get('input[type="number"]').should('not.exist');
  });

  it('préstamo: aprobación mantiene input editable de cuotas', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    cy.visit('/admin/approvals');

    cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should(
      'be.visible',
    );
    cy.contains('tr', 'Préstamo', { timeout: 20000 })
      .first()
      .within(() => {
        cy.get('button').filter(':has(.pi-check)').click({ force: true });
      });

    cy.contains('Aprobar Operación').should('be.visible');
    cy.contains('Cantidad de cuotas (puede ajustarse)').should('be.visible');
    cy.get('input[type="number"]').should('be.visible');
  });
});
