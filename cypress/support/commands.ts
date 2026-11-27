// ── Custom Commands ────────────────────────────────────────────────────────────

type InternalRole = 'ADMIN' | 'SELLER' | 'COLLECTOR' | 'SELLER_COLLECTOR';

type RealCredentials = {
  dni: string;
  password: string;
};

type PortalRealCredentials = {
  dni: string;
  password: string;
};

const AUTH_TOKEN_CACHE: Partial<Record<InternalRole, string>> = {};

type LoginResponseBody = {
  ok?: boolean;
  data?: {
    token?: string;
    user?: Record<string, unknown>;
  };
  message?: string;
};

type PortalLoginResponseBody = {
  ok?: boolean;
  data?: {
    token?: string;
    customer?: {
      id?: string;
      full_name?: string;
      dni?: string;
      portal_is_temp_password?: boolean;
    };
  };
  message?: string;
};

type PortalSession = {
  token: string;
  customer: {
    id: string;
    fullName: string;
    dni: string;
    portalIsTempPassword: boolean;
  };
};

const INTERNAL_TOKEN_KEY = 'sgcf_token';
const INTERNAL_USER_KEY = 'sgcf_user';
const PORTAL_TOKEN_KEY = 'sgcf_portal_token';
const PORTAL_CUSTOMER_KEY = 'sgcf_portal_customer';

// Tokens y objetos de usuario mock — reflejan exactamente MOCK_USERS de mock-auth.service.ts
const MOCK_AUTH_DATA: Record<string, { token: string; user: object }> = {
  ADMIN: {
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwicm9sZSI6IkFETUlOIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_admin',
    user: {
      id: 'usr-001',
      full_name: 'Carlos López',
      name: 'Carlos López',
      dni: '12345678',
      email: 'admin@siscreditos.com',
      avatar: 'CL',
      roles: ['ADMIN'],
      is_temp_password: false,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwicm9sZSI6IkFETUlOIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_admin',
    },
  },
  SELLER: {
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAyIiwicm9sZSI6IlNFTExFUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_seller',
    user: {
      id: 'usr-002',
      full_name: 'María Sánchez',
      name: 'María Sánchez',
      dni: '87654321',
      email: 'vendedor@siscreditos.com',
      avatar: 'MS',
      roles: ['SELLER'],
      is_temp_password: false,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAyIiwicm9sZSI6IlNFTExFUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_seller',
    },
  },
  COLLECTOR: {
    token:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAzIiwicm9sZSI6IkNPTExFQ1RPUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_collector',
    user: {
      id: 'usr-003',
      full_name: 'Juan Pedraza',
      name: 'Juan Pedraza',
      dni: '11223344',
      email: 'cobrador@siscreditos.com',
      avatar: 'JP',
      roles: ['COLLECTOR'],
      is_temp_password: false,
      force_relogin_at: null,
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAzIiwicm9sZSI6IkNPTExFQ1RPUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_collector',
    },
  },
};

/**
 * Respuestas mock para GET /auth/me.
 * ApiHttpService unwrapea ApiResponse<T> → { ok: true, data: MeResponseData }.
 * MeResponseData usa 'role' (singular), no array.
 */
const MOCK_ME_RESPONSES: Record<string, object> = {
  ADMIN: {
    ok: true,
    data: {
      id: 'usr-001',
      full_name: 'Carlos López',
      dni: '12345678',
      role: 'ADMIN',
      is_temp_password: false,
      force_relogin_at: null,
    },
  },
  SELLER: {
    ok: true,
    data: {
      id: 'usr-002',
      full_name: 'María Sánchez',
      dni: '87654321',
      role: 'SELLER',
      is_temp_password: false,
      force_relogin_at: null,
    },
  },
  COLLECTOR: {
    ok: true,
    data: {
      id: 'usr-003',
      full_name: 'Juan Pedraza',
      dni: '11223344',
      role: 'COLLECTOR',
      is_temp_password: false,
      force_relogin_at: null,
    },
  },
};

/**
 * Respuestas mock para POST /auth/login.
 * ApiHttpService unwrapea ApiResponse<T> → { ok: true, data: LoginResponseData }.
 * LoginResponseData tiene { user: { id, full_name, dni, role, is_temp_password }, token }.
 */
export const MOCK_LOGIN_RESPONSES: Record<string, object> = {
  ADMIN: {
    ok: true,
    data: {
      user: {
        id: 'usr-001',
        full_name: 'Carlos López',
        dni: '12345678',
        role: 'ADMIN',
        is_temp_password: false,
      },
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAxIiwicm9sZSI6IkFETUlOIiwiYXVkIjoic2lzdGVtYS1pbnRlcm5vIn0.mock_admin',
    },
  },
  SELLER: {
    ok: true,
    data: {
      user: {
        id: 'usr-002',
        full_name: 'María Sánchez',
        dni: '87654321',
        role: 'SELLER',
        is_temp_password: false,
      },
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAyIiwicm9sZSI6IlNFTExFUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_seller',
    },
  },
  COLLECTOR: {
    ok: true,
    data: {
      user: {
        id: 'usr-003',
        full_name: 'Juan Pedraza',
        dni: '11223344',
        role: 'COLLECTOR',
        is_temp_password: false,
      },
      token:
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c3ItMDAzIiwicm9sZSI6IkNPTExFQ1RPUiIsImF1ZCI6InNpc3RlbWEtaW50ZXJubyJ9.mock_collector',
    },
  },
};

// Ruta home de cada rol (ruta protegida donde el rol tiene acceso directo)
const ROLE_HOME: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  SELLER: '/seller/operations',
  COLLECTOR: '/collector/route',
};

const PORTAL_DEFAULT_HOME = '/portal/dashboard';

const REAL_ROLE_HOME: Record<InternalRole, string> = {
  ADMIN: '/admin/dashboard',
  SELLER: '/seller/operations',
  COLLECTOR: '/collector/route',
  SELLER_COLLECTOR: '/seller/operations',
};

/**
 * Normaliza pathname removiendo slash final para comparaciones estables.
 * @param path Ruta a normalizar.
 * @returns Pathname normalizado sin slash final (excepto raíz).
 */
function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }

  return path;
}

const DEFAULT_PORTAL_SESSION: PortalSession = {
  token:
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LTAwMSIsImZ1bGxfbmFtZSI6IkFuYSBHYXJjw61hIiwiZG5pIjoiMTIzNDU2NzgiLCJwb3J0YWxfaXNfdGVtcF9wYXNzd29yZCI6ZmFsc2V9.sig',
  customer: {
    id: 'cust-001',
    fullName: 'Ana García',
    dni: '12345678',
    portalIsTempPassword: false,
  },
};

/**
 * Persiste sesión interna en localStorage antes de iniciar Angular.
 * @param win Ventana del AUT donde se inyecta storage.
 * @param role Rol a simular para sesión interna.
 */
function seedInternalSession(win: Cypress.AUTWindow, role: InternalRole): void {
  const { token, user } = MOCK_AUTH_DATA[role];
  win.localStorage.setItem(INTERNAL_TOKEN_KEY, token);
  win.localStorage.setItem(INTERNAL_USER_KEY, JSON.stringify(user));
}

/**
 * Persiste sesión de portal en localStorage antes de iniciar Angular.
 * @param win Ventana del AUT donde se inyecta storage.
 * @param session Datos de sesión portal a inyectar.
 */
function seedPortalSession(
  win: Cypress.AUTWindow,
  session: PortalSession,
): void {
  win.localStorage.setItem(PORTAL_TOKEN_KEY, session.token);
  win.localStorage.setItem(
    PORTAL_CUSTOMER_KEY,
    JSON.stringify(session.customer),
  );
}

/**
 * Obtiene las credenciales reales desde Cypress.env para un rol interno.
 * @param role Rol interno a autenticar contra backend real.
 * @returns Credenciales reales (dni/password) para el rol.
 */
function getRealCredentials(role: InternalRole): RealCredentials {
  const envByRole: Record<InternalRole, { dniKey: string; passKey: string }> = {
    ADMIN: { dniKey: 'realAdminDni', passKey: 'realAdminPassword' },
    SELLER: { dniKey: 'realSellerDni', passKey: 'realSellerPassword' },
    COLLECTOR: { dniKey: 'realCollectorDni', passKey: 'realCollectorPassword' },
    SELLER_COLLECTOR: {
      dniKey: 'realSellerCollectorDni',
      passKey: 'realSellerCollectorPassword',
    },
  };

  const keys = envByRole[role];
  const dni = String(Cypress.env(keys.dniKey) ?? '').trim();
  const password = String(Cypress.env(keys.passKey) ?? '').trim();

  if (!dni || !password) {
    throw new Error(
      `[cypress][loginReal] Faltan credenciales para ${role}. Configurá ${keys.dniKey} y ${keys.passKey}.`,
    );
  }

  return { dni, password };
}

/**
 * Ejecuta login real por API con reintentos ante 429 (rate limit).
 * @param creds Credenciales reales.
 * @param retries Cantidad de reintentos restantes.
 * @returns Respuesta del endpoint /auth/login.
 */
function requestLoginWithRetry(
  creds: RealCredentials,
  retries = Number(Cypress.env('realAuth429MaxRetries') ?? 4),
): Cypress.Chainable<Cypress.Response<LoginResponseBody>> {
  return cy
    .request<LoginResponseBody>({
      method: 'POST',
      url: `${String(Cypress.env('apiBaseUrl'))}/auth/login`,
      body: { dni: creds.dni, password: creds.password },
      failOnStatusCode: false,
    })
    .then((res) => {
      if (res.status !== 429) {
        return cy.wrap(res, { log: false });
      }

      if (retries <= 0) {
        throw new Error(
          '[cypress][auth] Backend sigue respondiendo 429 (rate limit) tras varios reintentos.',
        );
      }

      const retryAfterRaw = res.headers?.['retry-after'];
      const retryAfterSeconds = Number(
        Array.isArray(retryAfterRaw) ? retryAfterRaw[0] : retryAfterRaw,
      );

      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 5000;

      const cappedWaitMs = Math.min(
        waitMs,
        Number(Cypress.env('realAuth429MaxWaitMs') ?? 60000),
      );

      cy.wait(cappedWaitMs);
      return requestLoginWithRetry(creds, retries - 1);
    });
}

/**
 * Convierte el usuario real del backend al perfil que la app guarda en storage.
 * Desde #39 el perfil no incluye el token: el access token vive sólo en memoria.
 * @param user Usuario crudo devuelto por auth/login.
 * @returns Perfil normalizado para `sgcf_user`.
 */
function normalizeRealInternalUser(
  user: Record<string, unknown>,
): Record<string, unknown> {
  const fullName = String(user['full_name'] ?? user['name'] ?? '').trim();
  const role = String(user['role'] ?? '').trim();

  return {
    ...user,
    full_name: fullName,
    name: fullName,
    roles: Array.isArray(user['roles']) ? user['roles'] : [role],
    avatar: fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
    is_temp_password: Boolean(user['is_temp_password']),
    force_relogin_at: user['force_relogin_at'] ?? null,
  };
}

/**
 * Obtiene credenciales reales de portal desde Cypress.env.
 * @returns Credenciales DNI/password del cliente portal.
 */
function getPortalRealCredentials(): PortalRealCredentials {
  const dni = String(Cypress.env('realPortalDni') ?? '').trim();
  const password = String(Cypress.env('realPortalPassword') ?? '').trim();

  if (!dni || !password) {
    throw new Error(
      '[cypress][loginPortalReal] Faltan credenciales de portal. Configurá realPortalDni y realPortalPassword.',
    );
  }

  return { dni, password };
}

/**
 * Ejecuta login real de portal por API con reintentos ante 429.
 * @param creds Credenciales reales del portal.
 * @param retries Cantidad de reintentos restantes.
 * @returns Respuesta del endpoint /auth/portal/login.
 */
function requestPortalLoginWithRetry(
  creds: PortalRealCredentials,
  retries = Number(Cypress.env('realAuth429MaxRetries') ?? 4),
): Cypress.Chainable<Cypress.Response<PortalLoginResponseBody>> {
  return cy
    .request<PortalLoginResponseBody>({
      method: 'POST',
      url: `${String(Cypress.env('apiBaseUrl'))}/auth/portal/login`,
      body: { dni: creds.dni, password: creds.password },
      failOnStatusCode: false,
    })
    .then((res) => {
      if (res.status !== 429) {
        return cy.wrap(res, { log: false });
      }

      if (retries <= 0) {
        throw new Error(
          '[cypress][portal-auth] Backend sigue respondiendo 429 (rate limit) tras varios reintentos.',
        );
      }

      const retryAfterRaw = res.headers?.['retry-after'];
      const retryAfterSeconds = Number(
        Array.isArray(retryAfterRaw) ? retryAfterRaw[0] : retryAfterRaw,
      );

      const waitMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 5000;

      const cappedWaitMs = Math.min(
        waitMs,
        Number(Cypress.env('realAuth429MaxWaitMs') ?? 60000),
      );

      cy.wait(cappedWaitMs);
      return requestPortalLoginWithRetry(creds, retries - 1);
    });
}

/**
 * Exige el flag de habilitación de modo real para evitar mezcla accidental.
 */
function assertRealAuthEnabled(): void {
  const enabled = Cypress.env('realAuthEnabled') === true;
  if (!enabled) {
    throw new Error(
      '[cypress][loginReal] realAuthEnabled=false. Habilitá CYPRESS_realAuthEnabled=true para specs reales.',
    );
  }
}

/**
 * Inyecta auth en el AUT via onBeforeLoad + intercepta GET /auth/me.
 *
 * POR QUÉ onBeforeLoad + intercept:
 *   1. La app usa AuthService (useMocks=false en ambos environments).
 *   2. APP_INITIALIZER llama restoreSession() → GET /auth/me en CADA carga de página.
 *   3. El backend real devuelve 401 para tokens mock → catchError llama clear() → usuario null.
 *   4. onBeforeLoad establece localStorage ANTES de que Angular arranque.
 *   5. cy.intercept hace que GET /auth/me devuelva 200 → restoreSession persiste el usuario.
 *   6. Guards (authGuard, roleGuard, tempPasswordGuard) ven el usuario correcto. ✓
 *
 * cy.intercept persiste durante todo el test (testIsolation limpia entre tests).
 */
Cypress.Commands.add('loginAs', (role: InternalRole, destination?: string) => {
  if (Cypress.env('realAuthEnabled') === true) {
    cy.loginReal(role, destination);
    return;
  }

  // El access token vive sólo en memoria (#39): APP_INITIALIZER lo recupera
  // con POST /auth/refresh (cookie HttpOnly) y luego pide GET /auth/me.
  cy.intercept('POST', '**/auth/refresh', {
    statusCode: 200,
    body: { ok: true, data: { token: MOCK_AUTH_DATA[role].token } },
  }).as('authRefresh');
  cy.intercept('GET', '**/auth/me', {
    statusCode: 200,
    body: MOCK_ME_RESPONSES[role],
  }).as('authMe');

  cy.visit(destination ?? ROLE_HOME[role], {
    onBeforeLoad(win) {
      seedInternalSession(win, role);
    },
  });

  cy.wait('@authMe');
});

/**
 * Inicia sesión real por API y deja una sesión que la app puede restaurar sola.
 * Desde #39 el access token vive sólo en memoria: el login por cy.request deja
 * la cookie HttpOnly `rt` en el navegador y el perfil (sin token) se siembra en
 * `sgcf_user`; al cargar, APP_INITIALIZER hace POST /auth/refresh + GET /auth/me.
 * No usa cy.session: el refresh rota la cookie en cada carga y una cookie
 * cacheada quedaría revocada en el test siguiente.
 * @param role Rol a autenticar contra backend real.
 * @param destination Ruta protegida de destino (por defecto, home del rol).
 */
Cypress.Commands.add(
  'loginReal',
  (role: InternalRole, destination?: string) => {
    assertRealAuthEnabled();
    const creds = getRealCredentials(role);
    const targetPath = normalizePath(destination ?? REAL_ROLE_HOME[role]);

    cy.intercept('POST', '**/auth/refresh').as('authRefreshReal');
    cy.intercept('GET', '**/auth/me').as('authMeReal');

    requestLoginWithRetry(creds).then((res) => {
      expect(res.status, `[cypress][loginReal] login ${role}`).to.eq(200);
      const token = res.body?.data?.token;
      const user = res.body?.data?.user;

      expect(token, '[cypress][loginReal] token backend').to.be.a('string')
        .and.not.be.empty;
      expect(user, '[cypress][loginReal] user backend').to.be.an('object');

      AUTH_TOKEN_CACHE[role] = token as string;
      const profile = JSON.stringify(
        normalizeRealInternalUser(user as Record<string, unknown>),
      );

      cy.visit(targetPath, {
        onBeforeLoad(win) {
          win.localStorage.setItem(INTERNAL_USER_KEY, profile);
        },
      });
    });

    cy.wait('@authRefreshReal', { timeout: 15000 })
      .its('response.statusCode')
      .should('eq', 200);
    cy.location('pathname', { timeout: 15000 }).should('eq', targetPath);
  },
);

/**
 * Inyecta sesión portal usando las claves reales del contrato de la app.
 * @param destination Ruta de destino del portal.
 * @param overrides Permite sobreescribir token/cliente de sesión por test.
 */
Cypress.Commands.add(
  'loginPortalAs',
  (destination?: string, overrides?: Partial<PortalSession>) => {
    const session: PortalSession = {
      token: overrides?.token ?? DEFAULT_PORTAL_SESSION.token,
      customer: {
        ...DEFAULT_PORTAL_SESSION.customer,
        ...(overrides?.customer ?? {}),
      },
    };

    // El token del portal vive sólo en memoria (#39): se recupera con refresh.
    cy.intercept('POST', '**/auth/portal/refresh', {
      statusCode: 200,
      body: { ok: true, data: { token: session.token } },
    }).as('portalRefresh');

    cy.visit(destination ?? PORTAL_DEFAULT_HOME, {
      onBeforeLoad(win) {
        seedPortalSession(win, session);
      },
    });
  },
);

/**
 * Pide login real de portal; si el cliente E2E no existe, corre el seed y reintenta.
 * @param creds Credenciales reales del portal.
 * @returns Respuesta 200 del endpoint /auth/portal/login.
 */
function requestPortalLoginOrSeed(
  creds: PortalRealCredentials,
): Cypress.Chainable<Cypress.Response<PortalLoginResponseBody>> {
  return requestPortalLoginWithRetry(creds).then((res) => {
    if (res.status !== 401) {
      expect(res.status, '[cypress][loginPortalReal] login portal').to.eq(200);
      return cy.wrap(res);
    }

    return cy.task('db:seed:e2e').then((result) => {
      const taskResult = result as { ok?: boolean; error?: string };
      expect(taskResult?.ok, '[cypress][loginPortalReal] db:seed:e2e').to.eq(
        true,
      );

      return requestPortalLoginWithRetry(creds).then((retryRes) => {
        expect(
          retryRes.status,
          '[cypress][loginPortalReal] login portal tras seed',
        ).to.eq(200);
        return retryRes;
      });
    });
  });
}

/**
 * Inicia sesión real de portal por API y deja una sesión que la app puede restaurar.
 * El login por cy.request deja la cookie HttpOnly `prt` (path /api/auth/portal,
 * backend#101) y se siembra sólo el cliente en `sgcf_portal_customer`; al cargar,
 * la app recupera el token con POST /auth/portal/refresh.
 * @param destination Ruta destino del portal (por defecto dashboard).
 */
Cypress.Commands.add('loginPortalReal', (destination?: string) => {
  assertRealAuthEnabled();
  const creds = getPortalRealCredentials();
  const targetPath = normalizePath(destination ?? PORTAL_DEFAULT_HOME);

  cy.intercept('POST', '**/auth/portal/refresh').as('portalRefreshReal');

  requestPortalLoginOrSeed(creds).then((res) => {
    const token = res.body?.data?.token;
    const customer = res.body?.data?.customer;

    expect(token, '[cypress][loginPortalReal] token backend').to.be.a('string')
      .and.not.be.empty;
    expect(customer?.id, '[cypress][loginPortalReal] customer.id').to.be.a(
      'string',
    ).and.not.be.empty;

    const session: PortalSession = {
      token: token as string,
      customer: {
        id: customer?.id as string,
        fullName:
          typeof customer?.full_name === 'string' && customer.full_name
            ? customer.full_name
            : 'Cliente Portal',
        dni:
          typeof customer?.dni === 'string' && customer.dni
            ? customer.dni
            : creds.dni,
        portalIsTempPassword: Boolean(customer?.portal_is_temp_password),
      },
    };
    const customerRaw = JSON.stringify(session.customer);

    cy.visit(targetPath, {
      onBeforeLoad(win) {
        win.localStorage.setItem(PORTAL_CUSTOMER_KEY, customerRaw);
      },
    });
  });

  cy.wait('@portalRefreshReal', { timeout: 15000 })
    .its('response.statusCode')
    .should('eq', 200);
  cy.location('pathname', { timeout: 15000 }).should('eq', targetPath);
});

/** Limpia estado de auth y navega a /login */
Cypress.Commands.add('logout', () => {
  delete AUTH_TOKEN_CACHE.ADMIN;
  delete AUTH_TOKEN_CACHE.SELLER;
  delete AUTH_TOKEN_CACHE.COLLECTOR;
  delete AUTH_TOKEN_CACHE.SELLER_COLLECTOR;
  cy.clearAllLocalStorage();
  cy.visit('/login');
});

// ── API Helpers — para E2E real sin mocks ────────────────────────────────────
// Todos usan la URL del backend directamente (no pasan por el proxy Angular).

const API_BASE = () => Cypress.env('apiBaseUrl') as string;

type ApiRole = InternalRole;

/**
 * Envoltorio estándar de respuesta del backend ({ ok, data, message, code }).
 * `data` queda abierto porque cada endpoint devuelve una forma distinta y los specs
 * lo leen de forma dinámica, igual que el `Response<any>` nativo de `cy.request`.
 */
type ApiEnvelope = {
  ok?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload dinámico por endpoint
  data?: any;
  message?: string;
  code?: string;
};

/**
 * Obtiene un token real haciendo POST /auth/login con las credenciales
 * configuradas en Cypress.env para el rol indicado.
 */
Cypress.Commands.add(
  'getAuthToken',
  (role: ApiRole): Cypress.Chainable<string> => {
    const pascalRole = role
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join('');
    const dniKey = `real${pascalRole}Dni`;
    const passKey = `real${pascalRole}Password`;

    const dni = String(Cypress.env(dniKey) ?? '').trim();
    const password = String(Cypress.env(passKey) ?? '').trim();

    const cachedToken = AUTH_TOKEN_CACHE[role];
    if (cachedToken) {
      return cy.wrap(cachedToken, { log: false });
    }

    return requestLoginWithRetry({ dni, password }).then((res) => {
      expect(res.status, `login ${role}`).to.eq(200);
      const token = res.body.data?.token as string;
      AUTH_TOKEN_CACHE[role] = token;
      return token;
    });
  },
);

/**
 * Helper genérico: petición autenticada al backend.
 */
Cypress.Commands.add(
  'apiRequest',
  (
    method: string,
    path: string,
    body: object | null,
    token: string,
  ): Cypress.Chainable<Cypress.Response<ApiEnvelope>> => {
    return cy.request({
      method,
      url: `${API_BASE()}${path}`,
      headers: { Authorization: `Bearer ${token}` },
      body: body ?? undefined,
      failOnStatusCode: false,
    });
  },
);

/**
 * Crea un cliente vía API con el token del Admin.
 * Devuelve el objeto customer creado ({ id, dni, full_name, ... }).
 */
Cypress.Commands.add(
  'apiCreateCustomer',
  (data: {
    full_name: string;
    dni: string;
    address: string;
    phone: string;
    email?: string;
  }): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('POST', '/customers', data, token).then((res) => {
        expect(res.status, 'crear cliente').to.eq(201);
        return res.body.data as Record<string, unknown>;
      }),
    );
  },
);

/**
 * Crea un usuario interno vía API con el token del Admin.
 * Devuelve { user: { id, dni, ... }, tempPassword } tal como lo devuelve el backend.
 */
Cypress.Commands.add(
  'apiCreateUser',
  (data: {
    full_name: string;
    dni: string;
    email: string;
    address: string;
    role: string;
  }): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy.apiRequest('POST', '/users', data, token).then((res) => {
        expect(res.status, 'crear usuario').to.eq(201);
        return res.body.data as Record<string, unknown>;
      }),
    );
  },
);

/**
 * Desbloquea un usuario vía API (Admin).
 * Útil para limpiar estado de bloqueo tras tests de intentos fallidos.
 */
Cypress.Commands.add(
  'apiUnlockUser',
  (userId: string): Cypress.Chainable<unknown> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('PATCH', `/users/${userId}/unlock`, null, token)
        .then((res) => {
          expect(
            [200, 409],
            'desbloquear usuario (ok o ya desbloqueado)',
          ).to.include(res.status);
        }),
    );
  },
);

/**
 * Garantiza una caja operativa abierta en la jornada actual, sin fallar si
 * ya existe una (backend responde 409 ACTIVE_SESSION_IN_BUSINESS_DAY).
 * Necesario desde que aprobar un LOAN exige caja activa para el desembolso.
 */
/**
 * Registra un ingreso manual en efectivo en la caja operativa activa, con el
 * mismo monto con que ensureCashSessionOpen abre una caja nueva.
 * @param token - token ADMIN
 */
function fundActiveCashSession(token: string): Cypress.Chainable<unknown> {
  return cy.apiRequest('GET', '/cash-sessions/active', null, token).then((activeRes) => {
    const sessionId = (activeRes.body?.data as { id?: string } | null)?.id;
    expect(sessionId, 'caja operativa activa para fondear').to.be.a('string');
    return cy
      .apiRequest(
        'POST',
        `/cash-sessions/${sessionId}/manual-incomes`,
        { amount: 100000000, payment_method: 'CASH', description: 'Fondeo automático de E2E' },
        token,
      )
      .then((incomeRes) => {
        expect(incomeRes.status, `fondear caja — ${JSON.stringify(incomeRes.body)}`).to.eq(201);
      });
  });
}

function ensureCashSessionOpen(token: string): Cypress.Chainable<unknown> {
  return cy
    .apiRequest('POST', '/cash-sessions', { opening_amount: 100000000 }, token)
    .then((res) => {
      expect(
        [201, 409],
        'abrir caja operativa (nueva o ya existente)',
      ).to.include(res.status);
    });
}

/**
 * Aprueba un crédito por id usando el token Admin. Abre caja operativa si no
 * hay una ya (LOAN y ventas con enganche/cuotas adelantadas la requieren).
 * Devuelve el crédito actualizado.
 */
Cypress.Commands.add(
  'apiApproveCredit',
  (creditId: string): Cypress.Chainable<Record<string, unknown>> => {
    const approve = (token: string) =>
      cy.apiRequest('PATCH', `/credits/${creditId}/approve`, null, token);

    return cy.getAuthToken('ADMIN').then((token) =>
      ensureCashSessionOpen(token).then(() =>
        approve(token).then((res) => {
          // La caja de hoy puede venir de otra suite con poco efectivo (409 de
          // ensureCashSessionOpen la reutiliza): fondearla y reintentar una vez,
          // para no depender del orden de las suites.
          if (res.status !== 409 || res.body?.code !== 'INSUFFICIENT_CASH') {
            expect(res.status, `aprobar crédito — ${JSON.stringify(res.body)}`).to.eq(200);
            return cy.wrap(res.body.data as Record<string, unknown>, { log: false });
          }
          return fundActiveCashSession(token).then(() =>
            approve(token).then((retry) => {
              expect(retry.status, `aprobar crédito tras fondear caja — ${JSON.stringify(retry.body)}`).to.eq(200);
              return retry.body.data as Record<string, unknown>;
            }),
          );
        }),
      ),
    );
  },
);

/**
 * Crea un usuario interno nuevo y lo deja operativo: cambia la contraseña
 * temporal (la API bloquea usuarios con contraseña temporal) y vuelve a
 * loguearse, porque el cambio invalida los tokens previos. Sirve para que
 * cada test tenga datos propios (comisiones, liquidaciones) sin chocar con
 * corridas anteriores sobre el mismo usuario sembrado.
 * @returns id y token del usuario creado
 */
Cypress.Commands.add(
  'apiCreateActiveUser',
  (role: string): Cypress.Chainable<{ id: string; dni: string; token: string }> => {
    const dni = `7${Date.now().toString().slice(-7)}`;
    const newPassword = 'E2eUser12345';
    return cy
      .apiCreateUser({
        full_name: `E2E ${role} ${dni}`,
        dni,
        email: `e2e-${dni}@test.com`,
        address: 'Calle E2E 123',
        role,
      })
      .then((created) => {
        const user = (created as { user: { id: string } }).user;
        const tempPassword = String((created as { tempPassword: string }).tempPassword);
        return requestLoginWithRetry({ dni, password: tempPassword }).then((loginRes) => {
          expect(loginRes.status, 'login con contraseña temporal').to.eq(200);
          const tempToken = String(loginRes.body?.data?.token);
          return cy
            .apiRequest(
              'PATCH',
              '/users/me/change-password',
              { current_password: tempPassword, new_password: newPassword },
              tempToken,
            )
            .then((changeRes) => {
              expect(changeRes.status, 'cambiar contraseña temporal').to.eq(200);
              return requestLoginWithRetry({ dni, password: newPassword }).then((res) => {
                expect(res.status, 'login con contraseña definitiva').to.eq(200);
                return { id: user.id, dni, token: String(res.body?.data?.token) };
              });
            });
        });
      });
  },
);

/**
 * Rechaza un crédito creado por un test para dejar la base como estaba:
 * libera las unidades de producto (vuelven a AVAILABLE) y lo saca de
 * pendientes. Tolera 409 (ya no estaba pendiente, por ejemplo si el test lo
 * aprobó) para poder usarse siempre en `after`, pase o falle el test.
 */
Cypress.Commands.add(
  'apiRejectCreditIfPending',
  (creditId: string): Cypress.Chainable<number> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'PATCH',
          `/credits/${creditId}/reject`,
          { rejection_reason: 'Limpieza automática de E2E' },
          token,
        )
        .then((res) => {
          expect(res.status, 'rechazar crédito de E2E').to.be.oneOf([200, 409]);
          return res.status;
        }),
    );
  },
);

/**
 * Fuerza el due_date de una cuota vía la ruta test-only del backend
 * (PATCH /api/test/installments/:id/force-due-date, requiere
 * ENABLE_TEST_ROUTES=true). Resetea last_penalty_applied_at para que el
 * cron de mora la trate como vencida desde la nueva fecha.
 */
Cypress.Commands.add(
  'apiForceInstallmentDueDate',
  (
    installmentId: string,
    dueDate: string,
  ): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'PATCH',
          `/test/installments/${installmentId}/force-due-date`,
          { due_date: dueDate },
          token,
        )
        .then((res) => {
          expect(res.status, 'forzar due_date de cuota (test route)').to.eq(
            200,
          );
          return res.body.data as Record<string, unknown>;
        }),
    );
  },
);

/**
 * Fuerza el created_at de un crédito vía la ruta test-only del backend
 * (PATCH /api/test/credits/:id/force-created-at, requiere
 * ENABLE_TEST_ROUTES=true). Para E2E del cron creditExpiry.
 */
Cypress.Commands.add(
  'apiForceCreditCreatedAt',
  (
    creditId: string,
    createdAt: string,
  ): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest(
          'PATCH',
          `/test/credits/${creditId}/force-created-at`,
          { created_at: createdAt },
          token,
        )
        .then((res) => {
          expect(res.status, 'forzar created_at de crédito (test route)').to.eq(
            200,
          );
          return res.body.data as Record<string, unknown>;
        }),
    );
  },
);

/**
 * Fuerza a vencidos los tokens (blacklist + refresh) de un usuario vía la
 * ruta test-only del backend (PATCH /api/test/tokens/:userId/force-expire,
 * requiere ENABLE_TEST_ROUTES=true). Para E2E del cron tokenCleanup.
 */
Cypress.Commands.add(
  'apiForceTokensExpired',
  (userId: string): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('PATCH', `/test/tokens/${userId}/force-expire`, null, token)
        .then((res) => {
          expect(res.status, 'forzar vencimiento de tokens (test route)').to.eq(
            200,
          );
          return res.body.data as Record<string, unknown>;
        }),
    );
  },
);

/**
 * Prepara una venta real sin consumir el stock existente: elige un producto
 * activo con variante activa y tasa activa, y crea una unidad nueva para el
 * test (las ventas aprobadas no se revierten; vender stock real lo agotaría
 * corrida tras corrida). Falla si no hay catálogo vendible.
 * @returns producto, variante, unidad creada (id y código) y plan de la tasa
 */
Cypress.Commands.add('apiCreateSaleUnit', (): Cypress.Chainable<SaleUnitFixture> => {
  type ProductApi = { id: string; status: string; variants?: Array<{ id: string; status: string }> };
  type RateApi = { active: boolean; installments_count: number; payment_frequency: string };
  return cy.getAuthToken('ADMIN').then((token) =>
    cy.apiRequest('GET', '/products', null, token).then((productsRes) => {
      expect(productsRes.status, 'listar productos').to.eq(200);
      const candidates = ((productsRes.body?.data ?? []) as ProductApi[])
        .filter((p) => p.status === 'ACTIVE')
        .map((p) => ({ productId: p.id, variant: p.variants?.find((v) => v.status === 'ACTIVE') }))
        .filter((c) => !!c.variant);

      const tryCandidate = (index: number): Cypress.Chainable<SaleUnitFixture> => {
        expect(index, 'catálogo vendible (producto activo con tasa activa)').to.be.lessThan(
          candidates.length,
        );
        const { productId, variant } = candidates[index];
        return cy
          .apiRequest('GET', `/product-rates?product_id=${productId}`, null, token)
          .then((ratesRes) => {
            expect(ratesRes.status, 'listar tasas de producto').to.eq(200);
            const rate = ((ratesRes.body?.data ?? []) as RateApi[]).find((r) => r.active);
            if (!rate) return tryCandidate(index + 1);
            const unitCode = `E2E-${Date.now()}-${index}`;
            return cy
              .apiRequest('POST', '/product-units', { variant_id: variant!.id, unit_code: unitCode }, token)
              .then((unitRes) => {
                expect(unitRes.status, `crear unidad de E2E — ${JSON.stringify(unitRes.body)}`).to.eq(201);
                return {
                  productId,
                  variantId: variant!.id,
                  unitId: String(unitRes.body?.data?.id),
                  unitCode,
                  installmentsCount: rate.installments_count,
                  paymentFrequency: rate.payment_frequency,
                };
              });
          });
      };
      return tryCandidate(0);
    }),
  );
});

/**
 * Elige en el paso de productos de "Nueva operación" la unidad exacta creada
 * por apiCreateSaleUnit, en lugar de la primera unidad disponible del catálogo.
 * @param fixture - unidad de E2E a agregar a la venta
 */
Cypress.Commands.add('selectSaleUnit', (fixture: SaleUnitFixture): void => {
  cy.get(`[data-cy="sale-product-${fixture.productId}"]`, { timeout: 20000 }).scrollIntoView().click();
  cy.get(`[data-cy="sale-variant-${fixture.variantId}"]`, { timeout: 15000 }).scrollIntoView().click();
  cy.contains('span', fixture.unitCode, { timeout: 20000 })
    .parent()
    .find('[data-cy="sale-add-unit"]')
    .scrollIntoView()
    .click();
  cy.contains('span', fixture.unitCode).parent().find('[data-cy="sale-remove-unit"]').should('exist');
});

/**
 * Desactiva las unidades de E2E (código "E2E-") que quedaron disponibles sin
 * venderse, por ejemplo porque el test falló antes de aprobar la venta. Así
 * una corrida fallida tampoco cambia el stock disponible del catálogo.
 */
Cypress.Commands.add('apiDeactivateLeftoverSaleUnits', (): void => {
  cy.getAuthToken('ADMIN').then((token) =>
    cy.apiRequest('GET', '/product-units?status=AVAILABLE', null, token).then((res) => {
      expect(res.status, 'listar unidades disponibles').to.eq(200);
      const leftovers = ((res.body?.data ?? []) as Array<{ id: string; unit_code: string }>).filter((u) =>
        String(u.unit_code).startsWith('E2E-'),
      );
      leftovers.forEach((unit) => {
        cy.apiRequest('PATCH', `/product-units/${unit.id}/deactivate`, null, token).then((deactivateRes) => {
          expect(deactivateRes.status, `desactivar unidad de E2E ${unit.unit_code}`).to.eq(200);
        });
      });
    }),
  );
});

type SaleUnitFixture = {
  productId: string;
  variantId: string;
  unitId: string;
  unitCode: string;
  installmentsCount: number;
  paymentFrequency: string;
};

/**
 * Obtiene un access token vigente para requests directos al backend real.
 * Desde #39 el token vive sólo en memoria de la app: se pide uno nuevo con la
 * cookie HttpOnly de refresh que dejó el login (cy.request comparte cookies).
 * @param portal - true para la sesión del portal, false para la interna
 */
Cypress.Commands.add('apiSessionToken', (portal = false) => {
  const path = portal ? 'auth/portal/refresh' : 'auth/refresh';
  return cy
    .request({ method: 'POST', url: `${String(Cypress.env('apiBaseUrl'))}/${path}`, body: {} })
    .then((res) => {
      const token = res.body?.data?.token as string;
      expect(token, `token ${path}`).to.be.a('string').and.not.be.empty;
      return token;
    });
});

declare global {
  namespace Cypress {
    interface Chainable {
      /** Obtiene un access token nuevo con la cookie HttpOnly de refresh (#39). */
      apiSessionToken(portal?: boolean): Chainable<string>;
      loginAs(role: InternalRole, destination?: string): Chainable<void>;
      loginReal(role: InternalRole, destination?: string): Chainable<void>;
      loginPortalAs(
        destination?: string,
        overrides?: Partial<PortalSession>,
      ): Chainable<void>;
      loginPortalReal(destination?: string): Chainable<void>;
      logout(): Chainable<void>;

      // ── API Helpers ───────────────────────────────────────────────────
      getAuthToken(role: ApiRole): Chainable<string>;
      apiRequest(
        method: string,
        path: string,
        body: object | null,
        token: string,
      ): Chainable<Cypress.Response<ApiEnvelope>>;
      apiCreateCustomer(data: {
        full_name: string;
        dni: string;
        address: string;
        phone: string;
        email?: string;
      }): Chainable<Record<string, unknown>>;
      apiCreateUser(data: {
        full_name: string;
        dni: string;
        email: string;
        address: string;
        role: string;
      }): Chainable<Record<string, unknown>>;
      apiUnlockUser(userId: string): Chainable<unknown>;
      apiApproveCredit(creditId: string): Chainable<Record<string, unknown>>;
      apiRejectCreditIfPending(creditId: string): Chainable<number>;
      apiCreateActiveUser(role: string): Chainable<{ id: string; dni: string; token: string }>;
      apiCreateSaleUnit(): Chainable<SaleUnitFixture>;
      selectSaleUnit(fixture: SaleUnitFixture): Chainable<void>;
      apiDeactivateLeftoverSaleUnits(): Chainable<void>;
      apiForceInstallmentDueDate(
        installmentId: string,
        dueDate: string,
      ): Chainable<Record<string, unknown>>;
      apiForceCreditCreatedAt(
        creditId: string,
        createdAt: string,
      ): Chainable<Record<string, unknown>>;
      apiForceTokensExpired(userId: string): Chainable<Record<string, unknown>>;
    }
  }
}
