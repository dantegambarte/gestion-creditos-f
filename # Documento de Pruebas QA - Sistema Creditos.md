# Documento de Pruebas QA - Sistema Créditos

**Propósito:** Registrar los casos de uso, validar el comportamiento esperado (Frontend y Backend) y documentar los errores para la generación de prompts de corrección.

## 🟢 1. Módulo: Crédito

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **CR-01** | Operación Crédito | Click en "Enviar para Aprobación". | Debería enviar la operación para ser aprobada. | Corregido / Validado |
| **CR-02** | Operación Crédito | En fecha de primer pago puse una fecha anterior a la actual. | Debería estar deshabilitadas las fechas anteriores a la actual. | Corregido / Validado |
| **CR-03** | Operación Crédito | Click en "Tipo de operación" y "Préstamo personal". | Debería desaparecer los productos. | Corregido / Validado |
| **CR-04** | Operación Crédito | Escribí "aire" en "Buscar productos". | Debería filtrar la búsqueda por el nombre. | Corregido / Validado |
| **CR-05** | Configuración del Crédito | Click en "Siguiente" sin elegir "Fecha de primer pago". | Debería estar deshabilitado el botón "Siguiente". | Corregido / Validado |
| **CR-06** | Operación Crédito - Declaraciones y Autorizaciones | Dejé sin marcar la casilla "Autorizo el desembolso inmediato". | Debería estar deshabilitado el botón "Siguiente" hasta marcar la casilla. | Corregido / Validado |
| **CR-07** | Operación Crédito - Operaciones | Click en "Activo" para filtrar las operaciones. | Debería filtrar las operaciones. | Corregido / Validado |
| **CR-08** | Operación Crédito - Operaciones - Admin | Escribí "Perez" en el buscador (Seller ops). | Debería filtrar los clientes. | Corregido / Validado |
| **CR-08b** | Nueva Operación - Admin | Escribí "Perez" en el buscador. | Debería filtrar los clientes. | Corregido / Validado — error handler agregado a initialize(); si la carga de clientes falla, ahora muestra toast con instrucción de recargar |
| **CR-09** | Regresión en selección de unidad. | Si posee stock, la operación debería enviarse. | Corregido / Validado — error "unidad no disponible" ahora muestra mensaje claro + recarga automática del catálogo |
| **CR-10** | Calendario de primer pago. | El calendario se muestra correctamente y permite seleccionar fecha. | Corregido / Validado — removido `iconDisplay="input"`, agregado `autoZIndex="true"`; panel con `appendTo="body"` |
| **CR-11** | Operación venta de un producto - Admin. | Debería cambiar el interés según el producto, la cantidad de cuotas y la frecuencia. | Pendiente datos — backend soporta WEEKLY/BIWEEKLY/MONTHLY; configurar tasas en Admin → Config → Tasas para que aparezcan las frecuencias |
| **CR-12** | Operaciones pre-aprobadas y aprobadas - Admin. | Debería poder consultar el detalle de las operaciones. | Corregido / Validado — ruta `/admin/operations/:id` existe y carga el detalle completo con cuotas y productos |
| **CR-13** | Nueva Operacion - Seller. | Las letras deben ser legibles contra el fondo. | Corregido / Validado — headings en step-confirm ahora tienen `text-white` explícito |
| **CR-14** | Operaciones - Admin. | Al desplegar el filtro de estado no debe quedar cortado. | Corregido / Validado — `appendTo="body"` en dropdown de estado |
| **CR-15** | Operación Crédito - Declaraciones y Autorizaciones. | La tilde en los casilleros debe ser visible. | Corregido / Validado — `.p-checkbox-icon { color: #ffffff !important }` en styles.scss |
| **CR-16** | Nueva Operación - Seller. | Debería poder elegir la variante de un producto. | Pendiente datos — código frontend correcto; variantes aparecen cuando `product_variants` tiene atributos color/size/capacity en DB |
| **CR-17** | Operaciones - Seller. | Click en paginación debe mostrar los siguientes registros. | Corregido / Validado — agregado `[paginator]="true" [rows]="10"` en `operations.component.html` |
| **CR-18** | Operaciones - Admin. | Se hizo click en "Ver" en una operación pendiente de aprobación. | Debería mostrar la tasa de interés | Corregido / Validado — `!= null` para capturar `undefined`; tasa multiplicada ×100 para display como %; tipo SALE muestra "N/A (Venta)"; status EXPIRED agregado al tipo y mapas de label/severity |
| **CR-19** | Cancelación Anticipada - Admin. | Se hizo click en "Cancelación Anticipada" en una operación aprobada. | Debería poder adelantar cuotas. | Corregido / Validado — botón renombrado a "Cancelación total anticipada"; diálogo explica que es pago total de todas las cuotas y menciona la opción de pago anticipado por cuota individual |
| **CR-20** | Nueva Operación. | Se hizo click en "Nueva Operación". | Debería estar debajo la cantidad de cuotas al elegir el plan de pago. | Corregido / Validado — panel "Cantidad de cuotas" movido arriba de "Fecha de inicio de pago" para LOAN; `mt-6` para separación visual |


## 🟢 2. Módulo: Cliente

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **CL-01** | Crear Cliente | Se realizó la creación de un cliente. | Debería salir un mensaje que el cliente se guardó correctamente. | Corregido / Validado |
| **CL-02** | Ver Cliente | Click en "Ver" en un cliente. | Debería mostrar los datos del cliente. | Corregido / Validado |
| **CL-02b** | Ver Cliente - Seller. | Las letras deben ser legibles. | Corregido / Validado — card cambiado de `bg-white` a `ff-panel` (fondo oscuro del tema); labels con `var(--ff-text-muted)` |
| **CL-03** | Gestión de Clientes | Click en "Editar" en un cliente. | Los cambios deberían guardarse en la DB. | Corregido / Validado |
| **CL-04** | Editar Clientes | Click en "Editar" en un cliente. | Debería salir un cartel "Modificación Exitosa". | Corregido / Validado — toast implementado en `saveEdit()` y `onEditSubmit()` |
| **CL-05** | Ver Cliente - Admin. | Debería poder elegir el período en el historial. | Corregido / Validado — `appendTo="body"` + `baseZIndex` en calendarios y dropdown del historial |
| **CL-06** | Nuevo Cliente - Seller | Click en "Nuevo Cliente". | Debería conducir al formulario de nuevo cliente. | Comportamiento esperado — guard `tempPasswordGuard` redirige a cambio de contraseña en cuentas nuevas; página muestra banner de aviso; tras cambiar contraseña redirige al home |
| **CL-07** | Nuevo Cliente - Seller-Collector | Click en "Nuevo Cliente". | Debería conducir al formulario de nuevo cliente. | Comportamiento esperado — ídem CL-06 |
| **CL-08** | Clientes - Seller / Seller-Collector. | Click en paginación debe mostrar los siguientes registros. | Corregido / Validado — agregado `[paginator]="true" [rows]="10"` en `clients.component.html` |
| **CL-09** | Clientes - Admin. | El menú desplegable de riesgo no debe quedar cortado. | Corregido / Validado — `appendTo="body"` en dropdown de filtro de clientes |
| **CL-10** | Clientes - Admin. | Muestra la cantidad real de créditos del cliente. | Corregido / Validado — mapper `toClient()` ahora usa `c.activeCredits ?? 0` en lugar de `0` hardcodeado |
| **CL-11** | Nuevo Cliente - Admin | Se hizo click en "Nuevo Cliente". | No debería permitir poner números en el campo "Nombre" y "Apellido". | Corregido / Validado — `Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/)` en nombres y apellidos; error inline visible al tipear |
| **CL-12** | Nuevo Cliente - Admin | Se hizo click en "Nuevo Cliente". | En el campo "DNI" debería poder solo escribir números. | Corregido / Validado — `Validators.pattern(/^\d{7,8}$/)` + `inputmode="numeric"`; error inline con `isDniInvalid()` visible al tipear |
| **CL-13** | Nuevo Cliente - Admin | Click en "Nuevo Cliente". | Eliminar ingresos y permitir asignar un cobrador. | Corregido / Validado — campos Ingresos y Capacidad de Pago eliminados del modal; dropdown Cobrador Asignado agregado |
| **CL-14** | Clientes | Click en el filtro de búsqueda. | Debería poder filtrar los estados. | Corregido / Validado — `includeSummary: true` en llamada al listado; `toClient()` mapea `c.delinquency ?? 'Al dia'` en lugar de hardcodear "Al dia" |
| **CL-15** | Ver Clientes | Click en "Ver Clientes". | Debería poder mostrar los datos. | Corregido / Validado — `CreditsService` inyectado en `client-detail`; créditos cargados desde API por `customerId` después de cargar el cliente |
| **CL-16** | Editar Clientes | Click en "Editar" en un cliente. | Debería permitir editar todos los campos. | Corregido / Validado — modal editar expandido con Email, Dirección y Cobrador Asignado; pre-carga datos existentes del cliente; error visible si email inválido |
| **CL-17** | Nuevo Cliente | Click en "Nuevo Cliente" en Seller y Seller-Collector. | Corregido / Validado — inputs con `h-11 px-3`; labels con `auth-label`; orden de botones: Cancelar izquierda / Registrar derecha; dropdown Cobrador con `appendTo="body"` y deshabilitado cuando no hay cobradores activos |


## 🟢 3. Módulo: Producto

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **PR-01** | Crear Producto | Se realizó la creación de un producto. | Los campos deberían ser obligatorios. | Corregido / Validado |
| **PR-02** | Editar Producto | No existe el botón editar producto. | No está editar producto. | Corregido / Validado |
| **PR-03** | Categoría Producto | Los campos de categoría están vacíos. | No está la categoría de los productos. | Corregido / Validado |
| **PR-04** | Crear Producto | Se hizo click en "Crear Producto". | Los productos deberían mostrarse luego de confirmar la creación. | Corregido / Validado |
| **PR-05** | Crear Producto | Se hizo click en confirmar al "Crear Producto". | Debería salir un cartel que el producto fué creado exitosamente. | Corregido / Validado |
| **PR-06** | Crear Producto | Se hizo click en "Crear Producto". | Debería estar deshabilitado el botón "Guardar producto" hasta completar los campos obligatorios. | Corregido / Validado |
| **PR-07** | Desactivar Categoría - Admin | Se hizo click en "Desactivar Categoría". | Debería salir un cartel de confirmación y poder activarla de nuevo. | Corregido / Validado — `ConfirmDialog` antes de ejecutar; categorías inactivas muestran botón "Activar" |
| **PR-08** | Desactivar Marca - Admin | Se hizo click en "Desactivar Marca". | Debería salir un cartel de confirmación y poder activarla de nuevo. | Corregido / Validado — ídem PR-07 para marcas |
| **PR-09** | Editar Producto - Admin | Se hizo click en "Editar Producto". | El formulario debe ser distinguible del fondo. | Corregido / Validado — formulario envuelto en `ff-panel` con heading con color explícito |
| **PR-10** | Editar Producto | Se hizo click en "Guardar Cambios". | No se hizo ninguna modificación y me permitió "Guardar Cambios". | Corregido / Validado — `[disabled]="form.invalid \|\| !form.dirty \|\| submitting"` en botón Guardar Cambios |
| **PR-11** | Desactivar Producto | Se hizo click en "Desactivar Producto". | Debería permitir desactivar productos por mas que tengan unidades vendidas. | Corregido / Validado — backend acepta `force: true` en body; sin force bloquea RESERVED+SOLD; con force solo bloquea RESERVED (créditos pendientes); `hasReservedUnits` query agregada |
| **PR-12** | Variantes Productos | Se hizo click en "Editar Variantes". | Debería poder mostrar todos los campos en la tabla de la izquierda. | Corregido / Validado — tabla con columnas COLOR, TALLE, CAPACIDAD dinámicas (ocultas si ninguna variante las usa); panel de formulario a demanda (click "Nueva variante" o "Editar"); acciones de texto horizontal |
| **PR-13** | Múltiples Variantes Producto | Se hizo click en "Ingresar Múltiples Variantes". | Se ingresaron datos erróneos. | Corregido / Validado — feature implementada: ingreso individual con validación inline + toast en duplicado; ingreso múltiple con tabla de filas, skip de filas vacías, remapeo de errores por índice original, y summary de variantes/precio total; filas vacías entre filas cargadas se ignoran correctamente |
| **PR-14** | Categoría y Marca | Categoría y Marca solo permite creación y no edición. | Corregido / Validado — botón "Editar" por fila en tablas de Categorías y Marcas; diálogo de edición con nombre pre-cargado |
| **PR-15** | Nuevo Producto - Admin | Se hizo click en "Nuevo Producto". | El menú desplegable sale cortado en "Categoria" y "Marca". | Corregido / Validado — `appendTo="body"` en dropdowns Categoría y Estado del modal de creación (`products.component.html`) |


## 🟢 Módulo: Planilla

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **PL-01** | Generar Planilla | Se hizo click en "Generar Planilla". | Debería deshabilitar el botón mientras genera. | Corregido / Validado — flags `generating` / `generatingAll` deshabilitan los botones durante la ejecución |
| **PL-02** | Botones | Los botones no están correctamente ubicados. | Deberían seguir los patrones visuales. | Corregido / Validado |
| **PL-03** | Generar Planilla | Se hizo click en "Generar Planilla". | Debería deshabilitar "Generar Planilla para todos". | Corregido |
| **PL-04** | Mi Ruta - Collector | Se hizo click en "Ver Planilla". | Al seleccionar el ícono del calendario, el mismo ocupa toda la pantalla. | Corregido |


## 🟢 Módulo: Gastos

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **GA-01** | Gastos | Se hizo click en desactivar gasto "Alquiler". | Debería poder activarlo nuevamente. | Corregido / Validado |
| **GA-02** | Gastos | Se hizo click en "Registrar Gasto" - Admin. | Debería poder seleccionar el método de pago. | Corregido / Validado — `appendTo="body"` en dropdowns del formulario de gastos |
| **GA-03** | Gastos | Se hizo click en "Registrar Gasto" - Admin. | Debería poder seleccionar la fecha si no cerraron caja. | Corregido / Validado — campo "Fecha del gasto" agregado al panel de registro con `min`/`max` = hoy; impide fechas pasadas y futuras; `todayIsoPublic` getter expuesto desde el TS |


## 🟢 Módulo: Usuarios

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **US-01** | Rol Usuario | Se hizo click en "Nuevo Usuario". | Debería poder elegir el Rol. | Corregido / Validado — `appendTo="body"` en dropdown de Rol en modal de creación |
| **US-02** | Usuarios - Admin | Se hizo click en "Usuarios". | No funciona el filtro para seleccionar por Rol, sale cortado. | Corregido / Validado — `appendTo="body"` en dropdowns de Rol y Estado en listado |
| **US-03** | Nuevo Usuario y Editar Usuario - Admin | Se hizo click en "Nuevo Usuario". | No debería permitir ingresar símbolos en "Nombre Completo" y un sólo número en DNI. | Corregido / Validado — pattern validators en fullName (solo letras) y DNI (7-8 dígitos); errores inline visibles; `inputmode="numeric"` en DNI |
| **US-04** | Editar Usuario - Admin | Se hizo click en "Editar Usuario". | El menú desplegable de "Rol" debería mostrarse completo. | Corregido / Validado — `appendTo="body"` en dropdown Rol del formulario de edición |
| **US-05** | Editar Usuario - Admin | Se hizo click en "Editar Usuario". | El botón de "Guardar Cambios" siempre activo. | Corregido / Validado — `formHasChanges` getter compara snapshot original vs valores actuales; botón se deshabilita si se revierte al estado inicial |
| **US-06** | Crear Usuario - Admin | Se hizo click en "Crear Usuario". | Debería verse el password temporal. | Corregido / Validado — dialog de contraseña usa CSS variables del tema (`var(--ff-secondary)`, `var(--ff-text-primary)`, `var(--ff-border)`) para visibilidad en modo oscuro |


## 🟢 Módulo: Caja

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **CA-01** | Cierre de caja | Se hizo click en "Cierre de caja". | Debería poder realizar el cierre de caja. | Corregido / Validado — bug backend: `totalEgresos` vs `totalOutflows` naming mismatch causaba error 500; controller ahora también maneja 422 correctamente |
| **CA-02** | Cierre de caja | Se hizo click en "Cierre de caja" al pasar las 00:00. | Debería permitirme cerrar la caja del día anterior pasadas las 00:00. | Error |
| **CA-03** | Cierre de caja | Se hizo click en "Estado". | Debería poder ver todas las opciones. | Corregido / Validado — `appendTo="body"` en dropdown de Estado en historial de cierres (`cash-register.component.html`) |


## 🟢 Módulo: Cobro

| ID | Caso de Uso / Prueba | Acción Realizada | Resultado Esperado (Éxito) | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **CO-01** | Reversión de cuota | Se hizo click en "Revertir Cuota". | Debería volver al estado pendiente en la planilla de "Cobros". | Corregido / Validado — cobro original muestra tag "Aprobado" + "Revertido" (warning); payment de reversión muestra "Aprobado" + "Reversión" (danger); toast confirma la operación; `reversalPaymentId` mapeado en model + service; `reloadDetail()` agregado en planilla de cobros |
| **CO-02** | Cobro directo - Admin | Se hizo click en "Cobro directo" y se completaron los campos. | Debería registrar y aprobar el cobro en el mismo paso (`admin_direct: true`, `status: APPROVED`). | Corregido / Validado — `processDirectPayment()` llamaba a `create` (PENDING) en vez de `adminDirect` (APPROVED); corregido en `admin-payments.component.ts` |
| **CO-03** | Cobro directo parcial - Admin | Se intentó registrar un cobro con monto menor al de la cuota. | El form debería pedir "Fecha de próxima visita" para cobros parciales. | Corregido / Validado — campo `p-calendar` agregado al dialog con `[minDate]="todayDate"`; `nextVisitDate` agregado a `AdminDirectPayload`, mapeado en service y enviado al backend |


---

## ✅ Correcciones validadas en esta sesión (Grupos A-E + Backend)

### Grupo A — Dropdowns cortados (`appendTo="body"`)
- **US-01, US-02**: Dropdowns de Rol y Estado en módulo Usuarios
- **CL-09**: Filtro de riesgo en listado de Clientes
- **CR-14**: Filtro de Estado en listado de Operaciones
- **GA-02**: Dropdowns en formulario de Gastos

### Grupo B — Calendarios cortados (`appendTo="body"` + `autoZIndex`)
- **CR-10**: Removido `iconDisplay="input"` + agregado `autoZIndex="true"` en calendario de primer pago
- **CL-05**: Calendarios de período e Historial en detalle de cliente

### Grupo C — Contraste y color
- **CR-15**: Tilde de checkboxes blanca en tema oscuro (`styles.scss`)
- **CL-02b**: Card de detalle de cliente Seller cambiado de `bg-white` a `ff-panel`
- **CR-13**: Headings en paso Confirmación con `text-white` explícito
- **PR-09**: Formulario de edición de producto con wrapper `ff-panel`

### Grupo D — Paginación
- **CR-17**: `[paginator]="true" [rows]="10"` en tabla de Operaciones
- **CL-08**: `[paginator]="true" [rows]="10"` en tabla de Clientes

### Grupo E — Bugs lógicos
- **CL-10**: Mapper `toClient()` usa `c.activeCredits ?? 0` en lugar de `0` hardcodeado
- **PR-07 / PR-08**: `ConfirmDialog` antes de desactivar Categoría o Marca
- **CR-09**: Mensaje claro "Unidad no disponible" + recarga automática del catálogo
- **CR-08b**: Error handler en `initialize()` del wizard de nueva operación

### Backend
- **CA-01**: `totalEgresos` naming bug en `cashRegister.service.js`; `cashRegister.controller.js` maneja 422 y 400

---

---

## ✅ Correcciones validadas en esta sesión (Batch 2 — QA Regression)

### Módulo Crédito
- **CR-18**: Tasa de interés — `!= null` captura `undefined`; decimal ×100 para %; SALE muestra "N/A (Venta)"; EXPIRED agregado al tipo y mapas
- **CR-19**: Cancelación anticipada — renombrado a "Cancelación total anticipada"; diálogo explica diferencia entre cancelación total y pago anticipado por cuota

### Módulo Cliente
- **CL-11**: Nombres/Apellidos — `Validators.pattern` solo letras; error inline visible al tipear
- **CL-12**: DNI — `Validators.pattern(/^\d{7,8}$/)` + `inputmode="numeric"`; error con `isDniInvalid()` al tipear
- **CL-13**: Modal crear — eliminados Ingresos y Capacidad de Pago; agregado Cobrador Asignado
- **CL-14**: Filtro de riesgo — `includeSummary: true` en listado; `c.delinquency` mapeado desde backend
- **CL-15**: Ver Cliente — créditos cargados desde API (`CreditsService`) por `customerId`
- **CL-16**: Editar Cliente — modal expandido con Email, Dirección, Cobrador; pre-carga datos; validación email

### Módulo Producto
- **PR-10**: Editar Producto — `!form.dirty` en botón Guardar Cambios
- **PR-12**: Variantes — columnas COLOR/TALLE/CAPACIDAD dinámicas; panel formulario a demanda; acciones de texto horizontal
- **PR-14**: Categorías y Marcas — botón Editar por fila; diálogo con nombre pre-cargado

### Módulo Usuario
- **US-03**: Crear/Editar Usuario — pattern validators fullName y DNI; errores inline
- **US-04**: Dropdown Rol — `appendTo="body"` en formulario de edición
- **US-05**: Guardar Cambios — `formHasChanges` por comparación de snapshot; se deshabilita al revertir
- **US-06**: Contraseña temporal — CSS variables del tema para visibilidad en modo oscuro

### Evidencia automatizada (nuevos tests)
- `cypress/e2e/44-qa-regression-batch2.cy.ts` → 21 tests: CL-11/12/13/16, US-03/04/05, PR-10/12/14, CR-18/19
- `src/app/features/admin/users/user-create/user-create.component.spec.ts` → validators US-03
- `src/app/features/seller/products/product-edit/product-edit.component.spec.ts` → PR-10 dirty check
- `src/app/shared/clients/clients.component.spec.ts` → CL-11/12/13/14 validators y riesgo

---

## ✅ Correcciones validadas — Sesión 4 (Grupo 1 Frontend)

### Módulo Crédito
- **CR-20**: Nueva Operación LOAN — panel "Cantidad de cuotas" movido por encima de "Fecha de inicio de pago" en `step-conditions.component.html`; `mt-6` agrega separación visual; ya no requiere scroll para ver las cuotas

### Módulo Cliente
- **CL-17**: Nuevo Cliente Seller/Seller-Collector — inputs con `h-11 px-3`; labels con `auth-label`; orden de botones corregido (Cancelar izquierda, Registrar derecha); dropdown Cobrador con `appendTo="body"` y deshabilitado cuando `collectorOptions.length === 0`

### Módulo Producto
- **PR-15**: Dropdowns Categoría y Estado en modal "Nuevo Producto" — `appendTo="body"` en ambos (`shared/products/products.component.html`)

### Módulo Gastos
- **GA-03**: Formulario "Registrar Gasto" — nuevo campo "Fecha del gasto" con `min`/`max` = hoy; impide registrar con fechas pasadas o futuras; `todayIsoPublic` getter en `expenses.component.ts`

### Módulo Caja
- **CA-03**: Dropdown "Estado" en historial de cierres — `appendTo="body"` en `cash-register.component.html`

---

---

## ✅ Correcciones validadas — Sesión 5

### Módulo Cobro
- **CO-01**: Reversión de cuota — `reversalPaymentId` agregado a `Payment` model y mapper; `paymentTypeLabel` muestra tag único "Revertido" (warning) para cobros revertidos; `reloadDetail()` agregado en planilla de cobros
- **CO-02**: Cobro directo — `processDirectPayment()` corregido para llamar a `adminDirect()` en lugar de `create()`; cobro queda APPROVED con `admin_direct: true`
- **CO-03**: Cobro directo parcial — campo `p-calendar` "Próxima visita" agregado al dialog; `nextVisitDate` agregado a `AdminDirectPayload` y mapeado en service

### Módulo Producto
- **PR-11**: Desactivar producto con unidades vendidas — backend acepta `force: true`; `hasReservedUnits` query agregada; sin force bloquea RESERVED+SOLD; con force solo bloquea RESERVED
- **PR-13**: Múltiples variantes — feature implementada desde cero: ingreso individual con toast en duplicado; ingreso múltiple con skip de filas vacías, remapeo de errores por índice original, y summary de variantes cargadas

### Módulo Cobros — UX
- Tags unificados: cobro revertido → "Revertido" (ámbar); cobro de reversión → "Reversión" (rojo); cobro directo → "Pago directo" (azul); todos tag único sin stacking

---

## 🔴 Pendiente — diferido

| ID | Bug | Fix requerido |
| :--- | :--- | :--- |
| **CA-02** | Cierre de caja pasadas 00:00 | A definir approach — diferido |
| **CA-02** | Cierre de caja pasadas las 00:00 | Backend debe aceptar `date=yesterday` cuando no hay caja abierta para hoy |
| **CO-01** | Reversión de cuota queda en "Aprobada" | Backend debe actualizar installment a `PENDING` al revertir |

---

## 🔵 Pendientes por datos (no son bugs de código)

| ID | Descripción | Acción requerida |
| :--- | :--- | :--- |
| **CR-11** | Solo aparece frecuencia mensual y tasa 15% fija | Configurar tasas BIWEEKLY/WEEKLY desde Admin → Config → Tasas de interés y Tasas de productos |
| **CR-16** | Solo aparece "Variante estándar" en productos | Cargar atributos color/size/capacity en variantes desde Admin → Productos → Variantes |

---

## 🧪 Evidencia de regresión automatizada

### Tests existentes (previos a esta sesión)
- `cypress/e2e/31-qa-regression-issues.cy.ts` → flujo SALE integrado: **passing**
- `src/app/shared/operations/new-operation/new-operation.component.spec.ts` → CR-02, CR-05, CR-06: **12 passing**
- `src/app/shared/operations/new-operation/steps/step-products/step-products.component.spec.ts` → CR-03, CR-04: **8 passing**
- `src/app/shared/operations/new-operation/steps/step-conditions/step-conditions.component.spec.ts` → CR-10: **5 passing**
- `src/app/shared/clients/clients.component.spec.ts` → CL-01, CL-10, CL-08, paginación: **16 passing**
- `src/app/shared/operations/operations.component.spec.ts` → CR-07, CR-08, CR-17: **6 passing**
- `src/app/features/seller/products/product-edit/product-edit.component.spec.ts` → PR-09: **6 passing**
- `src/app/features/admin/sheet/sheet.component.spec.ts` → PL-01: **6 passing**
- `src/app/shared/operations/new-operation/operation-form.service.spec.ts` → CR-09: **2 passing**

### Tests nuevos (esta sesión)
- `cypress/e2e/38-dropdown-overflow-regression.cy.ts` → US-01, US-02, CL-09, CR-14 (Grupo A)
- `cypress/e2e/39-calendar-overflow-regression.cy.ts` → CR-10, CL-05 (Grupo B)
- `cypress/e2e/40-contrast-color-regression.cy.ts` → CL-02b, CR-13, PR-09 (Grupo C)
- `cypress/e2e/41-pagination-regression.cy.ts` → CR-17, CL-08 (Grupo D)
- `cypress/e2e/42-group-e-regression.cy.ts` → CL-10, PR-07, PR-08, CR-09 (Grupo E)
