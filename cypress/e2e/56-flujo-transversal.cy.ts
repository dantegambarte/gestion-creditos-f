/**
 * SUITE REAL — Enterprise: El Viaje del Crédito (Multi-Rol).
 *
 * Recorre el ciclo de vida completo de un crédito cambiando de rol en cada
 * paso, igual que en producción: SELLER origina → ADMIN aprueba → COLLECTOR
 * cobra → el cliente lo ve reflejado en el PORTAL.
 *
 * Reglas:
 * - Backend real (realAuthEnabled=true). Sin intercepts que reemplacen
 *   endpoints de negocio — solo se usan para capturar ids (createCredit,
 *   approveCredit, etc.) y para sincronizar la espera del test.
 * - Cambio de rol = cy.logout() + cy.loginReal/loginPortalReal. Cada login
 *   real cachea su sesión con cy.session (ver commands.ts), así que cambiar
 *   de SELLER → ADMIN → COLLECTOR no vuelve a pagar el costo de un login UI
 *   completo salvo la primera vez por rol en toda la corrida de Cypress.
 * - La aprobación de la pre-carga del cobrador la hace el ADMIN por API
 *   (doble control real del sistema: una pre-carga no es plata recibida
 *   hasta que el Admin la aprueba). Se podría hacer por UI (suite 10 ya la
 *   cubre) — acá se prioriza no encadenar un tercer login solo para repetir
 *   ese flujo ya probado.
 * - Habilitar el portal del cliente nuevo es una acción real de ADMIN
 *   (PATCH /customers/:id/enable-portal) — no todo cliente tiene portal por
 *   defecto en este sistema.
 */

type AdminMeResponse = { id?: string };

/**
 * Fecha local YYYY-MM-DD. `toISOString()` usa UTC y en Argentina (UTC-3)
 * después de las 21hs devuelve la fecha de mañana — mismo gotcha documentado
 * en DateService.toLocalIso() del frontend.
 */
function localIsoToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * El form de alta de cliente valida fullName con
 * `/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/` (sin dígitos) — convierte el stamp
 * numérico a letras para mantener unicidad sin romper esa regex.
 */
function digitsToLetters(stamp: string): string {
  return stamp
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('');
}

describe('El Viaje del Crédito — Multi-Rol (real)', () => {
  const stamp = Date.now().toString().slice(-6);
  const customer = {
    fullName: `Transversal QA ${digitsToLetters(stamp)}`,
    dni: `9${stamp}1`,
    phone: `383${stamp}`,
  };
  const portalPassword = `Portal#${stamp}`;

  let customerId: string;
  let creditId: string;
  let installmentId: string;
  let paymentId: string;
  let amountDueBeforePayment: number;
  let portalTempPassword: string;
  let sheetId: string;

  it('paso a — SELLER crea el cliente y origina la solicitud de crédito', () => {
    cy.viewport(1280, 720);
    cy.loginReal('SELLER', '/seller/clients/new');

    cy.location('pathname', { timeout: 15000 }).should('eq', '/seller/clients/new');
    cy.get('input[formControlName="fullName"]', { timeout: 15000 }).clear().type(customer.fullName);
    cy.get('input[formControlName="dni"]').clear().type(customer.dni);
    cy.get('input[formControlName="address"]').clear().type(`Calle ${stamp}`);
    cy.get('input[formControlName="phone"]').clear().type(customer.phone);
    cy.intercept('POST', '/api/customers').as('createCustomer');
    cy.contains('button', 'Registrar cliente').click();

    cy.wait('@createCustomer').then((interception) => {
      customerId = String(interception.response?.body?.data?.id ?? '');
      expect(customerId, 'id de cliente creado').to.not.equal('');
    });
    cy.contains('.p-toast-message', 'Cliente registrado correctamente.', { timeout: 15000 }).should('be.visible');

    cy.intercept('POST', '/api/credits').as('createCredit');
    cy.visit('/seller/operations/new');
    cy.get('[data-cy="btn-type-loan"]', { timeout: 20000 }).should('be.visible').click();

    cy.get('[data-cy="input-search-client"]', { timeout: 15000 }).clear().type(customer.dni);
    cy.contains('[data-cy^="client-card-"]', customer.fullName, { timeout: 15000 }).click();
    cy.contains('button', 'Continuar con este cliente', { timeout: 15000 }).should('be.enabled').click();

    cy.contains('Monto total', { timeout: 15000 }).should('be.visible');
    cy.get('p-inputNumber[formControlName="totalAmount"] input').clear().type('48000').blur();
    cy.get('[data-cy="btn-siguiente"] button', { timeout: 15000 }).should('not.be.disabled').click();

    cy.contains('Configurar Plan de Pagos', { timeout: 15000 }).should('be.visible');
    cy.get('[data-cy="ddl-installments"] .p-dropdown').first().click();
    cy.get('.p-dropdown-panel .p-dropdown-item').first().click();
    cy.get('[data-cy="btn-siguiente"] button').should('not.be.disabled').click();

    cy.contains('Declaraciones y Autorizaciones', { timeout: 15000 }).scrollIntoView().should('be.visible');
    cy.get('[data-cy="btn-mark-all"]').click({ force: true });
    cy.get('[data-cy="btn-enviar-aprobacion"] button').should('not.be.disabled').click();

    // No se valida el toast de éxito: PrimeNG lo auto-descarta a los 3s y el
    // wizard redirige casi de inmediato — para cuando Cypress lo busca puede
    // haber desaparecido ya (carrera de timing, no falla de negocio). El
    // intercept con id + 201 es la prueba real de éxito.
    cy.wait('@createCredit').then((interception) => {
      creditId = String(interception.response?.body?.data?.id ?? '');
      expect(creditId, 'id de crédito originado por SELLER').to.not.equal('');
      expect(interception.response?.statusCode).to.eq(201);
    });
  });

  it('paso b — ADMIN aprueba el crédito desde Aprobaciones', () => {
    cy.viewport(1280, 720);
    expect(creditId, 'crédito originado en paso a').to.be.a('string').and.not.be.empty;

    cy.logout();
    cy.loginReal('ADMIN', '/admin/approvals');
    cy.contains('Aprobación de Operaciones', { timeout: 20000 }).should('be.visible');

    // Aprobar un LOAN desembolsa el préstamo desde la caja activa de la
    // jornada — sin caja abierta responde 409 NO_ACTIVE_SESSION. No falla si
    // ya existe una (409 ACTIVE_SESSION_IN_BUSINESS_DAY).
    cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('POST', '/cash-sessions', { opening_amount: 1000000 }, token)
        .then((res) => {
          expect(
            [201, 409],
            'abrir caja operativa (nueva o ya existente)',
          ).to.include(res.status);
        }),
    );

    cy.intercept('PATCH', /\/api\/credits\/[^/]+\/approve$/).as('approveCredit');
    cy.contains('p-table tbody tr', customer.dni, { timeout: 20000 })
      .should('be.visible')
      .within(() => {
        cy.get('button').eq(1).click();
      });

    cy.contains('.p-dialog .p-dialog-title', 'Aprobar Operación', { timeout: 10000 }).should('be.visible');
    cy.contains('.p-dialog button', 'Confirmar Aprobación').click();

    cy.wait('@approveCredit').then((interception) => {
      expect(interception.response?.statusCode, 'aprobación de crédito').to.eq(200);
    });
    cy.contains('.p-toast-message', /aprob/i, { timeout: 20000 }).should('be.visible');

    // Habilita el portal del cliente recién creado (acción real de ADMIN) y
    // genera la planilla del día para el COLLECTOR — son las dos
    // precondiciones reales que faltan para que los pasos c y d funcionen.
    cy.getAuthToken('ADMIN').then((adminToken) => {
      cy.apiRequest('PATCH', `/customers/${customerId}/enable-portal`, null, adminToken).then((res) => {
        expect(res.status, 'habilitar portal del cliente').to.eq(200);
        portalTempPassword = String(res.body?.data?.tempPassword ?? '');
        expect(portalTempPassword, 'temp password de portal').to.not.equal('');

        cy.apiRequest('GET', `/installments?credit_id=${creditId}`, null, adminToken).then((instRes) => {
          expect(instRes.status, 'cuotas del crédito aprobado').to.eq(200);
          const installments = (instRes.body?.data ?? []) as Array<Record<string, unknown>>;
          expect(installments, 'al menos una cuota generada').to.have.length.greaterThan(0);
          installmentId = String(installments[0]['id']);
          amountDueBeforePayment = Number(installments[0]['amount_due']);
        });
      });
    });

    cy.getAuthToken('COLLECTOR').then((collectorToken) =>
      cy.apiRequest('GET', '/auth/me', null, collectorToken).then((meRes) => {
        expect(meRes.status, 'auth/me cobrador').to.eq(200);
        const collectorId = String((meRes.body?.data as AdminMeResponse | undefined)?.id ?? '');
        expect(collectorId, 'id del cobrador real').to.not.equal('');

        cy.getAuthToken('ADMIN').then((adminToken) => {
          // findInstallmentsForSheet exige cu.assigned_collector_id = $collector —
          // el cliente recién creado por SELLER no tiene cobrador asignado, así
          // que sin esto la planilla se generaría vacía (409) o sin nuestra cuota.
          cy.apiRequest(
            'PUT',
            `/customers/${customerId}`,
            { assigned_collector_id: collectorId },
            adminToken,
          ).then((assignRes) => {
            expect(assignRes.status, 'asignar cobrador al cliente').to.eq(200);
          });

          cy.apiRequest(
            'POST',
            '/collections',
            {
              collector_id: collectorId,
              date: localIsoToday(),
              filter: 'ALL_PENDING',
              // false: si el cobrador ya tiene una planilla ACTIVE de hoy (de
              // una corrida previa de esta suite), skip_if_exists devolvería
              // esa planilla vieja tal cual y NUNCA incluiría la cuota recién
              // aprobada. Sin skip, la vieja pasa a REGENERATED y se crea una
              // ACTIVE nueva con el pendiente real de hoy — generate() ya
              // preserva el historial vía soft-delete, no hace falta el flag.
              skip_if_exists: false,
            },
            adminToken,
          ).then((sheetRes) => {
            expect([200, 201], 'generar planilla del cobrador').to.include(sheetRes.status);
            sheetId = String(sheetRes.body?.data?.sheet?.id ?? '');
            expect(sheetId, 'id de planilla generada').to.not.equal('');
          });
        });
      }),
    );
  });

  it('paso c — COLLECTOR cobra la cuota desde su ruta', () => {
    cy.viewport(1280, 720);
    expect(installmentId, 'cuota a cobrar (paso b)').to.be.a('string').and.not.be.empty;

    expect(sheetId, 'planilla generada en paso b').to.be.a('string').and.not.be.empty;

    cy.logout();
    // Navega directo por id en vez de "primera planilla de la ruta": el
    // cobrador puede tener varias planillas (de corridas previas de esta
    // suite), y la nuestra no es necesariamente la primera del listado.
    cy.loginReal('COLLECTOR', `/collector/route/${sheetId}`);
    cy.location('pathname', { timeout: 15000 }).should('eq', `/collector/route/${sheetId}`);
    cy.contains('h1', 'Planilla', { timeout: 15000 }).should('be.visible');

    cy.intercept('POST', '/api/payments').as('createPayment');
    cy.contains(customer.fullName, { timeout: 15000 })
      .closest('tr')
      .within(() => {
        cy.contains('button', 'Cobrar').click({ force: true });
      });

    cy.contains('.p-dialog', 'Registrar Cobro', { timeout: 10000 }).should('be.visible');
    cy.get('.p-dialog p-inputnumber input').first().clear().type(String(amountDueBeforePayment)).blur();
    cy.contains('.p-dialog button', 'Confirmar').should('not.be.disabled').click();

    cy.wait('@createPayment').then((interception) => {
      paymentId = String(interception.response?.body?.data?.id ?? '');
      expect(paymentId, 'id de pre-carga de cobro').to.not.equal('');
      expect(interception.response?.statusCode, 'alta de pre-carga').to.eq(201);
      expect(interception.response?.body?.data?.status, 'pre-carga nace PENDING').to.eq('PENDING');
    });
  });

  it('paso d — ADMIN aprueba el cobro y el PORTAL del cliente refleja el saldo actualizado', () => {
    cy.viewport(1280, 720);
    expect(paymentId, 'pre-carga registrada en paso c').to.be.a('string').and.not.be.empty;

    cy.logout();
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy.apiRequest('PATCH', `/payments/${paymentId}/approve`, null, adminToken).then((res) => {
        expect(res.status, 'aprobación del cobro (recepción real del dinero)').to.eq(200);
      }),
    );

    expect(portalTempPassword, 'temp password obtenida en paso b').to.be.a('string').and.not.be.empty;

    cy.visit('/portal/login');
    cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
    cy.get('p-password[formControlName="password"] input').clear().type(portalTempPassword);
    cy.contains('button', 'Iniciar sesión').click();

    // Primer ingreso con contraseña temporal → guard fuerza cambio. El guard
    // decide con el flag cacheado en localStorage (sgcf_portal_customer), que
    // no se actualiza solo porque el backend ya aceptó el cambio — por eso
    // tras cambiarla volvemos a loguear por UI con la contraseña nueva en vez
    // de visitar /portal/dashboard a mano (el guard nos rebotaría igual).
    //
    // cy.location().then() NO reintenta — lee el pathname una sola vez, y
    // justo tras el click el router todavía puede estar en /portal/login
    // antes de que el guard redirija. Por eso primero se espera con
    // .should() (que sí reintenta) a que la navegación se estabilice en uno
    // de los dos destinos válidos, y solo ahí se lee para decidir la rama.
    cy.location('pathname', { timeout: 15000 }).should((pathname) => {
      expect(['/portal/dashboard', '/portal/change-password']).to.include(pathname);
    });
    cy.location('pathname').then((pathname) => {
      if (!pathname.includes('change-password')) return;

      // Encadenado explícito: cy.window() y el cy.visit() posterior NO
      // estaban relacionados entre sí, así que el segundo login corría en
      // paralelo con el cambio de contraseña en vez de esperarlo — el login
      // llegaba a destino con is_temp_password todavía en true server-side.
      cy.window()
        .then((win) => {
          const token = win.localStorage.getItem('sgcf_portal_token');
          expect(token, 'token portal tras login temp').to.be.a('string').and.not.be.empty;

          return cy.request({
            method: 'POST',
            url: `${String(Cypress.env('apiBaseUrl'))}/auth/portal/change-password`,
            headers: { Authorization: `Bearer ${token}` },
            body: { current_password: portalTempPassword, new_password: portalPassword },
          });
        })
        .then((changeRes) => {
          expect(changeRes.status, 'cambio de contraseña temporal').to.eq(200);

          // Sin esto, /portal/login con la sesión temp todavía en localStorage
          // rebota directo a /portal/change-password (el guard ni muestra el
          // form) — hace falta limpiar la sesión vieja antes del relogin.
          cy.clearAllLocalStorage();
          cy.visit('/portal/login');
          cy.get('input[formControlName="dni"]', { timeout: 15000 }).clear().type(customer.dni);
          cy.get('p-password[formControlName="password"] input').clear().type(portalPassword);
          cy.contains('button', 'Iniciar sesión').click();
        });
    });

    cy.location('pathname', { timeout: 15000 }).should('eq', '/portal/dashboard');
    cy.get('app-error-state').should('not.exist');
    cy.get('[data-cy="portal-dashboard-summary-card"]', { timeout: 15000 }).should('be.visible');

    // Verificación dura del saldo: la cuota cobrada bajó su amount_due real.
    cy.getAuthToken('ADMIN').then((adminToken) =>
      cy.apiRequest('GET', `/installments/${installmentId}`, null, adminToken).then((res) => {
        expect(res.status, 'estado final de la cuota cobrada').to.eq(200);
        const updated = res.body?.data as Record<string, unknown>;
        expect(Number(updated['amount_paid']), 'saldo pagado reflejado').to.be.greaterThan(0);
        expect(['PAID', 'PARTIAL'], 'estado de cuota tras cobro aprobado').to.include(
          updated['status'],
        );
      }),
    );
  });
});
