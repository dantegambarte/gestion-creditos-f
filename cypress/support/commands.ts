// ── Custom Commands ────────────────────────────────────────────────────────────

type InternalRole = 'ADMIN' | 'SELLER' | 'COLLECTOR' | 'SELLER_COLLECTOR';

type RealCredentials = {
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
    SELLER_COLLECTOR: { dniKey: 'realSellerCollectorDni', passKey: 'realSellerCollectorPassword' },
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
  retries = 20,
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
        return res;
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

      cy.wait(waitMs);
      return requestLoginWithRetry(creds, retries - 1);
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
  // GET /auth/me devuelve el usuario correcto para que APP_INITIALIZER
  // (AuthService.restoreSession) persista el usuario en _user$.
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
 * Inicia sesión real por UI y navega de forma robusta al destino solicitado.
 * @param role Rol a autenticar contra backend real.
 * @param destination Ruta protegida de destino opcional. Si el redirect real
 * post-login cae en home del rol, este helper navega explícitamente al destino.
 */
Cypress.Commands.add(
  'loginReal',
  (role: InternalRole, destination?: string) => {
    assertRealAuthEnabled();
    const { dni, password } = getRealCredentials(role);
    const roleHome = REAL_ROLE_HOME[role];
    const normalizedDestination = destination
      ? normalizePath(destination)
      : undefined;

    cy.clearAllLocalStorage();

    const cachedToken = AUTH_TOKEN_CACHE[role];

    const visitWithToken = (
      token: string,
      user: Record<string, unknown> | null,
    ) => {
      cy.visit(normalizedDestination ?? roleHome, {
        onBeforeLoad(win) {
          win.localStorage.setItem(INTERNAL_TOKEN_KEY, token);
          if (user) {
            win.localStorage.setItem(INTERNAL_USER_KEY, JSON.stringify(user));
          }
        },
      });
    };

    if (cachedToken) {
      visitWithToken(cachedToken, null);
    } else {
      requestLoginWithRetry({ dni, password }).then((res) => {
        expect(res.status, `[cypress][loginReal] login ${role}`).to.eq(200);
        const token = res.body?.data?.token;
        const user =
          (res.body?.data?.user as Record<string, unknown> | undefined) ?? null;

        expect(token, '[cypress][loginReal] token backend').to.be.a('string')
          .and.not.be.empty;

        AUTH_TOKEN_CACHE[role] = token as string;
        visitWithToken(token as string, user);
      });
    }

    cy.url({ timeout: 15000 }).should(
      'include',
      normalizedDestination ?? roleHome,
    );

    if (!normalizedDestination) {
      return;
    }

    cy.location('pathname', { timeout: 15000 }).then((pathname) => {
      const normalizedCurrentPath = normalizePath(pathname);
      if (normalizedCurrentPath !== normalizedDestination) {
        cy.visit(normalizedDestination);
      }
    });

    cy.location('pathname', { timeout: 15000 }).should(
      'eq',
      normalizedDestination,
    );
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

    cy.visit(destination ?? PORTAL_DEFAULT_HOME, {
      onBeforeLoad(win) {
        seedPortalSession(win, session);
      },
    });
  },
);

/** Limpia estado de auth y navega a /login */
Cypress.Commands.add('logout', () => {
  delete AUTH_TOKEN_CACHE.ADMIN;
  delete AUTH_TOKEN_CACHE.SELLER;
  delete AUTH_TOKEN_CACHE.COLLECTOR;
  cy.clearAllLocalStorage();
  cy.visit('/login');
});

// ── API Helpers — para E2E real sin mocks ────────────────────────────────────
// Todos usan la URL del backend directamente (no pasan por el proxy Angular).

const API_BASE = () => Cypress.env('apiBaseUrl') as string;

type ApiRole = InternalRole;

/**
 * Obtiene un token real haciendo POST /auth/login con las credenciales
 * configuradas en Cypress.env para el rol indicado.
 */
Cypress.Commands.add(
  'getAuthToken',
  (role: ApiRole): Cypress.Chainable<string> => {
    const dniKey = `real${role.charAt(0) + role.slice(1).toLowerCase()}Dni`;
    const passKey = `real${role.charAt(0) + role.slice(1).toLowerCase()}Password`;

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
  ): Cypress.Chainable<Cypress.Response<unknown>> => {
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
  (userId: string): Cypress.Chainable<void> => {
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
 * Aprueba un crédito por id usando el token Admin.
 * Devuelve el crédito actualizado.
 */
Cypress.Commands.add(
  'apiApproveCredit',
  (creditId: string): Cypress.Chainable<Record<string, unknown>> => {
    return cy.getAuthToken('ADMIN').then((token) =>
      cy
        .apiRequest('PATCH', `/credits/${creditId}/approve`, null, token)
        .then((res) => {
          expect(res.status, 'aprobar crédito').to.eq(200);
          return res.body.data as Record<string, unknown>;
        }),
    );
  },
);

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(role: InternalRole, destination?: string): Chainable<void>;
      loginReal(role: InternalRole, destination?: string): Chainable<void>;
      loginPortalAs(
        destination?: string,
        overrides?: Partial<PortalSession>,
      ): Chainable<void>;
      logout(): Chainable<void>;

      // ── API Helpers ───────────────────────────────────────────────────
      getAuthToken(role: ApiRole): Chainable<string>;
      apiRequest(
        method: string,
        path: string,
        body: object | null,
        token: string,
      ): Chainable<Cypress.Response<unknown>>;
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
      apiUnlockUser(userId: string): Chainable<void>;
      apiApproveCredit(creditId: string): Chainable<Record<string, unknown>>;
    }
  }
}
