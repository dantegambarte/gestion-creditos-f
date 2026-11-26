# Plan de partición de archivos grandes (#42)

Plan, no ejecutado. Cada paso es un PR propio, refactor puro, con la suite unitaria y los E2E existentes en verde sin tocar asserts.

| Archivo | Líneas | Partición propuesta |
|---|---|---|
| `src/app/shared/operations/new-operation/operation-form.service.ts` | ~1880 | Ya tiene secciones marcadas. Extraer: `operation-financials.ts` (getters financieros + helpers por línea, funciones puras testeables), `operation-cart.service.ts` (gestión del carrito), `operation-client.service.ts` (helpers y carga de clientes), `operation-form.validators.ts` (validadores). El servicio queda como fachada que orquesta formulario, suscripciones y submit. |
| `src/app/features/admin/cash-register/cash-register.component.html` (+ `.ts`, ~910) | ~1870 | Los 4 `<p-dialog>` inline (líneas ~1067, ~1355, ~1608, ~1820) pasan a componentes presentacionales, siguiendo el patrón de `cash-session-open-dialog/` y `cash-session-close-dialog/`. Luego separar la vista desktop y las cards mobile en presentacionales; el contenedor conserva estado y llamadas a `CashRegisterService`. |
| `src/styles.scss` | ~3700 | Partir en parciales por responsabilidad (`_tokens`, `_primeng-overrides`, `_mobile-ios-shield`, `_dialogs`, `_toasts`) importados con `@use` en el mismo orden, para no alterar la cascada. Validar con los E2E mobile. |

Orden sugerido: `styles.scss` (sin lógica), luego diálogos de caja, por último `operation-form.service.ts` (mayor riesgo; empezar por las funciones puras financieras con tests propios).
