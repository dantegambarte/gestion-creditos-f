# Plan de Pruebas E2E — SisCreditos

## Stack
Angular 18 · PrimeNG 17 · Cypress 13 · TypeScript · Tailwind CSS  
Viewports: 1280×720 (desktop)

---

## Archivos generados

| Archivo | Suite | Tests |
|---------|-------|-------|
| `01-auth.cy.ts` | Autenticación | 9 |
| `02-sidebar-navigation.cy.ts` | Sidebar / Guardias de ruta | 16 |
| `03-nueva-operacion-real.cy.ts` | Wizard Nueva Operación (real) | 4 |
| `04-clientes.cy.ts` | Gestión de Clientes (shared/admin) | 20 |
| `05-negative-auth.cy.ts` | Auth — casos negativos | ~10 |
| `06-negative-clientes.cy.ts` | Clientes — casos negativos | ~10 |
| `07-negative-nueva-operacion.cy.ts` | Wizard — casos negativos | ~10 |
| `08-negative-guards.cy.ts` | Guards — rol incorrecto / sin sesión | ~10 |
| `09-admin-usuarios.cy.ts` | Admin — Gestión de Usuarios | 18 |
| `09-cobranzas-collector.cy.ts` | Collector — Ruta y Cobros (real) | 3 |
| `10-admin-aprobaciones-real.cy.ts` | Admin — Aprobaciones (real) | 3 |
| `11-caja-tesoreria.cy.ts` | Admin — Caja y Tesorería | ~15 |
| `12-portal-clientes.cy.ts` | Portal Cliente | ~12 |
| `13-admin-dashboard.cy.ts` | Admin — Dashboard | 7 |
| `14-seller-operaciones.cy.ts` | Seller — Lista de Operaciones | 8 |
| `15-seller-productos.cy.ts` | Seller/Admin — Productos | 9 |
| `16-comisiones.cy.ts` | Seller/Collector/Admin — Comisiones | 11 |
| `17-admin-colecciones-gastos-pagos.cy.ts` | Admin — Gastos y Cobros (real) | 5 |
| `18-admin-reportes-mora.cy.ts` | Admin — Reportes y Morosidad | 10 |
| `19-public-password.cy.ts` | Recuperar / Cambiar Contraseña | 15 |
| `20-admin-config-sheet.cy.ts` | Admin — Configuración y Sheet legacy (real) | 4 |
| `21-seller-clientes-nuevo-real.cy.ts` | Seller — Lista y Crear Cliente (real) | 5 |
| `22-admin-generar-planilla.cy.ts` | Admin — Generar Planilla (/collections/new, real) | 3 |
| `23-credit-detail.cy.ts` | Detalle de Crédito (Seller/Admin + carga/error) | 12 |
| `24-producto-detalle-editar.cy.ts` | Producto: Detalle, Editar, Variantes, Unidades | 21 |
| `25-seller-cliente-detalle.cy.ts` | Detalle de Cliente (Seller/Admin + carga/error) | 12 |
| `26-collector-planilla-detalle.cy.ts` | Collector — Detalle de Planilla (real) | 3 |
| `27-portal-credits.cy.ts` | Portal — Créditos y Detalle de Crédito | 12 |
| `28-admin-user-detail.cy.ts` | Admin — Detalle de Usuario | 13 |
| `29-admin-collection-detail.cy.ts` | Admin — Detalle de Planilla de Cobro (real) | 3 |
| `30-producto-crear.cy.ts` | Admin — Crear Producto | 9 |
| **Total estimado** | | **~393** |

---

## Suite 01 — Autenticación

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| AUTH-01 | Render formulario login | DNI, Password, botón visibles |
| AUTH-02 | Submit vacío | Mensajes de validación visibles |
| AUTH-03 | DNI < 7 dígitos | "DNI inválido (7-9 dígitos)" |
| AUTH-04 | DNI con letras | "DNI inválido (7-9 dígitos)" |
| AUTH-05 | Login Admin (DNI 12345678) | Redirige a /admin/dashboard |
| AUTH-06 | Login Seller (DNI 87654321) | Redirige a /seller/operations |
| AUTH-07 | Login Collector (DNI 11223344) | Redirige a /collector/route |
| AUTH-08 | DNI inexistente | Mensaje "Credenciales incorrectas" visible |
| AUTH-09 | Usuario autenticado visita /login | noAuthGuard redirige a dashboard |
| AUTH-10 | Logout desde sidebar | Redirige a /login, localStorage limpio |

---

## Suite 02 — Sidebar y Navegación por Rol

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| NAV-01 | Admin ve grupos Principal/Gestión/Administración/Sistema | Todos los grupos visibles |
| NAV-02 | Admin ve items exclusivos (Usuarios, Aprobaciones, etc.) | Items presentes |
| NAV-03 | Badge "3" en Aprobaciones | p-badge con valor 3 |
| NAV-04 | Click Clientes → /admin/clients | URL correcta |
| NAV-05 | Click Aprobaciones → /admin/approvals | URL correcta |
| NAV-06 | Ítem activo con clases bg-blue-600/20 | Estilo de selección correcto |
| NAV-07 | Nombre y rol en sidebar | "Carlos López" · "ADMIN" |
| NAV-08 | Seller no ve Administración ni Sistema | Secciones ausentes |
| NAV-09 | Seller ve Operaciones, Clientes, Productos | Items presentes |
| NAV-10 | Collector ve "Cobranza en campo" | Mi Ruta, Mis cobros, Mis comisiones |
| NAV-11 | Sin sesión → /admin/dashboard → /login | authGuard activo |
| NAV-12 | Sin sesión → /seller/operations → /login | authGuard activo |
| NAV-13 | Admin → /collector/route → redirigido | roleGuard activo |
| NAV-14 | Collector → /admin/dashboard → redirigido | roleGuard activo |

---

## Suite 03 — Wizard Nueva Operación

| ID | Paso | Escenario | Resultado esperado |
|----|------|-----------|-------------------|
| OP-01 | — | Render header + p-steps | Título y 4 pasos visibles |
| OP-02 | — | Indicador "Paso 1 de 4" | Texto visible |
| OP-03 | 0 | Lista de clientes visible | Al menos 1 registro |
| OP-04 | 0 | Siguiente deshabilitado sin selección | Botón disabled |
| OP-05 | 0 | Búsqueda filtra lista | Lista reducida |
| OP-06 | 0 | Seleccionar cliente habilita panel y Siguiente | Panel con datos, botón activo |
| OP-07 | 0 | Ícono check en cliente seleccionado | pi-check-circle visible |
| OP-08 | 0 | Panel vacío con mensaje guía | "Ningún cliente seleccionado" |
| OP-09 | 1 | Selector Venta/Préstamo visible | Ambas opciones visibles |
| OP-10 | 1 | Anterior regresa al paso 0 | "Paso 1 de 4" visible |
| OP-11 | 2 | Campo fecha del primer pago (p-calendar) | Visible |
| OP-12 | 2 | Panel "Total a devolver" y "Valor de cada cuota" | Visible |
| OP-13 | 2 | Dropdown cantidad cuotas (tipo Venta) | Visible |
| OP-14 | 3 | Resumen con Cliente/Producto/Condiciones | Secciones visibles |
| OP-15 | 3 | "Enviar" deshabilitado sin checks | Botón disabled |
| OP-16 | 3 | Habilita "Enviar" con 4 checks marcados | Botón activo |
| OP-17 | 3 | Aviso amarillo supervisor | Texto visible |
| OP-18 | 3 | 4 checkboxes de declaraciones | p-checkbox × 4 |
| OP-19 | — | Botón X cancela y sale del wizard | URL sin /new |
| OP-20 | — | Botón Cancelar sale del wizard | URL sin /new |
| OP-21 | — | Query param ?clientDni= pre-selecciona cliente | Panel "Cliente Seleccionado" visible |

---

## Suite 04 — Gestión de Clientes

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| CLI-01 | Título y tabla visibles | "Gestión de Clientes" + p-table |
| CLI-02 | 6 columnas en la tabla | DNI/Nombre/Teléfono/Créditos/Riesgo/Acciones |
| CLI-03 | Al menos 1 cliente en tabla | tbody tr ≥ 1 |
| CLI-04 | p-tag de riesgo en primera fila | p-tag existe |
| CLI-05 | Búsqueda filtra filas | Filas ≤ total original |
| CLI-06 | Limpiar búsqueda restaura lista | Filas = total original |
| CLI-07 | Dropdown filtro tiene opciones | p-dropdown-item ≥ 1 |
| CLI-08 | Modal "Ver" abre al click en Ver | p-dialog visible |
| CLI-09 | Modal Ver muestra DNI/Teléfono/Riesgo | Campos visibles |
| CLI-10 | Cerrar modal Ver | Modal no visible |
| CLI-11 | Modal "Editar" abre | p-dialog con título Editar Cliente |
| CLI-12 | Formulario edición tiene todos los campos | Inputs y dropdown presentes |
| CLI-13 | Botón Guardar disponible con form válido | No disabled |
| CLI-14 | Editar teléfono y guardar actualiza tabla | Teléfono nuevo en tabla |
| CLI-15 | Modal "Créditos" (si cliente tiene créditos) | Texto crédito(s) activo(s) |
| CLI-16 | Modal Crear — campos presentes | 7 inputs visibles |
| CLI-17 | Crear deshabilitado con form vacío | ng-reflect-disabled=true |
| CLI-18 | Validación al tocar campo vacío | span.text-red-500 existe |
| CLI-19 | Completar form y crear — +1 fila en tabla | Fila nueva en tabla |
| CLI-20 | Botón Borrar limpia form | Input nombres vacío |
| CLI-21 | Cancelar sin crear — tabla sin cambios | Filas = count inicial |
| CLI-22 | Seller accede a /seller/clients | Tabla visible |

---

## Estrategia de Fixtures y Mocks

- **Sin backend real:** todos los tests usan `MockAuthService` + datos mock en memoria.
- **Inyección de sesión:** comando `cy.loginAs(role)` escribe en `localStorage` los tokens
  que `MockAuthService.rehydrate()` espera, evitando pasar por la UI de login.
- **Tiempo de espera:** no se usa `cy.wait(ms)`. Las esperas son implícitas mediante
  `cy.url().should(...)`, `cy.contains(...)` y `cy.get(...).should(...)`.
- **Datos de prueba:** dependen de los mocks en `OperationFormService` y `ClientsComponent`.
  Si se integra un backend, agregar `cy.intercept()` en los `beforeEach`.

---

## Próximos pasos recomendados

1. Integrar `cy.intercept()` cuando se conecte el backend real.
2. Añadir fixtures JSON (`cypress/fixtures/`) para clientes, productos y operaciones.
3. Configurar `cypress-real-events` para interacciones con PrimeNG Datepicker/Dropdown más fiables.
4. Agregar suite de smoke para el portal cliente (`/portal/*`).
5. Configurar CI (GitHub Actions / GitLab CI) con `cypress run --headless`.
