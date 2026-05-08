// ── Custom Commands ────────────────────────────────────────────────────────────

type InternalRole = 'ADMIN' | 'SELLER' | 'COLLECTOR';

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
  cy.clearAllLocalStorage();
  cy.visit('/login');
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(role: InternalRole, destination?: string): Chainable<void>;
      loginPortalAs(
        destination?: string,
        overrides?: Partial<PortalSession>,
      ): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}
