# finFlow — Gestión de Créditos

Frontend de la plataforma de gestión de créditos y cobros, construida con Angular 18 (Standalone Components).

---

## Stack

| Tecnología          | Versión       |
| ------------------- | ------------- |
| Angular             | 18.2.x        |
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
│   ├── http/              # ApiHttpService (wrapper REST genérico)
│   ├── interceptors/      # JWT, loading, error
│   ├── models/            # AuthUser, ApiResponse<T>, UserRole
│   └── services/          # DateService, HeaderService, LoadingService
├── features/
│   ├── admin/             # Dashboard, aprobaciones, caja, usuarios, colecciones, pagos, comisiones, gastos, config
│   ├── seller/            # Clientes, operaciones, productos, comisiones
│   ├── collector/         # Ruta de cobro, pagos, comisiones
│   ├── portal/            # Portal cliente (login, dashboard, créditos)
│   ├── profile/           # Perfil del usuario
│   └── public/            # Login admin, recuperación/cambio de contraseña
├── shared/
│   ├── components/        # TempPasswordDialog
│   ├── layout/            # Header, Sidebar
│   ├── clients/           # ClientDetailComponent (tabs: créditos, docs, historial)
│   ├── operations/        # Wizard multi-paso (cliente → productos → condiciones → confirmación)
│   ├── products/          # Catálogo de productos
│   ├── simulator/         # Simulador de créditos
│   ├── states/            # LoadingState, EmptyState, ErrorState
│   ├── models/            # Interfaces compartidas, enums (AppRoutes, UserRoleEnum)
│   └── utils/             # nav-config y utilidades
└── mocks/                 # MockAuthService, MockDataService
```

### Patrones clave

- **Standalone Components** — sin NgModules
- **Lazy loading** — cada feature route carga bajo demanda
- **Signals** — estado reactivo moderno (Angular Signals + RxJS)
- **Adapter pattern** — servicios convierten `snake_case` (backend) ↔ `camelCase` (frontend)
- **Guard composition** — `authGuard` + `roleGuard` + `tempPasswordGuard` apilados por ruta
- **In-memory cache** — servicios de datos de configuración (tasas, categorías, parámetros) usan `shareReplay(1)` con `Map<key, Observable>` e invalidan en cada mutación via `tap()`
- **SSR habilitado** — Express server (`server.ts`)

---

## Roles

| Rol                | Acceso                       |
| ------------------ | ---------------------------- |
| `ADMIN`            | Todo                         |
| `SELLER`           | `/seller/*`                  |
| `COLLECTOR`        | `/collector/*`               |
| `SELLER_COLLECTOR` | `/seller/*` + `/collector/*` |

---

## Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
ng serve
# → http://localhost:4200

# Servidor de desarrollo accesible en red (para e2e)
ng serve --host 0.0.0.0

# Build producción
ng build

# Tests unitarios (Karma)
ng test

# Tests e2e — modo interactivo
npx cypress open

# Tests e2e — modo headless
npx cypress run

# Suite de smoke tests contra servidor real
npm run e2e:smoke:real

# Suite de smoke tests con servidor levantado automáticamente
npm run e2e:smoke:real:stable

# Correr todos los e2e con reporte Mochawesome
npm run e2e:all
```

---

## Variables de entorno

Configurar en `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiBaseUrl: "http://localhost:3000",
  tokenKey: "finflow_token",
};
```
