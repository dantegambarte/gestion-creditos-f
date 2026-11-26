# Productcred s.a.s. — Gestión de Créditos

Frontend de la plataforma de gestión de créditos y cobros, construida con Angular 18 (Standalone Components).

---

## Stack

| Tecnología          | Versión       |
| ------------------- | ------------- |
| Angular             | 18.2.x        |
| Angular SSR         | 18.2.x        |
| TypeScript          | 5.5.2         |
| Tailwind CSS        | 3.4.19        |
| PrimeNG             | 17.18.15      |
| RxJS                | 7.8.0         |
| chart.js            | 4.5.1         |
| date-fns            | 3.6.0         |
| jsPDF + html2canvas | 4.2.1 / 1.4.1 |

---

## Módulos

### Admin (`/admin/*`)

| Ruta                                      | Descripción                                          |
| ----------------------------------------- | ---------------------------------------------------- |
| `/admin/dashboard`                        | KPIs y resumen de operaciones recientes              |
| `/admin/operations`                       | Listado de operaciones                               |
| `/admin/operations/new`                   | Crear nueva operación (wizard multi-paso)            |
| `/admin/operations/:id`                   | Detalle de operación / crédito                       |
| `/admin/clients`                          | Directorio de clientes                               |
| `/admin/clients/:dni`                     | Detalle de cliente (créditos, documentos, historial) |
| `/admin/products`                         | Catálogo de productos                                |
| `/admin/products/new`                     | Crear producto                                       |
| `/admin/products/:id`                     | Detalle de producto                                  |
| `/admin/products/:id/edit`                | Editar producto                                      |
| `/admin/products/:id/variants`            | Variantes del producto                               |
| `/admin/products/:id/variants/:vId/units` | Unidades de una variante                             |
| `/admin/products/config/categories`       | Configuración de categorías de producto              |
| `/admin/products/config/brands`           | Configuración de marcas de producto                  |
| `/admin/users`                            | Listado de usuarios                                  |
| `/admin/users/new`                        | Crear usuario                                        |
| `/admin/users/:id`                        | Detalle y edición de usuario                         |
| `/admin/approvals`                        | Flujo de aprobación de créditos                      |
| `/admin/delinquency`                      | Seguimiento de mora                                  |
| `/admin/cash-register`                    | Caja y movimientos de pago                           |
| `/admin/collections`                      | Planillas de cobro generadas                         |
| `/admin/collections/:id`                  | Detalle de planilla de cobro                         |
| `/admin/payments`                         | Pagos recibidos                                      |
| `/admin/expenses`                         | Registro de gastos                                   |
| `/admin/commissions`                      | Comisiones de vendedores y cobradores                |
| `/admin/reports`                          | Reportes                                             |
| `/admin/simulator`                        | Simulador de créditos                                |
| `/admin/config`                           | Configuración general (ver sub-rutas abajo)          |
| `/admin/sheet`                            | Redirect → `/admin/collections`                      |

#### Sub-rutas de `/admin/config`

| Ruta                          | Descripción                      |
| ----------------------------- | -------------------------------- |
| `/admin/config/company`       | Datos de la empresa              |
| `/admin/config/rates`         | Tasas de interés (LOAN)          |
| `/admin/config/product-rates` | Tasas de producto (SALE)         |
| `/admin/config/system-params` | Parámetros del sistema           |
| `/admin/config/users`         | Gestión de usuarios desde config |
| `/admin/config/notifications` | Configuración de notificaciones  |
| `/admin/config/holidays`      | Feriados y días no hábiles       |

### Seller (`/seller/*`)

| Ruta                        | Descripción                         |
| --------------------------- | ----------------------------------- |
| `/seller/clients`           | Directorio de clientes con filtros  |
| `/seller/clients/new`       | Alta de nuevo cliente               |
| `/seller/clients/:dni`      | Detalle y edición de cliente        |
| `/seller/operations`        | Listado de operaciones del vendedor |
| `/seller/operations/new`    | Crear nueva operación               |
| `/seller/operations/:id`    | Detalle de operación                |
| `/seller/products`          | Catálogo de productos               |
| `/seller/products/new`      | Crear producto (solo ADMIN)         |
| `/seller/products/:id`      | Detalle de producto                 |
| `/seller/products/:id/edit` | Editar producto (solo ADMIN)        |
| `/seller/commissions`       | Comisiones del vendedor             |

### Collector (`/collector/*`)

| Ruta                        | Descripción                       |
| --------------------------- | --------------------------------- |
| `/collector/route`          | Ruta de cobro asignada            |
| `/collector/route/:sheetId` | Detalle de planilla de cobro      |
| `/collector/payments`       | Pagos registrados por el cobrador |
| `/collector/commissions`    | Comisiones del cobrador           |

### Portal cliente (`/portal/*`)

| Ruta                  | Descripción                       |
| --------------------- | --------------------------------- |
| `/portal/login`       | Acceso del cliente (JWT separado) |
| `/portal/dashboard`   | Resumen de cuenta del cliente     |
| `/portal/credits`     | Listado de créditos del cliente   |
| `/portal/credits/:id` | Detalle de crédito                |

### Público

| Ruta               | Descripción                           |
| ------------------ | ------------------------------------- |
| `/login`           | Autenticación admin/roles             |
| `/forgot-password` | Recuperación de contraseña            |
| `/change-password` | Cambio de contraseña (auth requerida) |
| `/profile`         | Perfil del usuario autenticado        |

---

## Arquitectura

```
src/app/
├── core/                  # Servicios singleton, auth, HTTP
│   ├── auth/              # Guards (authGuard, roleGuard, noAuthGuard, tempPasswordGuard)
│   │                      # + AuthService, TokenRefreshService
│   ├── directives/        # Directivas de uso global (ej: scroll)
│   ├── http/              # ApiHttpService (wrapper REST genérico)
│   ├── interceptors/      # JWT, loading, error
│   ├── models/            # AuthUser, ApiResponse<T>, UserRole
│   ├── pipes/             # Pipes globales
│   ├── routing/           # RoleBasedPreloadingStrategy
│   └── services/          # DateService, FormatService, HeaderService,
│                          # LoadingService, NetworkAwareService,
│                          # NotificationsService, PwaUpdateService
├── features/
│   ├── admin/             # Dashboard, aprobaciones, caja, usuarios, colecciones,
│   │                      # pagos, comisiones, gastos, mora, reportes, config
│   ├── seller/            # Clientes, operaciones, productos, comisiones
│   ├── collector/         # Ruta de cobro, pagos, comisiones
│   ├── portal/            # Portal cliente (login, dashboard, créditos)
│   ├── profile/           # Perfil del usuario autenticado
│   └── public/            # Login admin, recuperación/cambio de contraseña
├── shared/
│   ├── components/        # BackButton, BackTopFab, TempPasswordDialog
│   ├── directives/        # ActiveTabScroller, CurrencyAmountInput, PasswordTabSkip
│   ├── layout/            # Header, Sidebar
│   ├── clients/           # ClientDetailComponent (tabs: créditos, docs, historial)
│   ├── operations/        # Wizard multi-paso (tipo → cliente → productos → condiciones → confirmación)
│   ├── products/          # Catálogo de productos compartido
│   ├── simulator/         # Simulador de créditos
│   ├── states/            # LoadingState, EmptyState, ErrorState
│   ├── models/            # Interfaces compartidas, enums (AppRoutes, UserRoleEnum)
│   └── utils/             # nav-config y utilidades
└── mocks/                 # MockAuthService, MockDataService
```

### Patrones clave

- **Standalone Components** — sin NgModules
- **Lazy loading** — cada feature route carga bajo demanda con `RoleBasedPreloadingStrategy`
- **Signals** — estado reactivo moderno (Angular Signals + RxJS)
- **Smart/Dumb pattern** — componentes contenedor con servicio de fachada; steps del wizard son puramente presentacionales
- **Adapter pattern** — servicios convierten `snake_case` (backend) ↔ `camelCase` (frontend)
- **Guard composition** — `authGuard` + `roleGuard` + `tempPasswordGuard` apilados por ruta
- **In-memory cache** — servicios de datos de configuración (tasas, categorías, parámetros) usan `shareReplay(1)` con `Map<key, Observable>` e invalidan en cada mutación via `tap()`
- **SSR habilitado** — `@angular/ssr` con Express server (`main.server.ts`)
- **PWA** — `manifest.webmanifest` + `ngsw-config.json`; soporte instalación en iOS/Android

---

## Roles

| Rol                | Acceso                                |
| ------------------ | ------------------------------------- |
| `ADMIN`            | Todo                                  |
| `SELLER`           | `/seller/*`                           |
| `COLLECTOR`        | `/collector/*`                        |
| `SELLER_COLLECTOR` | `/seller/*` + `/collector/*`          |
| `CASHIER`          | `/admin/cash-register` (caja)         |

---

## Tests E2E

Suite Cypress con más de 80 archivos de spec cubriendo:

- Autenticación y guards
- Navegación y sidebar (desktop + mobile)
- Flujo completo nueva operación
- Gestión de clientes
- Aprobaciones, caja, cobranzas, portal
- Comisiones, feriados, notificaciones, perfil
- UX mobile (viewport 375×667 — iPhone SE)
- PWA e instalabilidad
- Negative cases y guards

### Suites reales (backend real)

Las suites que usan `cy.loginReal`, `cy.getAuthToken`, `cy.apiRequest` o `cy.api*` le pegan al backend local (`http://localhost:3000/api`) y escriben en su base. Necesitan el backend corriendo en modo E2E (`npm run dev:e2e` en el backend) y el frontend en `pnpm start:e2e`.

- **Nunca contra producción.** Usan la base que tenga configurada el `.env` del backend.
- **Guard de modo real:** con `CYPRESS_realAuthEnabled=false` se saltean solas. `cypress.config.ts` las detecta al arrancar (`cypress/scripts/real-spec-detector.js`).
- **Reset destructivo bloqueado:** la task `db:reset:full` solo corre con `CYPRESS_allowDbReset=true`, y nunca si el backend apunta a `NODE_ENV=production` o a un host que no sea local.
- **Reglas para escribir una suite real:**
  - Cada test crea los datos que necesita: no depende de otro test ni de lo que haya en la base. Para usuarios nuevos y operativos, usar `cy.apiCreateActiveUser(role)`.
  - Lo que se modifica se restaura en `after()`/`afterEach()`, que corren pase o falle el test. Por ejemplo, créditos con `cy.apiRejectCreditIfPending`, feriados desactivados, `system_config` y saldos de caja devueltos a su valor original.
  - Clientes y usuarios no tienen DELETE en la API: usar DNIs únicos por corrida.
  - Las ventas aprobadas no se revierten, así que nunca vender stock existente. `cy.apiCreateSaleUnit()` crea una unidad propia (código `E2E-…`) y `cy.selectSaleUnit(unidad)` la elige en el catálogo de "Nueva operación". Crear la unidad antes de `cy.visit`, porque el catálogo se carga al entrar. En `after()`, `cy.apiDeactivateLeftoverSaleUnits()` desactiva las unidades de E2E que quedaron sin vender.
  - No encadenar un `cy.visit` justo después de `cy.loginReal(rol, destino)`: aborta el `GET /auth/me` en vuelo y la app limpia la sesión.
  - Si falta un dato de catálogo, el test tiene que fallar, no pasar en verde salteando las aserciones.

---

## Desarrollo

```bash
# Instalar dependencias (respeta pnpm-lock.yaml; también instala los hooks de git)
# Requiere Node 22.13+ (.nvmrc) y pnpm (corepack enable)
pnpm install --frozen-lockfile

# Servidor de desarrollo
pnpm start
# → http://localhost:4200

# Servidor accesible en red (para Cypress contra dispositivos reales)
pnpm start:e2e

# Tests unitarios (Karma)
ng test

# Tests unitarios como en CI (headless, con umbral de cobertura)
pnpm test:ci

# Specs de una sola feature
pnpm exec ng test --watch=false --include=src/app/features/<feature>

# Lint de archivos puntuales (sin warnings permitidos)
pnpm lint src/app/features/<feature>/<archivo>.ts

# Tests E2E — modo interactivo
pnpm e2e

# Tests E2E — modo headless (con runner seguro)
pnpm e2e:run

# Suite de smoke tests contra servidor real
pnpm e2e:smoke:real

# Smoke tests con servidor levantado automáticamente
pnpm e2e:smoke:real:stable

# Todos los E2E + reporte Mochawesome
pnpm e2e:all

# Servir build SSR
pnpm serve:ssr:gestion-creditos-f
```

---

## Calidad y CI

**Hooks de git** (Husky, se instalan con `pnpm install`):
- `pre-commit`: ESLint (`--max-warnings 0`) y Prettier (`--write`) solo sobre los archivos staged.
- `pre-push`: tests del script de alcance y suite unitaria completa (`pnpm test:ci`).

**Lint incremental:** no se reformatea el repo de una vez. Cada archivo que tocás tiene que quedar limpio. Reglas: sin `any` (salvo en specs), sin `console.log` (se permiten `console.warn` y `console.error`).

**Workflow `.github/workflows/ci.yml`** corre solo lo que el PR tocó. El alcance lo decide `scripts/ci-scope.mjs`:

| Qué se tocó | Qué corre |
|---|---|
| Solo docs (`*.md`, `docs/`), E2E (`cypress/`) o `.husky/` | Nada de tests unitarios |
| Una feature (`src/app/features/<x>`) | Lint de los cambiados + specs de esa feature (si la carpeta ya no tiene specs, se omite) |
| Código compartido (`src/app/core/`, `src/app/shared/`, `src/environments/`, `angular.json`, `package*.json`, `tsconfig*`, `karma.conf.js`, `eslint.config.js`, `scripts/`, `.github/`) o cualquier otro archivo no listado | Suite completa con umbral de cobertura |

- La suite completa también corre al mergear a `main`, todas las noches (si falla, abre o actualiza un issue con la etiqueta `ci:nightly`) y en un PR con la etiqueta `ci:full`.
- El umbral de cobertura está en `karma.conf.js` (50% de líneas, base del 2026-11-24). Subilo cuando la cobertura crezca; nunca lo bajes.
- `environment.ts` no está versionado: en CI se genera copiando `environment.development.ts`.

---

## Variables de entorno

Configurar en `src/environments/environment.development.ts`:

```ts
export const environment = {
  production: false,
  useMocks: false,
  apiBaseUrl: 'http://localhost:3000/api',
  tokenKey: 'sgcf_token',
  portalTokenKey: 'sgcf_portal_token',
};
```
