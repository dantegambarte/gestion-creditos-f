# Cypress Testing Contract

This contract defines stable conventions for E2E specs in this project.

## Core Rules

- Each spec is **self-contained**: it owns login/session setup and all required intercepts.
- Do not share runtime state between specs (`it`) or files.
- Use API mock envelope: `{ ok, data }`.
- Prefer robust selectors: `data-cy` first, stable visible text second.
- Avoid fragile attributes such as `ng-reflect-*`, generated IDs, and debug-only DOM markers.
- Avoid orphan waits (`cy.wait(2000)`) and hidden coupling to execution order.

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
