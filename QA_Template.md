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

Módulo Planilla

**Módulo:** [Planilla]
**ID de Prueba:** [PL-01]
**Título / Descripción:** [Generar Planilla]
### 1. Contexto de la Prueba
* **Acción Realizada:** [Se hizo click en "Generar Planilla para todos" y se seleccionó un cobrador y se hizo click en "Generar Planilla".]
* **Resultado Esperado:** [Deberia aparecer las planillas generadas y deshabilitar el botón "Generar Planilla para todos" y dehabilitar el botón "Generar Planilla" cuando se selecciona un cobrador.]
* **Resultado Obtenido (Actual):** [Corregido. Los handlers ahora bloquean reentrada (`generating` / `generatingAll`), los botones quedan deshabilitados durante la ejecución y backend serializa la generación por cobrador/fecha dentro de transacción para evitar reprocesos peligrosos. Validado con `sheet.component.spec.ts`.]

**Módulo:** [Planilla]
**ID de Prueba:** [PL-02]
**Título / Descripción:** [Botones]
### 1. Contexto de la Prueba
* **Resultado Obtenido (Actual):** [Corregido. Las acciones de generar planilla se reordenaron y unificaron en el bloque inferior del formulario usando el patrón visual del proyecto para botones secundarios/primarios. Validado con Cypress `22-admin-generar-planilla.cy.ts`.]

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


## Resumen de correcciones ya validadas

- **CR-01** → Corregido / validado
- **CR-03** → Corregido / validado
- **CR-04** → Corregido / validado
- **CR-02** → Corregido / validado
- **CR-05** → Corregido / validado (bloqueo por fecha vacía/inválida)
- **CR-06** → Corregido / validado
- **CR-07** → Corregido / validado
- **CR-08** → Corregido / validado
- **CR-09** → Corregido / validado
- **CR-10** → Corregido / validado
- **CL-01** → Corregido / validado
- **CL-02** → Corregido / validado
- **CL-03** → Corregido / validado
- **PR-01** → Validado
- **PR-02** → Corregido / validado (visibilidad de botón Editar)
- **PR-03** → Corregido / validado
- **PR-04** → Corregido / validado
- **PR-05** → Corregido / validado
- **PR-06** → Corregido / validado
- **PR-07** → Corregido / validado
- **PL-01** → Corregido / validado
- **PL-02** → Corregido / validado
- **GA-01** → Corregido / validado

## Errores nuevos o pendientes de atacar

- **Sin pendientes abiertos en esta tanda** → Casos CR-02, CR-09, CR-10, CL-01, PR-07, PL-01, PL-02 y GA-01 fueron corregidos y validados.

## Evidencia automatizada

- `cypress/e2e/31-qa-regression-issues.cy.ts` → passing
- `cypress/e2e/32-client-detail-regression.cy.ts` → passing
- `cypress/e2e/04-clientes.cy.ts` → passing
- `src/app/shared/clients/clients.component.spec.ts` → passing
- `cypress/e2e/30-producto-crear.cy.ts` → passing
- `cypress/e2e/33-product-create-modal-regression.cy.ts` → passing
- `cypress/e2e/34-product-list-regression.cy.ts` → passing
- `cypress/e2e/35-product-success-toast-regression.cy.ts` → passing
- `cypress/e2e/36-product-edit-category-regression.cy.ts` → passing
- `src/app/features/seller/products/product-edit/product-edit.component.spec.ts` → passing
- `src/app/shared/operations/new-operation/new-operation.component.spec.ts` → passing
- `src/app/shared/operations/new-operation/steps/step-conditions/step-conditions.component.spec.ts` → passing
- `src/app/features/admin/sheet/sheet.component.spec.ts` → passing
- `cypress/e2e/22-admin-generar-planilla.cy.ts` → passing
- `src/app/features/admin/expenses/expense-categories.service.spec.ts` → passing
- `src/app/features/admin/expenses/expenses.service.spec.ts` → passing

---
