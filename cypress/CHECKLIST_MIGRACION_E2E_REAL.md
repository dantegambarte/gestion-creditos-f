# Checklist migracion Cypress a E2E real

Estado general: en progreso.

## Regla de done por spec

- [ ] Usa `cy.loginReal(...)` o autenticacion real equivalente
- [ ] No usa `req.reply(...)`
- [ ] No usa `cy.intercept(..., { body: ... })` para stub de respuesta
- [ ] Si usa `cy.intercept`, es solo spy/wait (`.as(...)`) sin mockear body
- [ ] Prepara datos con `cy.api*` y/o `cy.task('db:seed:e2e')`
- [ ] Limpia datos de prueba o deja escenario idempotente
- [ ] Valida persistencia real (UI + API o recarga)

## Avance actual informado

- [x] `cypress/e2e/01-auth.cy.ts` -> 10/10 tests pasando (run local verificado)

## Fase 1 (prioridad alta: CU01, CU03, CU05, CU08)

- [x] `cypress/e2e/01-auth.cy.ts` (CU01)
- [x] `cypress/e2e/05-negative-auth.cy.ts` -> 5/5 tests pasando (run local verificado)
- [x] `cypress/e2e/04-clientes-real.cy.ts` (CU03) -> 3/3 tests pasando (run local verificado)
- [x] `cypress/e2e/04-clientes.cy.ts` -> consolidado en `04-clientes-real.cy.ts` y eliminado (15/15 tests pasando)
- [x] `cypress/e2e/06-negative-clientes.cy.ts` -> 5/5 tests pasando (run local verificado)
- [x] `cypress/e2e/21-seller-clientes-nuevo-real.cy.ts` (CU03) -> 1/1 test pasando (run local verificado)
- [x] `cypress/e2e/21-seller-clientes-nuevo.cy.ts` -> consolidado en `21-seller-clientes-nuevo-real.cy.ts` y retirado
- [x] `cypress/e2e/03-nueva-operacion-real.cy.ts` (CU05) -> fecha personalizada + enganche + cuotas adelantadas cubiertos (4/4 en verde)
- [x] `cypress/e2e/03-nueva-operacion.cy.ts` -> consolidado en `03-nueva-operacion-real.cy.ts` y retirado
- [x] `cypress/e2e/07-negative-nueva-operacion.cy.ts` -> migrado a real (4/4 tests pasando, run local verificado)
- [x] `cypress/e2e/10-admin-aprobaciones-real.cy.ts` (CU08) -> ampliado con rechazo + aprobación ajustada (200/409 dominio), 3/3 en verde
- [x] `cypress/e2e/10-admin-aprobaciones.cy.ts` -> consolidado en `10-admin-aprobaciones-real.cy.ts` y retirado

## Fase 2 (CU07, CU09, CU14)

- [x] `cypress/e2e/09-cobranzas-collector.cy.ts` (CU07) -> migrado a real (3/3 tests pasando, run local verificado)
- [x] `cypress/e2e/22-admin-generar-planilla.cy.ts` (CU14) -> migrado a real (3/3 tests pasando, run local verificado)
- [x] `cypress/e2e/26-collector-planilla-detalle.cy.ts` (CU14) -> migrado a real (3/3 tests pasando, run local verificado)
- [x] `cypress/e2e/29-admin-collection-detail.cy.ts` (CU09/CU14) -> migrado a real (3/3 tests pasando, run local verificado)
- [x] `cypress/e2e/17-admin-colecciones-gastos-pagos.cy.ts` -> separado de colecciones (queda gastos+cobros) y migrado a real (5/5 tests pasando)
- [x] `cypress/e2e/20-admin-config-sheet.cy.ts` -> migrado a real (4/4 tests pasando, incluye contrato de fallback para /admin/sheet)

## Fase 3 (CU11, CU12, CU13, CU02, CU04, CU15)

- [x] `cypress/e2e/12-portal-clientes.cy.ts` (CU11) -> migrado a real (3/3 tests pasando con portal real)
- [x] `cypress/e2e/27-portal-credits.cy.ts` (CU11) -> migrado a real (4/4 tests pasando con portal real)
- [x] `cypress/e2e/37-portal-auth-use-cases.cy.ts` (CU01/CU11) -> migrado a real (5/5 tests pasando con portal real)
- [x] `cypress/e2e/19-public-password.cy.ts` (CU01/CU11) -> migrado a real (4/4 tests pasando con backend real)
- [x] `cypress/e2e/11-caja-tesoreria.cy.ts` (CU12) -> migrado a real (3/3 tests pasando, sin mutar cierre real)
- [x] `cypress/e2e/18-admin-reportes-mora.cy.ts` (CU12/CU13) -> migrado a real (9/9 tests pasando)
- [x] `cypress/e2e/23-credit-detail.cy.ts` (CU08/CU13) -> migrado a real (5/5 tests pasando)
- [x] `cypress/e2e/09-admin-usuarios.cy.ts` (CU02) -> migrado a real (5/5 tests pasando)
- [x] `cypress/e2e/28-admin-user-detail.cy.ts` (CU02) -> migrado a real (4/4 tests pasando)
- [x] `cypress/e2e/15-seller-productos.cy.ts` (CU04) -> migrado a real (9/9 tests pasando)
- [x] `cypress/e2e/24-producto-detalle-editar.cy.ts` (CU04) -> migrado a real (5/5 tests pasando)
- [x] `cypress/e2e/30-producto-crear.cy.ts` (CU04) -> migrado a real (8/8 tests pasando)
- [x] `cypress/e2e/16-comisiones.cy.ts` (CU15) -> migrado a real (12/12 tests pasando)

## Suite UI/regresion (separar de E2E real)

- [x] `cypress/e2e/31-qa-regression-issues.cy.ts` (3/3 passing)
- [x] `cypress/e2e/32-client-detail-regression.cy.ts` (2/2 passing)
- [x] `cypress/e2e/33-product-create-modal-regression.cy.ts` (1/1 passing)
- [x] `cypress/e2e/34-product-list-regression.cy.ts` (1/1 passing)
- [x] `cypress/e2e/35-product-success-toast-regression.cy.ts` (1/1 passing)
- [x] `cypress/e2e/36-product-edit-category-regression.cy.ts` (1/1 passing)
- [x] `cypress/e2e/38-dropdown-overflow-regression.cy.ts` (5/5 passing)
- [x] `cypress/e2e/39-calendar-overflow-regression.cy.ts` (6/6 passing)
- [x] `cypress/e2e/40-contrast-color-regression.cy.ts` (9/9 passing)
- [x] `cypress/e2e/41-pagination-regression.cy.ts` (11/11 passing)
- [x] `cypress/e2e/42-group-e-regression.cy.ts` (10/10 passing)
- [x] `cypress/e2e/43-admin-config-holidays.cy.ts` (6/6 passing)
- [x] `cypress/e2e/43-session-changes-regression.cy.ts` (11/11 passing)
- [x] `cypress/e2e/44-qa-regression-batch2.cy.ts` (21/21 passing)
- [x] `cypress/e2e/02-sidebar-navigation.cy.ts` (16/16 passing, queda en suite UI/regresión)

## Control de cambios frontend por tanda

En cada PR/tanda de migracion E2E validar tambien frontend:

- [ ] Selectores estables (`data-testid` / `data-cy`) sin dependencia fragile de texto
- [ ] Guards y redirects por rol no cambiaron contrato
- [ ] Formularios y flujos CU no rompieron UX esperada
- [ ] Mensajes de error reales del backend estan asertados (no hardcode viejo)
- [ ] No se introdujeron mocks nuevos en specs marcados como reales
