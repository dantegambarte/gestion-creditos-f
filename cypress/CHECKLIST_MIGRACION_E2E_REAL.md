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

- [x] `cypress/e2e/01-auth-real.cy.ts` -> 10/10 tests pasando (run local verificado)

## Fase 1 (prioridad alta: CU01, CU03, CU05, CU08)

- [x] `cypress/e2e/01-auth-real.cy.ts` (CU01)
- [ ] `cypress/e2e/01-auth.cy.ts` -> migrar a real o retirar si queda duplicado
- [ ] `cypress/e2e/05-negative-auth.cy.ts` -> migrar a real (errores reales)
- [ ] `cypress/e2e/04-clientes-real.cy.ts` (CU03) -> ampliar alternativos
- [ ] `cypress/e2e/04-clientes.cy.ts` -> migrar a real o consolidar
- [ ] `cypress/e2e/06-negative-clientes.cy.ts` -> migrar a real
- [ ] `cypress/e2e/21-seller-clientes-nuevo-real.cy.ts` (CU03)
- [ ] `cypress/e2e/21-seller-clientes-nuevo.cy.ts` -> migrar/consolidar
- [ ] `cypress/e2e/03-nueva-operacion-real.cy.ts` (CU05) -> cubrir enganche/cuotas adelantadas/fecha personalizada
- [ ] `cypress/e2e/03-nueva-operacion.cy.ts` -> migrar a real o consolidar
- [ ] `cypress/e2e/07-negative-nueva-operacion.cy.ts` -> migrar a real
- [ ] `cypress/e2e/10-admin-aprobaciones-real.cy.ts` (CU08) -> ampliar rechazo/stock/lote
- [ ] `cypress/e2e/10-admin-aprobaciones.cy.ts` -> migrar/consolidar

## Fase 2 (CU07, CU09, CU14)

- [ ] `cypress/e2e/09-cobranzas-collector.cy.ts` (CU07) -> migrar a real
- [ ] `cypress/e2e/22-admin-generar-planilla.cy.ts` (CU14) -> migrar a real
- [ ] `cypress/e2e/26-collector-planilla-detalle.cy.ts` (CU14) -> migrar a real
- [ ] `cypress/e2e/29-admin-collection-detail.cy.ts` (CU09/CU14) -> migrar a real
- [ ] `cypress/e2e/17-admin-colecciones-gastos-pagos.cy.ts` -> separar cobertura y migrar
- [ ] `cypress/e2e/20-admin-config-sheet.cy.ts` -> migrar a real

## Fase 3 (CU11, CU12, CU13, CU02, CU04, CU15)

- [ ] `cypress/e2e/12-portal-clientes.cy.ts` (CU11) -> migrar a real
- [ ] `cypress/e2e/27-portal-credits.cy.ts` (CU11) -> migrar a real
- [ ] `cypress/e2e/37-portal-auth-use-cases.cy.ts` (CU01/CU11) -> migrar a real
- [ ] `cypress/e2e/19-public-password.cy.ts` (CU01/CU11) -> migrar a real
- [ ] `cypress/e2e/11-caja-tesoreria.cy.ts` (CU12) -> migrar a real
- [ ] `cypress/e2e/18-admin-reportes-mora.cy.ts` (CU12/CU13) -> migrar a real
- [ ] `cypress/e2e/23-credit-detail.cy.ts` (CU08/CU13) -> migrar a real
- [ ] `cypress/e2e/09-admin-usuarios.cy.ts` (CU02) -> migrar a real
- [ ] `cypress/e2e/28-admin-user-detail.cy.ts` (CU02) -> migrar a real
- [ ] `cypress/e2e/15-seller-productos.cy.ts` (CU04) -> migrar a real
- [ ] `cypress/e2e/24-producto-detalle-editar.cy.ts` (CU04) -> migrar a real
- [ ] `cypress/e2e/30-producto-crear.cy.ts` (CU04) -> migrar a real
- [ ] `cypress/e2e/16-comisiones.cy.ts` (CU15) -> migrar a real

## Suite UI/regresion (separar de E2E real)

- [ ] `cypress/e2e/31-qa-regression-issues.cy.ts`
- [ ] `cypress/e2e/32-client-detail-regression.cy.ts`
- [ ] `cypress/e2e/33-product-create-modal-regression.cy.ts`
- [ ] `cypress/e2e/34-product-list-regression.cy.ts`
- [ ] `cypress/e2e/35-product-success-toast-regression.cy.ts`
- [ ] `cypress/e2e/36-product-edit-category-regression.cy.ts`
- [ ] `cypress/e2e/38-dropdown-overflow-regression.cy.ts`
- [ ] `cypress/e2e/39-calendar-overflow-regression.cy.ts`
- [ ] `cypress/e2e/40-contrast-color-regression.cy.ts`
- [ ] `cypress/e2e/41-pagination-regression.cy.ts`
- [ ] `cypress/e2e/42-group-e-regression.cy.ts`
- [ ] `cypress/e2e/43-admin-config-holidays.cy.ts`
- [ ] `cypress/e2e/43-session-changes-regression.cy.ts`
- [ ] `cypress/e2e/44-qa-regression-batch2.cy.ts`
- [ ] `cypress/e2e/02-sidebar-navigation.cy.ts` (definir si queda smoke real o UI)

## Control de cambios frontend por tanda

En cada PR/tanda de migracion E2E validar tambien frontend:

- [ ] Selectores estables (`data-testid` / `data-cy`) sin dependencia fragile de texto
- [ ] Guards y redirects por rol no cambiaron contrato
- [ ] Formularios y flujos CU no rompieron UX esperada
- [ ] Mensajes de error reales del backend estan asertados (no hardcode viejo)
- [ ] No se introdujeron mocks nuevos en specs marcados como reales
