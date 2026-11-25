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
 * Inicia sesión ADMIN real (sesión validada contra /auth/me) y navega al destino.
 * No encadenar otro cy.visit inmediato: abortaría el GET /auth/me en vuelo.
 * @param destination - ruta a abrir (por defecto, el wizard)
 */
const loginFreshAdminToNewOperation = (destination: string = ADMIN_NEW_OP_URL): void => {
  cy.loginReal('ADMIN', destination);
};

/**
 * Asegura que el wizard de nueva operación quede cargado en el paso de tipo.
 */
const ensureNewOperationReady = (): void => {
  // loginReal ya navega al wizard: una segunda visita aborta el GET /auth/me
  // en vuelo y la app limpia la sesión (restoreSession trata cualquier error
  // como sesión inválida).
  cy.location('pathname', { timeout: 20000 }).then((pathname) => {
    if (pathname !== ADMIN_NEW_OP_URL) cy.visit(ADMIN_NEW_OP_URL);
  });
  cy.location('pathname', { timeout: 20000 }).should('eq', ADMIN_NEW_OP_URL);
  cy.get('[data-cy="btn-type-loan"]', { timeout: 40000 }).should('be.visible');
};

/**
 * Avanza hasta el paso de cliente seleccionando primero el tipo préstamo.
 * El paso de tipo avanza automáticamente al elegir tarjeta.
 */
const goToClientStepFromType = (): void => {
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
  cy.get('[data-cy="ddl-installments"]', { timeout: 15000 }).first().should('be.visible');

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

/**
 * Créditos creados por esta suite. Se rechazan en `after` (pase o falle cada
 * test) para liberar unidades y no dejar pendientes en la base compartida.
 */
const createdCreditIds: string[] = [];

let latestLoanCreditId: string | null = null;

/**
 * Lee el DNI del cliente de un crédito real por API.
 * @param creditId - id del crédito
 * @returns DNI del cliente
 */
const getCreditCustomerDni = (creditId: string): Cypress.Chainable<string> =>
  cy.getAuthToken('ADMIN').then((token) =>
    cy.apiRequest('GET', `/credits/${creditId}`, null, token).then((response) => {
      const detail = response.body.data as CreditDetailApi;
      const dni = detail.customer_dni ?? detail.customerDni;
      expect(response.status, 'detalle del crédito').to.eq(200);
      expect(dni, 'DNI del crédito').to.be.a('string').and.not.be.empty;
      return String(dni);
    }),
  );

/**
 * Crea un préstamo real por el wizard y guarda su id para limpieza.
 */
const createLoanThroughWizard = (): void => {
  loginFreshAdminToNewOperation();
  ensureNewOperationReady();
  cy.intercept('POST', '/api/credits').as('createCredit');

  goToClientStepFromType();
  pickFirstActiveClient();
  fillLoanProductStep();
  fillLoanConditionsStep();
  submitOperationForApproval();

  cy.wait('@createCredit').then((interception) => {
    const createdId = interception.response?.body?.data?.id as string | undefined;
    expect(interception.response?.statusCode, 'status de alta').to.eq(201);
    expect(createdId, 'id de crédito creado').to.be.a('string').and.not.be.empty;
    createdCreditIds.push(String(createdId));
    latestLoanCreditId = String(createdId);
    // Tras el alta la app abre el detalle del crédito creado.
    cy.location('pathname', { timeout: 20000 }).should(
      'eq',
      `/admin/operations/${createdId}`,
    );
  });
};

/**
 * Crea una venta real de 4 cuotas mensuales con 2 adelantadas en efectivo,
 * validando el payload enviado, y guarda su id para limpieza.
 */
const createSaleWithAdvancedInstallments = (): void => {
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
  cy.contains('.p-dropdown-item', '4 cuotas (Mensual)', { timeout: 10000 }).click({
    force: true,
  });

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

    expect(requestBody['customer_id']).to.be.a('string');
    expect(requestBody['type']).to.eq('SALE');
    expect(Number(requestBody['installments_count'] ?? 0)).to.be.greaterThan(1);
    expect(requestBody['payment_frequency']).to.be.oneOf(['WEEKLY', 'BIWEEKLY', 'MONTHLY']);
    expect(unitIds).to.be.an('array').and.not.be.empty;
    expect(unitIds[0], 'unidad tomada del runtime').to.be.a('string').and.not.be.empty;
    expect(Number(requestBody['prepaid_installments'] ?? 0)).to.eq(2);
    expect(requestBody['prepaid_installments_method']).to.eq('CASH');

    if (interception.response?.statusCode !== 201) {
      throw new Error(
        `Alta SALE con cuotas adelantadas falló. status=${interception.response?.statusCode} body=${JSON.stringify(
          responseBody,
        )} request=${JSON.stringify(requestBody)}`,
      );
    }

    const data = responseBody['data'] as Record<string, unknown> | undefined;
    latestSaleCreditId = String(data?.['id'] ?? '');
    expect(latestSaleCreditId, 'id venta creada').to.not.equal('');
    createdCreditIds.push(latestSaleCreditId);
    cy.location('pathname', { timeout: 20000 }).should(
      'eq',
      `/admin/operations/${latestSaleCreditId}`,
    );
  });
};

/**
 * Garantiza que exista la venta con cuotas adelantadas, creándola si este
 * test corre solo (sin depender del orden de los tests).
 */
const ensureSaleCredit = (): void => {
  if (!latestSaleCreditId) createSaleWithAdvancedInstallments();
};

/**
 * Abre el diálogo de aprobación del crédito del cliente indicado en /admin/approvals.
 * @param dni - DNI del cliente del crédito pendiente
 * @param typeLabel - tipo visible en la fila ("Venta" o "Préstamo"); el mismo
 *   cliente puede tener ambos pendientes
 */
const openApprovalDialogFor = (dni: string, typeLabel: string): void => {
  cy.location('pathname', { timeout: 20000 }).should('eq', '/admin/approvals');
  cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should('be.visible');
  cy.contains('tr', dni, { timeout: 20000 }).should('be.visible');
  cy.get('tr')
    .filter(`:contains("${dni}")`)
    .filter(`:contains("${typeLabel}")`)
    .first()
    .within(() => {
      cy.get('button').filter(':has(.pi-check)').first().click({ force: true });
    });
};

/**
 * Verifica el diálogo de aprobación: cuotas ya definidas, sin input editable.
 * @param installments - cantidad de cuotas esperada
 */
const assertApprovalUsesDefinedInstallments = (installments: number): void => {
  cy.get('.p-dialog:visible').within(() => {
    cy.contains('Aprobar Crédito').should('be.visible');
    cy.contains('Cantidad de cuotas definida').should('be.visible');
    cy.contains(`${installments} cuota(s)`).should('be.visible');
    cy.contains(
      'Se aprobará la operación con las cuotas ya definidas en la pre-operación.',
    ).should('be.visible');
    cy.get('input[type="number"]').should('not.exist');
  });
};

describe('Nueva Operación real — Admin', () => {
  after(() => {
    createdCreditIds.forEach((id) => cy.apiRejectCreditIfPending(id));
  });

  it('crea préstamo real y retorna id en alta de crédito', () => {
    cy.viewport(1280, 720);
    createLoanThroughWizard();
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

  it('venta: permite configurar anticipo en condiciones', () => {
    cy.viewport(1280, 720);
    loginFreshAdminToNewOperation();
    ensureNewOperationReady();

    goToClientStepFromSaleType();
    pickFirstActiveClient();
    addOneSaleUnitAndGoToConditions();

    cy.contains('Pago inicial').scrollIntoView().should('be.visible');
    cy.contains('label', 'Anticipo').click({ force: true });
    cy.contains('Monto del anticipo').should('be.visible');
    cy.get('p-inputNumber[formControlName="downPayment"] input', {
      timeout: 15000,
    })
      .scrollIntoView()
      .should('be.visible')
      .clear()
      .type('5000')
      .blur();
  });

  it('venta: permite configurar cuotas adelantadas en condiciones', () => {
    cy.viewport(1280, 720);
    createSaleWithAdvancedInstallments();
  });

  it('venta: detalle y aprobación respetan cuotas ya definidas', () => {
    cy.viewport(1280, 720);
    ensureSaleCredit();

    cy.then(() => {
      loginFreshAdminToNewOperation(`/admin/operations/${latestSaleCreditId}`);
    });

    cy.contains('Detalles financieros', { timeout: 20000 }).should('be.visible');
    cy.contains('Cuotas adelantadas').should('be.visible');
    cy.contains('2 cuota(s)').should('be.visible');
    cy.contains('Monto adelantado').should('be.visible');
    cy.contains('Método adelanto').should('be.visible');

    cy.contains('button', 'Aprobar').click();
    assertApprovalUsesDefinedInstallments(4);
  });

  it('venta: approvals muestra las cuotas definidas en el modal', () => {
    cy.viewport(1280, 720);
    ensureSaleCredit();

    cy.then(() => {
      loginFreshAdminToNewOperation('/admin/approvals');
      getCreditCustomerDni(String(latestSaleCreditId)).then((dni) =>
        openApprovalDialogFor(dni, 'Venta'),
      );
    });

    assertApprovalUsesDefinedInstallments(4);
  });

  it('préstamo: aprobación usa las cuotas definidas, sin input editable', () => {
    cy.viewport(1280, 720);
    cy.then(() => {
      if (!latestLoanCreditId) createLoanThroughWizard();
    });

    cy.then(() => {
      loginFreshAdminToNewOperation('/admin/approvals');
      getCreditCustomerDni(String(latestLoanCreditId)).then((dni) =>
        openApprovalDialogFor(dni, 'Préstamo'),
      );
    });

    cy.get('.p-dialog:visible').within(() => {
      cy.contains('Aprobar Crédito').should('be.visible');
      cy.contains('Cantidad de cuotas definida').should('be.visible');
      cy.get('input[type="number"]').should('not.exist');
    });
  });
});
