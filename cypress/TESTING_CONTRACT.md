# Cypress Testing Contract

This contract defines stable conventions for E2E specs in this project.

## Global Run Policy (Safe by Default)

- `npm run e2e:run` requires `--spec` explicitly and fails fast if omitted.
- This prevents accidental execution of the full Cypress suite (~110 specs) during local/CI incremental work.
- To run all specs intentionally, use `npm run e2e:run:all`.

Examples:

```bash
# Partial run (required path for normal work)
npm run e2e:run -- --spec "cypress/e2e/01-auth.cy.ts"

# Multiple specs (comma-separated)
npm run e2e:run -- --spec "cypress/e2e/01-auth.cy.ts,cypress/e2e/04-clientes-real.cy.ts"

# Full suite (explicit only)
npm run e2e:run:all
```

## Core Rules

- Each spec is **self-contained**: it owns login/session setup and all required intercepts.
- Do not share runtime state between specs (`it`) or files.
- Use API mock envelope: `{ ok, data }`.
- Prefer robust selectors: `data-cy` first, stable visible text second.
- Avoid fragile attributes such as `ng-reflect-*`, generated IDs, and debug-only DOM markers.
- Avoid orphan waits (`cy.wait(2000)`) and hidden coupling to execution order.

## Execution Modes: Stub vs Real Backend

### Stub (default)

- Use `cy.loginAs(...)` and spec-local intercepts; run with `realAuthEnabled=false`.
- Stub specs can run against any dev server port (`--config baseUrl=...`).

### Real Backend

- Real specs are suffixed `-real` (or guard with `if (!Cypress.env('realAuthEnabled')) this.skip();`).
- The backend CORS only allows `http://localhost:4200`, so real specs must run against the dev server on :4200.

- Use `cy.loginReal(...)`.
- `cy.loginReal(...)` MUST run with `realAuthEnabled=true` and real credentials in Cypress env.
- In real specs, do **not** intercept auth endpoints:
  - `POST **/auth/login`
  - `GET **/auth/me`

Required env vars for real mode:

- `CYPRESS_realAuthEnabled=true`
- `CYPRESS_realAdminDni`, `CYPRESS_realAdminPassword`
- `CYPRESS_realSellerDni`, `CYPRESS_realSellerPassword`
- `CYPRESS_realCollectorDni`, `CYPRESS_realCollectorPassword`
- `CYPRESS_realSellerCollectorDni`, `CYPRESS_realSellerCollectorPassword` (specs del rol combinado)
- `CYPRESS_realPortalDni`, `CYPRESS_realPortalPassword` (portal cliente)

Valores de referencia con `db:reset` + `npm run seed` (semillas actuales):

- `ADMIN`: DNI `00000000`, password inicial `Admin1234` (temporal; suele cambiarse en primer login)
- `SELLER`: DNI `11111111`, password `123456`
- `COLLECTOR`: DNI `22222222`, password `123456`

Si ya cambiaste la contraseña del ADMIN manualmente (por ejemplo `admin123`), usá ese valor real en `CYPRESS_realAdminPassword`.

Las credenciales no están en `cypress.config.ts`: copiá `cypress.env.example.json` a `cypress.env.json` (gitignored) o exportá las variables `CYPRESS_*`. Sin ellas `loginReal`/`loginPortalReal` fallan explícitamente.

Real backend smoke subset (see `npm run e2e:smoke:real` for the maintained list):

- `cypress/e2e/01-auth.cy.ts`
- `cypress/e2e/04-clientes-real.cy.ts`
- `cypress/e2e/21-seller-clientes-nuevo-real.cy.ts`
- `cypress/e2e/03-nueva-operacion-real.cy.ts`
- `cypress/e2e/10-admin-aprobaciones-real.cy.ts`

Recommended command to run only these real specs:

```bash
npx cypress run --spec "cypress/e2e/01-auth.cy.ts,cypress/e2e/04-clientes-real.cy.ts,cypress/e2e/21-seller-clientes-nuevo-real.cy.ts,cypress/e2e/03-nueva-operacion-real.cy.ts,cypress/e2e/10-admin-aprobaciones-real.cy.ts"
```

## Spec Naming

- File names are `NN-topic.cy.ts`; every prefix is unique. When two specs share a number, add a letter (`17b-`, `17c-`) instead of renumbering, so run order and references stay stable.
- New specs take the next free number. Before renaming a spec, update every reference (`package.json` scripts, these docs, `QA_Template.md`).

## Preconditions Must Fail or Skip Explicitly

- A test must never return early without asserting. In stub specs the data is under our control: if a row, button or dropdown is missing, that is a regression, so assert it (`cy.get(sel).should('exist')`) instead of `if ($body.find(sel).length === 0) return`.
- In real-backend specs, when the precondition depends on seeded data that may legitimately be absent, call `this.skip()` (test declared with `function () {}`) with a comment explaining why. A skipped test shows up as pending in the report; a silent `return` shows up as passed.
- Do not assert on `ng-reflect-*`; assert on real DOM state (`disabled`, visibility, text).

## Dates in Specs

- Build `YYYY-MM-DD` strings from local time (`getFullYear/getMonth/getDate`), never `new Date().toISOString().split('T')[0]`: in Argentina (UTC-3) after 21:00 it returns tomorrow. This mirrors `DateService.toLocalIso()` in the app.
- `toISOString()` is fine for full timestamps sent to the API (instants, not calendar days).
- Dates for calendars that block past days must be relative to today, not hardcoded.

## Desktop and Mobile

- Every new UI feature spec covers desktop and mobile (`cy.viewport(375, 667)`).

## Spec Isolation Checklist

- [ ] Auth is initialized inside the same spec/file (`beforeEach` or helper used by that file).
- [ ] All API intercepts needed by assertions are declared in the same spec/file.
- [ ] No dependence on another spec creating records first.
- [ ] No global mutable state required for pass/fail.

## Mock Contract

All mocked API responses must use:

```ts
{ ok: true, data: ... }
```

Example:

```ts
cy.intercept('GET', '**/api/products*', {
  statusCode: 200,
  body: {
    ok: true,
    data: [{ id: 1, nombre: 'Laptop', precio_venta: 1200 }],
  },
});
```

## snake_case vs UI Assertions

Backend mocks should keep **raw API shape** (usually `snake_case`).
UI assertions should validate **mapped/visible result** (labels, formatted values, rendered fields).

- Use snake_case in intercept body when emulating backend contracts.
- Assert what users see in UI, not internal mapper keys.

Example:

```ts
cy.intercept('GET', '**/api/customers/10', {
  body: { ok: true, data: { first_name: 'Ana', last_name: 'Perez' } },
});

cy.contains('Ana Perez').should('be.visible');
```

## Selector Strategy

Order of preference:

1. `data-cy` hooks
2. Stable visible text (button/heading/label)
3. Semantic structure with scope (`within`) when needed

Avoid:

- `ng-reflect-*`
- CSS classes tied to visual framework internals
- deep nth-child chains

Example:

```ts
cy.get('[data-cy="product-save"]').click();
cy.contains('button', 'Save').should('be.enabled');
```

## Wait and Synchronization Policy

- Wait on aliased network calls (`cy.wait('@alias')`) tied to user actions.
- Prefer state assertions over time delays.
- If polling or debounce exists, wait on deterministic events/requests.

Bad:

```ts
cy.wait(1500);
```

Good:

```ts
cy.intercept('POST', '**/api/products').as('createProduct');
cy.get('[data-cy="product-save"]').click();
cy.wait('@createProduct').its('response.statusCode').should('eq', 201);
```

## Minimal Endpoint Checklist by Domain

Use this as a baseline for each spec touching a domain.

### Auth

- [ ] Login/session bootstrap endpoint(s)
- [ ] Current user/profile endpoint
- [ ] Role/permissions payload used by guards

### Products

- [ ] List endpoint for table/index views
- [ ] Create endpoint for `/admin/products/new`
- [ ] Optional detail endpoint when edit/back flow requires it

### Customers

- [ ] List/search endpoint
- [ ] Create/update endpoint for form flows
- [ ] Detail endpoint for profile/summary screens

### Credits / Collections

- [ ] Credit list/detail endpoint
- [ ] Payment/collection action endpoint
- [ ] Status/history endpoint when UI displays timeline

### Portal Credits

- [ ] Portal auth/context endpoint
- [ ] Portal credits list endpoint
- [ ] Portal credit detail or payment status endpoint

## Quick Spec Skeleton

```ts
describe('Products - create', () => {
  beforeEach(() => {
    // auth owned by this spec
    cy.loginAs('admin');

    cy.intercept('POST', '**/api/products', {
      statusCode: 201,
      body: { ok: true, data: { id: 99, nombre: 'Laptop' } },
    }).as('createProduct');
  });

  it('creates a product from /admin/products/new', () => {
    cy.visit('/admin/products/new');
    cy.get('[data-cy="product-name"]').type('Laptop');
    cy.get('[data-cy="product-save"]').click();
    cy.wait('@createProduct');
    cy.contains('Product created').should('be.visible');
  });
});
```
