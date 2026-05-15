# Plantilla de Reporte de Bug / Nueva Funcionalidad

**Módulo:** [Agenda / Caja / Productos / Reportes / Global]
**ID de Prueba:** [Ej: AG-11, CA-06]
**Título / Descripción:** [Descripción breve de lo que se va a probar o el error encontrado]

### 1. Contexto de la Prueba
* **Acción Realizada:** [Ej: Hice clic en "Registrar Pago" agregando 10 personas...]
* **Resultado Esperado:** [Ej: Debería sumar $4200 y guardarse en la BD.]
* **Resultado Obtenido (Error):** [Ej: Tira Error 500 y se ve la pantalla desalineada.]

### 2. Evidencia Técnica
**Payload Enviado (Request):**
```json
{
  "ejemplo": "pegar payload aca"
}
```

---


Modulo Crédito

**Módulo:** [Crédito]
**ID de Prueba:** [CR-01]
**Título / Descripción:** [Nueva operación crédito.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Enviar para Aprobación"]
* **Resultado Esperado:** [Debería enviar la operación para ser aprobada.]
* **Resultado Obtenido (Actual):** [Corregido. La operación SALE envía `unit_ids` y acepta `down_payment`; el alta ya no usa `prepaid_installments`. Validado con Cypress en `31-qa-regression-issues.cy.ts`.]
### 2. Evidencia Técnica
**Payload Enviado (Request):**
http://localhost:3000/api/credits - POST
```json 
{
    "customer_id": "7f7f3a3b-df67-4948-bb3a-db8140c4d5a2",
    "installments_count": 6,
    "payment_frequency": "MONTHLY",
    "type": "SALE",
    "unit_ids": ["unit-1"],
    "down_payment": 200,
    "down_payment_method": "CASH"
}
```

**Respuesta esperada actual:**
```json
{
    "ok": true,
    "message": "Pre-operación registrada. Pendiente de aprobación."
}
```

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-02]
**Título / Descripción:** [Nueva operación crédito.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [En fecha de primer pago me deja poder fechas anteriores a la actual.]
* **Resultado Esperado:** [Debería estar deshabilitadas las fechas anteriores a la actual.]
* **Resultado Obtenido (Error):** [Permite continuar la operación aunque la fecha sea incorrecta.]

**Línea de ataque sugerida:**
- Restringir selección manual y por calendario a fechas >= hoy.
- Validar nuevamente en frontend antes de habilitar el avance.

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-03]
**Título / Descripción:** [Nueva operación crédito.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Tipo de operación" y elegi "Préstamo personal".]
* **Resultado Esperado:** [Debería desaparecer los productos.]
* **Resultado Obtenido (Error):** [Los productos continúan visibles.]
* **Resultado Obtenido (Actual):** [Corregido. Al elegir "Préstamo personal" se ocultan buscador/listados/selección de productos y además se limpia el estado (`searchProduct`, `selectedProducts`) para evitar datos residuales. Validado con `step-products.component.spec.ts` y `new-operation.component.spec.ts` (caso LOAN sin productos).]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-04]
**Título / Descripción:** [Nueva operación crédito.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Escribí "aire" en "Buscar Producto".]
* **Resultado Esperado:** [Debería filtrar los productos por el nombre.]
* **Resultado Obtenido (Actual):** [Corregido. El listado del paso "Tipo y Producto" ahora se filtra por nombre usando el texto de `searchProduct`. Validado con `step-products.component.spec.ts` (caso CR-04).]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-05]
**Título / Descripción:** [Configuración del crédito.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Siguiente" sin elegir "Fecha del primer pago".]
* **Resultado Esperado:** [Debería estar deshabilitado el botón "Siguiente" hasta elegir la "Fecha del primer pago".]
* **Resultado Obtenido (Actual):** [Corregido. En paso Condiciones, `canNext` bloquea avanzar cuando `firstDueDate` está vacío o es inválido. Validado con `new-operation.component.spec.ts` (caso CR-05) y `cypress/e2e/07-negative-nueva-operacion.cy.ts`.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-06]
**Título / Descripción:** [Operación Crédito - Declaraciones y Autorizaciones.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Dejé sin marcar la casilla "Autorizo el desembolso inmediato al finalizar la aprobación del crédito".]
* **Resultado Esperado:** [Debería estar deshabilitado el botón "Siguiente" hasta marcar la casilla.]
* **Resultado Obtenido (Actual):** [Corregido. El botón final de envío queda deshabilitado hasta marcar también `disbursement` junto con las demás declaraciones obligatorias. Validado con `new-operation.component.spec.ts` y `cypress/e2e/07-negative-nueva-operacion.cy.ts` (caso CR-06).]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-07]
**Título / Descripción:** [Operaciones.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Activo" para filtrar las operaciones.]
* **Resultado Esperado:** [Debería filtrar las operaciones.]
* **Resultado Obtenido (Actual):** [Corregido. El listado ahora aplica filtro real por estado y "Activo" devuelve únicamente operaciones activas. Validado con `operations.component.spec.ts` (caso CR-07) y Cypress `14-seller-operaciones.cy.ts`.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-08]
**Título / Descripción:** [Operaciones.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Escribí "Perez" en el buscador.]
* **Resultado Esperado:** [Debería filtrar los clientes.]
* **Resultado Obtenido (Actual):** [Corregido. El buscador ahora filtra por cliente ignorando mayúsculas/minúsculas y tildes (ej. "Perez" encuentra "Pérez"). Validado con `operations.component.spec.ts` (caso CR-08) y Cypress `14-seller-operaciones.cy.ts`.]

* **Acción Realizada:** [Escribí "Perez" en el buscador en "Nueva Operación" - Admin.]
* **Resultado Esperado:** [Debería filtrar los clientes.]
* **Resultado Obtenido (Error):** [No filtra los resultados.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-09]
**Título / Descripción:** [Regresión en selección de unidad para operación SALE.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Enviar para Aprobación" luego de elegir un producto que informa unidades disponibles.]
* **Resultado Esperado:** [Si el producto muestra stock disponible, la operación debería enviarse correctamente para aprobación.]
* **Resultado Obtenido (Error):** [Cuando elijo un producto que dice que posee 5 unidades, la API responde que la unidad seleccionada no fue encontrada. **Pendiente de atacar**.]
### 2. Evidencia Técnica
**Payload Enviado (Request):**
```json
{
    "customer_id": "9da1f6c7-8297-44c9-858e-a5d3918deccf",
    "installments_count": 6,
    "payment_frequency": "MONTHLY",
    "type": "SALE",
    "unit_ids": ["c8e8ef31-eec0-4e8f-a09c-d921a368d84d"]
}
```

**Respuesta obtenida:**
```json
{
    "ok": false,
    "message": "Unidad c8e8ef31-eec0-4e8f-a09c-d921a368d84d no encontrada."
}
```

**Línea de ataque sugerida:**
- Verificar consistencia entre stock mostrado en UI y `unit_ids` reales devueltos por backend.
- Revisar si el selector está enviando una unidad reservada/inactiva o un id stale.
- Cubrir regresión con Cypress al confirmar stock visible vs unidad seleccionable.

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-10]
**Título / Descripción:** [Calendario de primer pago no selecciona fecha con mouse.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click para elegir la fecha del primer pago con el mouse desde el calendario.]
* **Resultado Esperado:** [Debería poder elegir la fecha con click y reflejarla en el formulario.]
* **Resultado Obtenido (Error):** [Al hacer click con el mouse sobre una fecha del calendario no hace nada; escribiendo la fecha manualmente sí permite seguir. **Pendiente de atacar**.]

**Línea de ataque sugerida:**
- Revisar binding del componente calendario y evento de selección (`onSelect` / `ngModel` / `formControl`).
- Validar si hay overlay, z-index o elemento invisible bloqueando clicks.
- Agregar prueba E2E específica para selección con mouse.

* **Acción Realizada:** [Hice click para elegir la fecha del primer pago con el mouse desde el calendario - Admin.]
* **Resultado Esperado:** [Debería poder elegir una fecha del calendario.]
* **Resultado Obtenido (Error):** [Al hacer click sobre el calendario sale cortado sin poder elegir las fechas que se encuentren por debajo.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-11]
**Título / Descripción:** [Operacion venta de un producto - Admin.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se eligio un producto de la lista y la cantidad de cuotas.]
* **Resultado Esperado:** [Debería cambiar el interés según el producto, la cantidad de cuotas y la frecuencia de pago.]
* **Resultado Obtenido (Error):** [No está implementado el pago diario y quincenal, solo aparece el mensual, el interés figura siempre de 15% cuando debería cambiar según el plan que se elija.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-12]
**Título / Descripción:** [Operaciones aprobadas y pre-aprobadas - Admin.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se realizó una operación para su aprobación y se aprobó una operación.]
* **Resultado Esperado:** [Debería poder realizar una consulta de la misma donde nos indique si es venta o crédito, la cantidad de cuotas, que producto se vendió, etc.]
* **Resultado Obtenido (Error):** [No está implementado el detalle de las operaciones, no hay un lugar donde estén visible los datos.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-13]
**Título / Descripción:** [Nueva Operacion - Seller.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nueva Operación".]
* **Resultado Esperado:** [Debería salir un modal para cargar los datos.]
* **Resultado Obtenido (Error):** [Las letras son del mismo color que el fondo lo que hace ilegible la lectura.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-14]
**Título / Descripción:** [Operaciones - Admin.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Operaciones".]
* **Resultado Esperado:** [Se hizo click en el filtro, deberían poder verse los estados.]
* **Resultado Obtenido (Error):** [Al elegir un estado por ej. "Pendientes de Aprobacion" si apreto de nuevo para que se despliegue el filtro salen cortados los mismos.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-15]
**Título / Descripción:** [Operación Crédito - Declaraciones y Autorizaciones.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nuevo Crédito".]
* **Resultado Esperado:** [Debería poder verse las tildes en los casilleros.]
* **Resultado Obtenido (Error):** [La tilde en los casilleros debería ser de otro color diferente que negro ya que no queda visible.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-16]
**Título / Descripción:** [Nueva Operacion - Seller.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nuevo Operación".]
* **Resultado Esperado:** [Debería poder vender cualquier variante de un producto.]
* **Resultado Obtenido (Error):** [No es posible poder elegir la variante de un producto.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-17]
**Título / Descripción:** [Operaciones - Seller.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en 10 en la paginación.]
* **Resultado Esperado:** [Deberían verse las siguientes 10 operaciones.]
* **Resultado Obtenido (Error):** [Al apretar el botón no muestra las 10 siguientes operaciones.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-18]
**Título / Descripción:** [Operaciones - Admin.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Ver" en una operación pendiente de aprobación.]
* **Resultado Esperado:** [Deberían mostrarse la tasa de interés.]
* **Resultado Obtenido (Actual):** [Corregido. Se usa `!= null` (loose equality) para capturar tanto `null` como `undefined`; la tasa se multiplica ×100 para mostrar como porcentaje (el backend envía decimales, ej. `0.15` → `15.00%`); ventas tipo SALE muestran "N/A (Venta)"; tipo `EXPIRED` agregado al union type y a los mapas `statusLabel`/`statusSeverity` en `credits-list`, `credit-detail` y `client-detail`.]

---

**Módulo:** [Crédito]
**ID de Prueba:** [CR-19]
**Título / Descripción:** [Cancelación Anticipada - Admin.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Cancelación Anticipada" en una operación aprobada.]
* **Resultado Esperado:** [Deberían poder pagar cuotas adelantadas.]
* **Resultado Obtenido (Actual):** [Corregido. El botón se renombró a "Cancelación total anticipada" para distinguirlo del pago por cuota individual. El diálogo de confirmación ahora explica que esta acción cancela el saldo total restante del crédito de una sola vez, y menciona que el pago anticipado por cuota individual está disponible en la tabla de cuotas. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (CR-19).]

---

Módulo Clientes

**Módulo:** [Clientes]
**ID de Prueba:** [CL-01]
**Título / Descripción:** [Crear Cliente]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se realizó la creación de un nuevo cliente.]
* **Resultado Esperado:** [Debería salir un mensaje que el cliente se guardo exitosamente.]
* **Resultado Obtenido (Actual):** [Corregido. El alta muestra toast visible de éxito, bloquea doble envío durante la creación y también informa errores relevantes como conflicto por DNI duplicado. Validado con `clients.component.spec.ts`.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-02]
**Título / Descripción:** [Ver Cliente]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click sobre el boton "Ver" en un cliente.]
* **Resultado Esperado:** [Debe mostrar los datos del Cliente.]
* **Resultado Obtenido (Actual):** [Corregido. El detalle ahora carga el cliente real por `id`; solo muestra “Cliente no encontrado.” cuando el backend responde 404. Validado con Cypress en `32-client-detail-regression.cy.ts`.]

* **Acción Realizada:** [Se hizo click sobre el boton "Ver" en un cliente - Seller.]
* **Resultado Esperado:** [Debe mostrar los datos del Cliente.]
* **Resultado Obtenido (Error):** [No se distingue ya que el color de las letras es el mismo color que el fondo.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-03]
**Título / Descripción:** [Gestion de Clientes]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click sobre el boton "Editar" en un cliente.]
* **Resultado Esperado:** [Al modificar los datos deben guardarse en la DB.]
* **Resultado Obtenido (Actual):** [Corregido. Los cambios persistidos actualmente (`full_name`, `phone`) se guardan y se mantienen tras refrescar. Los campos no soportados por el contrato real fueron retirados del modal para evitar UX engañosa. Validado con Cypress en `04-clientes.cy.ts`.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-04]
**Título / Descripción:** [Editar Clientes]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click sobre el boton "Editar" en un cliente.]
* **Resultado Esperado:** [Al modificar los datos deben debería salir un cartel "Modificación Exitosa".]
* **Resultado Obtenido (Actual):** [El apretar "Guardar Cambios" no sale ningun cartel.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-05]
**Título / Descripción:** [Ver Cliente - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click sobre el boton "Ver" y seleccionar "Historial" en un cliente.]
* **Resultado Esperado:** [Debería poder elegir el período.]
* **Resultado Obtenido (Error):** [Los calendarios salen cortados, no se muetran todos los datos.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-06]
**Título / Descripción:** [Nuevo Cliente - Seller]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click sobre el boton "Nuevo Cliente".]
* **Resultado Esperado:** [Debería salir un modal para poder resigtrar un nuevo cliente.]
* **Resultado Obtenido (Error):** [Me lleva a una pantalla para cambiar la contraseña.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-08]
**Título / Descripción:** [Clientes - Seller / Seller-Collector]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en 10 en la paginación de clientes.]
* **Resultado Esperado:** [Debería poder mostrar los 10 siguientes clientes.]
* **Resultado Obtenido (Error):** [No funciona el botón de paginación, no muestra los 10 siguientes clientes.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-09]
**Título / Descripción:** [Clientes - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en el filtro de riesgo.]
* **Resultado Esperado:** [Debería poder cambiar los riesgos.]
* **Resultado Obtenido (Error):** [Al elegir un riesgo y querer cambiar a otro sale cortado el menú desplegable.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-10]
**Título / Descripción:** [Clientes - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Clientes".]
* **Resultado Esperado:** [Debería poder ver la cantidad de créditos que posee al cliente.]
* **Resultado Obtenido (Error):** [Muestra en 0 (cero) por mas que el cliente tenga créditos.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-11]
**Título / Descripción:** [Nuevo Cliente - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Me permite poner números en el campo Nombre y Apellidos.]
* **Resultado Esperado:** [No debería permitir poner números en Nombre y Apellido.]
* **Resultado Obtenido (Actual):** [Corregido. `Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/)` en los campos `nombres` y `apellidos`. El error "Solo se permiten letras y espacios." aparece inline debajo del campo al tipear. El botón "Crear Cliente" permanece deshabilitado mientras los campos tengan errores. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (CL-11).]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-12]
**Título / Descripción:** [Nuevo Cliente - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [En el campo DNI debería poder solo escribir números.]
* **Resultado Esperado:** [No debería permitir poner letras.]
* **Resultado Obtenido (Actual):** [Corregido. `Validators.pattern(/^\d{7,8}$/)` valida que el DNI tenga exactamente 7 u 8 dígitos numéricos. Se agregó `inputmode="numeric"` para mostrar teclado numérico en mobile. El método `isDniInvalid()` usa `dirty || touched || submitted` para mostrar el error inmediatamente al tipear, sin esperar blur. El error "El DNI debe contener entre 7 y 8 dígitos." aparece inline. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (CL-12).]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-13]
**Título / Descripción:** [Nuevo Cliente - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nuevo Cliente".]
* **Resultado Obtenido (Actual):** [Corregido. Los campos "Ingresos Mensuales" y "Capacidad de Pago" fueron eliminados del modal de creación, ya que el backend no los soporta en este flujo. Se agregó un dropdown "Cobrador Asignado" que carga la lista de cobradores activos desde `UsersService.listCollectors()`. El `assignedCollectorId` se envía en el payload de creación. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (CL-13).]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-14]
**Título / Descripción:** [Clientes]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en el filtro de búsqueda de "Clientes".]
* **Resultado Esperado:** [Debería poder filtrar los estados del cliente.]
* **Resultado Obtenido (Actual):** [Corregido. La llamada al listado ahora incluye `includeSummary: true` para que el backend devuelva el campo `delinquency` por cliente. El mapper `toClient()` usa `c.delinquency ?? 'Al dia'` en lugar de hardcodear "Al dia" para todos. El filtro de riesgo en el frontend compara contra el valor real del backend (`"con mora"`, `"sin mora"`, etc.).]

---


**Módulo:** [Clientes]
**ID de Prueba:** [CL-15]
**Título / Descripción:** [Ver Clientes]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Ver Clientes".]
* **Resultado Esperado:** [Debería poder mostrar los datos.]
* **Resultado Obtenido (Actual):** [Corregido. `CreditsService` fue inyectado en `ClientDetailComponent`. Después de cargar los datos del cliente, se llama a `creditsService.list({ customerId })` y los resultados se mapean al modelo de UI mediante `toUiCredit()`. Los créditos se muestran en la sección correspondiente del detalle. Causa raíz: `toClientDetail()` hardcodeaba `credits: []`.]

---

**Módulo:** [Clientes]
**ID de Prueba:** [CL-16]
**Título / Descripción:** [Editar Clientes]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Editar Clientes".]
* **Resultado Esperado:** [Debería poder editar todos los campos menos el ID del Cliente.]
* **Resultado Obtenido (Actual):** [Corregido. El modal de edición fue expandido con los campos Email, Dirección y Cobrador Asignado. Se agregó `isEditInvalid()`/`getEditError()` para mostrar error si el email tiene formato inválido. El `buildEditForm()` pre-carga los datos del cliente (incluyendo email, address y collectorId) usando los nuevos campos `email?`, `address?`, `collectorId?` añadidos a la interfaz `Client`. El payload de actualización incluye todos los campos editables. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (CL-16).]

---


Módulo Producto

**Módulo:** [Producto]
**ID de Prueba:** [PR-01]
**Título / Descripción:** [Crear Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se realizó la creación de un nuevo producto.]
* **Resultado Esperado:** [Los campos deberían ser obligatorios.]
* **Resultado Obtenido (Actual):** [Validado. El formulario `seller/products/new` mantiene deshabilitado el botón "Registrar producto" mientras el formulario sea inválido. El falso negativo original venía de un spec Cypress desactualizado que buscaba el label viejo "Guardar". Validado con `30-producto-crear.cy.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-02]
**Título / Descripción:** [Editar Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Quisiera editar el producto para agregar mas unidades por ejemplo.]
* **Resultado Esperado:** [No se encuentra el botón para editar el producto.]
* **Resultado Obtenido (Actual):** [Corregido. El listado compartido de `/admin/products` ahora muestra el botón "Editar" por fila y permite navegar al formulario `seller/products/:id/edit`. Validado con `36-product-edit-category-regression.cy.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-07]
**Título / Descripción:** [Formulario de edición de producto incompleto y desalineado.]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Hice click en "Editar Producto" para agregar más unidades o ajustar datos.]
* **Resultado Esperado:** [Debería existir el campo stock y los botones de acción deberían mantener la misma alineación/estilo del resto del sistema.]
* **Resultado Obtenido (Actual):** [Corregido. La edición ahora muestra `Stock disponible` como dato de solo lectura alineado al modelo real del dominio (el stock deriva de `product_units`, no de un campo editable directo) y los botones siguen el patrón visual del proyecto: `Cancelar` a la izquierda outlined y `Guardar Cambios` como acción principal. Validado con `product-edit.component.spec.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-03]
**Título / Descripción:** [Categoría Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Quiero ver la categoría del producto.]
* **Resultado Esperado:** [Los productos no poseen la categoría.]
* **Resultado Obtenido (Actual):** [Corregido. La columna categoría ya muestra el valor real (`categoryName`) devuelto por backend en el listado compartido de productos. Validado con `36-product-edit-category-regression.cy.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-04]
**Título / Descripción:** [Crear Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se realizó la operación de "Crear Producto".]
* **Resultado Esperado:** [Los productos deberían mostrarse luego de confirmar la creación.]
* **Resultado Obtenido (Actual):** [Corregido. El modal compartido ahora crea el producto base, su variante con precio y las unidades iniciales según el stock cargado, por lo que el listado ya muestra precio y stock después de confirmar. Validado con `34-product-list-regression.cy.ts`.]

### 2. Evidencia Técnica
**Payload Enviado (Request):**
http://localhost:3000/api/products - POST
```json 
{
    "data": {
        "id": "de490051-aaa2-4cad-80ae-d1292011e93f",
        "title": "PRD0002 Samsung Galaxy A54",
        "description": "Galaxy A54 5G 256 GB Awesome graphite 8 GB RAM",
        "model": null,
        "brand_id": null,
        "category_id": null,
        "status": "ACTIVE",
        "created_at": "2026-05-03T01:52:36.084Z",
        "available_count": 0,
        "reserved_count": 0,
        "sold_count": 0,
        "variants": []
    }
}
```

**Respuesta esperada actual:**
```json
{
    "ok": true,
    "message": "Producto registrado correctamente.",
    "data": {
        "id": "de490051-aaa2-4cad-80ae-d1292011e93f",
        "title": "PRD0002 Samsung Galaxy A54",
        "description": "Galaxy A54 5G 256 GB Awesome graphite 8 GB RAM",
        "model": null,
        "brand_id": null,
        "category_id": null,
        "status": "ACTIVE",
        "created_at": "2026-05-03T01:52:36.084Z",
        "available_count": 0,
        "reserved_count": 0,
        "sold_count": 0,
        "variants": []
    }
}
```

**Comportamiento integrado posterior esperado:**
- Alta de `product_variant` con `current_price`
- Alta de `product_units` según `stockInicial`
- Refresh del listado con precio y stock visibles

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-05]
**Título / Descripción:** [Crear Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en confirmar la operación de "Crear Producto".]
* **Resultado Esperado:** [Debería salir un cartel que el producto fué creado exitosamente.]
* **Resultado Obtenido (Actual):** [Corregido. El modal compartido de `/admin/products` ahora muestra un toast con el mensaje "Producto registrado correctamente." después de completar el alta integrada. Validado con `35-product-success-toast-regression.cy.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-06]
**Título / Descripción:** [Crear Producto]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Crear Producto".]
* **Resultado Esperado:** [Debería estar deshabilitado el botón de "Guardar Producto" hasta llenar los campos.]
* **Resultado Obtenido (Actual):** [Corregido. El modal mantiene deshabilitado "Guardar Producto" mientras falten campos obligatorios o el formulario siga inválido. Validado con Cypress en `33-product-create-modal-regression.cy.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-07]
**Título / Descripción:** [Desactivar Categoría - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Desactivar Categoría".]
* **Resultado Esperado:** [Debería salir un cartel indicando si realmene desea desactivarla y una opción para poder activarla nuevamente.]
* **Resultado Obtenido (Error):** [No sale cartel de validación para desactivar la Categoría y no tengo opción de activarla nuevamente.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-08]
**Título / Descripción:** [Desactivar Marca - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Desactivar Marca".]
* **Resultado Esperado:** [Debería salir un cartel indicando si realmene desea desactivarla y una opción para poder activarla nuevamente.]
* **Resultado Obtenido (error):** [No sale cartel de validación para desactivar la Categoría y no tengo opción de activarla nuevamente.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-09]
**Título / Descripción:** [Editar Producto - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Editar Producto".]
* **Resultado Esperado:** [Debería salir un modal o una caja contenedora.]
* **Resultado Obtenido (error):** [Se pierde el "Editar Producto" con el fondo.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-10]
**Título / Descripción:** [Editar Productos - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Guardar Cambios" sin modificar ningún campo.]
* **Resultado Esperado:** [Debería estar desactivado el botón "Guardar Cambios" hasta que se haga alguna modificación.]
* **Resultado Obtenido (Actual):** [Corregido. El binding del botón cambió a `[disabled]="form.invalid || !form.dirty || submitting"`. El flag `form.dirty` es `false` al cargar los datos vía `patchValue` (que no marca dirty) y se vuelve `true` solo cuando el usuario modifica un campo manualmente. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (PR-10) y `product-edit.component.spec.ts`.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-11]
**Título / Descripción:** [Desactivar Productos - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Desactivar Producto".]
* **Resultado Esperado:** [Debería permitir poder desactivar el producto.]
* **Resultado Obtenido (Actual):** [Parcialmente corregido. El frontend envía `{ force: true }` en el body del `PATCH products/:id/deactivate`. El backend devuelve `"No se puede desactivar un producto con unidades reservadas o vendidas."` porque aún no soporta el parámetro `force`. La corrección definitiva requiere soporte backend. El frontend muestra el mensaje de error del servidor correctamente.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-12]
**Título / Descripción:** [Variantes Productos - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Editar Variante".]
* **Resultado Esperado:** [Debería poder mostrar todos los campos en la tabla que se encuentra a la izquierda.]
* **Resultado Obtenido (Actual):** [Corregido. La tabla de variantes ahora tiene columnas separadas COLOR, TALLE y CAPACIDAD. Las columnas se muestran dinámicamente solo si alguna variante del producto usa ese atributo (getters `hasColor`, `hasSize`, `hasCapacity`). El panel de formulario (nueva variante / editar variante) se muestra a demanda al hacer click en "Nueva variante" o "Editar"; cuando está cerrado la tabla ocupa el ancho completo. Las acciones son links de texto horizontales ("Ver unidades | Editar | Desactivar"). Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (PR-12).]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-13]
**Título / Descripción:** [Ingreso de Múltiples Variantes - Productos - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Ingresar Múltiples Variantes".]
* **Resultado Esperado:** [Al ingresar datos erróneos el mensaje me muestra en "Ingreso individual".]
* **Resultado Obtenido (Pendiente):** [La feature "Ingresar Múltiples Variantes" no existe en el codebase actual. Requiere implementación desde cero (UI, validación por fila, mapeo de errores por campo). No atacado en esta sesión.]

---

**Módulo:** [Producto]
**ID de Prueba:** [PR-14]
**Título / Descripción:** [Categoría y Marca - Admin]
### 1. Contexto de la Prueba
* **Resultado Obtenido (Actual):** [Corregido. Se agregó un botón "Editar" por fila en las tablas de Categorías y Marcas. Al hacer click se abre un `p-dialog` con el nombre actual pre-cargado en un input. Al guardar se llama al endpoint de actualización y la tabla se refresca. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (PR-14).]

---

Módulo Planilla

**Módulo:** [Planilla]
**ID de Prueba:** [PL-01]
**Título / Descripción:** [Generar Planilla]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Generar Planilla para todos" y se seleccionó un cobrador y se hizo click en "Generar Planilla".]
* **Resultado Esperado:** [Deberia aparecer las planillas generadas y deshabilitar el botón "Generar Planilla para todos" y dehabilitar el botón "Generar Planilla" cuando se selecciona un cobrador.]
* **Resultado Obtenido (Actual):** [Corregido. Los handlers ahora bloquean reentrada (`generating` / `generatingAll`), los botones quedan deshabilitados durante la ejecución y backend serializa la generación por cobrador/fecha dentro de transacción para evitar reprocesos peligrosos. Validado con `sheet.component.spec.ts`.]

* **Acción Realizada:** [Se hizo click en "Generar Planilla para todos".]
* **Resultado Esperado:** [Deberia aparecer las planillas generadas y deshabilitar el botón "Generar Planilla para todos" y dehabilitar el botón "Generar Planilla" cuando se selecciona un cobrador.]
* **Resultado Obtenido (Error):** [Me permite apretar varias veces el botón "Generar Planilla" ya sea para todos o para un cobrador en particular.]

---

**Módulo:** [Planilla]
**ID de Prueba:** [PL-02]
**Título / Descripción:** [Botones]
### 1. Contexto de la Prueba
* **Resultado Obtenido (Actual):** [Corregido. Las acciones de generar planilla se reordenaron y unificaron en el bloque inferior del formulario usando el patrón visual del proyecto para botones secundarios/primarios. Validado con Cypress `22-admin-generar-planilla.cy.ts`.]

---

**Módulo:** [Planilla]
**ID de Prueba:** [PL-03]
**Título / Descripción:** [Generar Planilla]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Generar Planilla para todos".]
* **Resultado Esperado:** [Deberia aparecer las planillas generadas y deshabilitar el botón "Generar Planilla para todos".]
* **Resultado Obtenido (Error):**[Me permite apretar las veces que uno quiera "Generar Planilla para todos" y en "Planilla Generadas" aparecen todas la veces que apreté, una vez que se genere la planilla ya deberia deshabilitarse esa opción, en "Planillas Generadas" debería aparecer una sola vez una planilla.]

---

Módulo Gastos

**Módulo:** [Gastos]
**ID de Prueba:** [GA-01]
**Título / Descripción:** [Gastos]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en desactivar gasto "Alquiler".]
* **Resultado Esperado:** [Deberia poder activarlo de nuevo si quisiera.]
* **Resultado Obtenido (Actual):** [Corregido. El panel de categorías ahora consulta activas e inactivas (`include_inactive=true`), por lo que una categoría desactivada sigue visible y puede volver a activarse desde la misma UI. Validado con `expense-categories.service.spec.ts` y `expenses.service.spec.ts`.]

---

**Módulo:** [Gastos]
**ID de Prueba:** [GA-02]
**Título / Descripción:** [Gastos]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Registrar Gasto" - Admin.]
* **Resultado Esperado:** [Deberia poder seleccionar el tipo de pago, Efectivo o Transferencia.]
* **Resultado Obtenido (Actual):** [No funciona el menú desplegable en el tipo de pago.]

---

Módulo Usuarios

**Módulo:** [Usuarios]
**ID de Prueba:** [US-01]
**Título / Descripción:** [Rol Usuario]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nuevo Usuario".]
* **Resultado Esperado:** [Deberia poder elegir el Rol.]
* **Resultado Obtenido (Error):** [El menú desplegable del Rol sale cortado con dificultad para elegir el mismo.]

---

**Módulo:** [Usuarios]
**ID de Prueba:** [US-02]
**Título / Descripción:** [Usuarios - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en el buscador en "Usuarios".]
* **Resultado Esperado:** [Deberia filtrar por Rol.]
* **Resultado Obtenido (Error):** [El menú desplegable sale cortado cuando elijo un Rol.]

---

**Módulo:** [Usuarios]
**ID de Prueba:** [US-03]
**Título / Descripción:** [Nuevo Usuario y Editar Usuario - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Nuevo Usuario" y se escribió símbolos en el campo "Nombre Completo" y en "DNI" me permite ingresar un sólo número.]
* **Resultado Esperado:** [Debería poder restringir el ingreso de símbolos en "Nombre Completo" y un solo número en "DNI".]
* **Resultado Obtenido (Actual):** [Corregido. `Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/)` en `fullName`; `Validators.pattern(/^\d{7,8}$/)` en `dni`. Los errores se muestran inline con mensajes descriptivos: "Solo se permiten letras y espacios." y "El DNI debe contener entre 7 y 8 dígitos numéricos." Se agregó `inputmode="numeric"` en el campo DNI. Aplicado en `user-create.component.ts` (modal Nuevo Usuario) y `user-detail.component.ts` (formulario de edición). Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (US-03) y `user-create.component.spec.ts`.]

---

**Módulo:** [Usuarios]
**ID de Prueba:** [US-04]
**Título / Descripción:** [Editar Usuario - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Editar Usuario".]
* **Resultado Esperado:** [El menú desplegable de "Rol" debería mostrarse completo.]
* **Resultado Obtenido (Actual):** [Corregido. `appendTo="body"` agregado al `p-dropdown` de Rol en el formulario de edición (`user-detail.component.html`). El panel del dropdown se renderiza en el body del documento, sin quedar cortado por el contenedor. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (US-04).]

---

**Módulo:** [Usuarios]
**ID de Prueba:** [US-05]
**Título / Descripción:** [Editar Usuario - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Editar Usuario".]
* **Resultado Esperado:** [Debería estar desactivado hasta que se modifique algún campo.]
* **Resultado Obtenido (Actual):** [Corregido. Se reemplazó `!editForm.dirty` por un getter `formHasChanges` que guarda un snapshot de los valores al entrar en modo edición y compara contra los valores actuales en cada evaluación. `form.dirty` es un flag unidireccional (no revierte si el usuario vuelve al valor original); `formHasChanges` sí detecta reversiones. Binding actualizado a `[disabled]="editForm.invalid || !formHasChanges || saving"`. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (US-05).]

---

**Módulo:** [Usuarios]
**ID de Prueba:** [US-06]
**Título / Descripción:** [Crear Usuario - Admin]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Crear Usuario".]
* **Resultado Esperado:** [Debería poder verse el password temporal.]
* **Resultado Obtenido (Actual):** [Corregido. El componente `temp-password-dialog` usaba colores hardcodeados que eran invisibles en tema oscuro. Se reemplazaron por CSS variables del tema: fondo con `var(--ff-secondary)`, borde con `var(--ff-border)`, texto con `var(--ff-text-primary)`. El botón "Copiar" ahora es visible y funcional. Validado con `cypress/e2e/44-qa-regression-batch2.cy.ts` (US-06).]

---

Módulo Caja

**Módulo:** [Caja]
**ID de Prueba:** [CA-01]
**Título / Descripción:** [Cierre de caja]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Cierre de caja".]
* **Resultado Esperado:** [Debería poder realizar el cierre de caja.]
* **Resultado Obtenido (Error):** [Al poner un monto de efectivo y querer realizar el cierre de caja me muestra un mensaje de error interno del servidor.]

### 2. Evidencia Técnica
**Payload Enviado (Request):**
```json
  
{
    declared_cash: 200000
}

```

**Respuesta obtenida:**
```json
{
    "ok": false,
    "message": "Error interno del servidor. Intentá nuevamente más tarde."
}
```

---


## Resumen de correcciones ya validadas

### Sesión 1 (base)
- **CR-01** → Corregido / validado
- **CR-02** → Corregido / validado
- **CR-03** → Corregido / validado
- **CR-04** → Corregido / validado
- **CR-05** → Corregido / validado
- **CR-06** → Corregido / validado
- **CR-07** → Corregido / validado
- **CR-08** → Corregido / validado
- **CL-01** → Corregido / validado
- **CL-02** → Corregido / validado
- **CL-03** → Corregido / validado
- **PR-01** → Validado
- **PR-02** → Corregido / validado
- **PR-03** → Corregido / validado
- **PR-04** → Corregido / validado
- **PR-05** → Corregido / validado
- **PR-06** → Corregido / validado
- **PR-07** (planilla) → Corregido / validado
- **PL-01** → Corregido / validado
- **PL-02** → Corregido / validado
- **GA-01** → Corregido / validado

### Sesión 2 (Grupos A-E + Backend)
- **CR-08b** → Corregido / validado
- **CR-09** → Corregido / validado
- **CR-10** → Corregido / validado
- **CR-12** → Corregido / validado
- **CR-13** → Corregido / validado
- **CR-14** → Corregido / validado
- **CR-15** → Corregido / validado
- **CR-17** → Corregido / validado
- **CA-01** → Corregido / validado
- **CL-02b** → Corregido / validado
- **CL-04** → Corregido / validado
- **CL-05** → Corregido / validado
- **CL-06 / CL-07** → Comportamiento esperado
- **CL-08** → Corregido / validado
- **CL-09** → Corregido / validado
- **CL-10** → Corregido / validado
- **GA-02** → Corregido / validado
- **PR-07** (categorías) → Corregido / validado
- **PR-08** → Corregido / validado
- **PR-09** → Corregido / validado
- **PL-01** → Corregido / validado
- **US-01** → Corregido / validado
- **US-02** → Corregido / validado

### Sesión 3 (QA Batch 2 — esta sesión)
- **CR-18** → Corregido / validado — tasa como %; `!= null`; EXPIRED en tipo y mapas
- **CR-19** → Corregido / validado — "Cancelación total anticipada"; diálogo explicativo
- **CL-11** → Corregido / validado — pattern validator nombres/apellidos; error inline
- **CL-12** → Corregido / validado — pattern validator DNI; `inputmode="numeric"`; error al tipear
- **CL-13** → Corregido / validado — eliminados Ingresos/Cap.Pago; agregado Cobrador
- **CL-14** → Corregido / validado — `includeSummary: true`; delinquency mapeado desde backend
- **CL-15** → Corregido / validado — créditos cargados desde API en detalle de cliente
- **CL-16** → Corregido / validado — modal editar con Email, Dirección, Cobrador; pre-carga
- **PR-10** → Corregido / validado — `!form.dirty` en botón Guardar Cambios
- **PR-12** → Corregido / validado — columnas dinámicas COLOR/TALLE/CAP; panel a demanda
- **PR-14** → Corregido / validado — botón Editar por fila en Categorías y Marcas
- **US-03** → Corregido / validado — pattern validators en user-create y user-detail
- **US-04** → Corregido / validado — `appendTo="body"` en dropdown Rol editar usuario
- **US-05** → Corregido / validado — `formHasChanges` por snapshot; revierte al estado inicial
- **US-06** → Corregido / validado — CSS variables tema en diálogo contraseña temporal

### Pendiente (requiere backend o es feature nueva)
- **PR-11** → Parcial — frontend envía `force: true`; backend aún no lo soporta
- **PR-13** → Pendiente — feature "Múltiples Variantes" no existe; requiere implementación

## Pendientes por datos (no son bugs de código)

- **CR-11** → Pendiente datos — configurar tasas BIWEEKLY/WEEKLY en Admin → Config → Tasas
- **CR-16** → Pendiente datos — cargar atributos color/size/capacity en variantes de productos

## Evidencia automatizada

### Specs de componente
- `src/app/shared/operations/new-operation/new-operation.component.spec.ts` → **12 passing**
- `src/app/shared/operations/new-operation/steps/step-conditions/step-conditions.component.spec.ts` → **5 passing**
- `src/app/shared/operations/new-operation/steps/step-products/step-products.component.spec.ts` → **8 passing**
- `src/app/shared/operations/new-operation/operation-form.service.spec.ts` → **2 passing**
- `src/app/shared/clients/clients.component.spec.ts` → **16 passing**
- `src/app/shared/operations/operations.component.spec.ts` → **6 passing**
- `src/app/features/seller/products/product-edit/product-edit.component.spec.ts` → **6 passing**
- `src/app/features/admin/sheet/sheet.component.spec.ts` → **6 passing**
- `src/app/features/admin/expenses/expense-categories.service.spec.ts` → passing
- `src/app/features/admin/expenses/expenses.service.spec.ts` → passing

### Tests Cypress (existentes)
- `cypress/e2e/31-qa-regression-issues.cy.ts` → passing
- `cypress/e2e/32-client-detail-regression.cy.ts` → passing
- `cypress/e2e/04-clientes.cy.ts` → passing
- `cypress/e2e/30-producto-crear.cy.ts` → passing
- `cypress/e2e/33-product-create-modal-regression.cy.ts` → passing
- `cypress/e2e/34-product-list-regression.cy.ts` → passing
- `cypress/e2e/35-product-success-toast-regression.cy.ts` → passing
- `cypress/e2e/36-product-edit-category-regression.cy.ts` → passing
- `cypress/e2e/22-admin-generar-planilla.cy.ts` → passing

### Tests Cypress (sesión 2)
- `cypress/e2e/38-dropdown-overflow-regression.cy.ts` → Grupo A: US-01, US-02, CL-09, CR-14
- `cypress/e2e/39-calendar-overflow-regression.cy.ts` → Grupo B: CR-10, CL-05
- `cypress/e2e/40-contrast-color-regression.cy.ts` → Grupo C: CL-02b, CR-13, PR-09
- `cypress/e2e/41-pagination-regression.cy.ts` → Grupo D: CR-17, CL-08
- `cypress/e2e/42-group-e-regression.cy.ts` → Grupo E: CL-10, PR-07, PR-08, CR-09

### Tests Cypress (sesión 3 — QA Batch 2)
- `cypress/e2e/44-qa-regression-batch2.cy.ts` → 21 tests: CL-11/12/13/16, US-03/04/05, PR-10/12/14, CR-18/19

### Specs de componente (sesión 3)
- `src/app/features/admin/users/user-create/user-create.component.spec.ts` → US-03: validators fullName y DNI
- `src/app/features/seller/products/product-edit/product-edit.component.spec.ts` → PR-10: dirty check (actualizado)
- `src/app/shared/clients/clients.component.spec.ts` → CL-11/12/13/14: validators y mapeo delinquency (actualizado)

---
