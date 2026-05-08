# Cypress Route Flows

Practical route-level expectations for stable E2E coverage.

## Scope

This document covers:

- Product creation route flow at `/admin/products/new`
- Back-navigation expectations
- Basic role guard behavior
- Minimal route-linked endpoint checklist per domain

## Product Create Flow (`/admin/products/new`)

Expected happy path:

- [ ] User has valid admin auth context in this spec.
- [ ] Required create-page data endpoints are intercepted.
- [ ] Visiting `/admin/products/new` renders the form.
- [ ] Submitting valid data calls create endpoint.
- [ ] Success feedback appears and route transitions as designed (list/detail).

Example:

```ts
cy.loginAs('admin');
cy.intercept('GET', '**/api/products/meta*', { body: { ok: true, data: {} } });
cy.intercept('POST', '**/api/products', {
  statusCode: 201,
  body: { ok: true, data: { id: 44, nombre: 'Tablet' } },
}).as('createProduct');

cy.visit('/admin/products/new');
cy.get('[data-cy="product-name"]').type('Tablet');
cy.get('[data-cy="product-save"]').click();
cy.wait('@createProduct');
```

## Back Navigation Expectations

Back actions should be deterministic and testable.

- From `/admin/products/new`, clicking back/cancel should return to the expected parent route (commonly `/admin/products`).
- If unsaved changes protection exists, assert the warning/confirm behavior explicitly.
- Do not rely on browser history side-effects from previous tests.

Example:

```ts
cy.visit('/admin/products/new');
cy.get('[data-cy="back-button"]').click();
cy.url().should('include', '/admin/products');
```

## Role Guard Basics

Minimum guard scenarios:

- [ ] Authorized role (e.g., admin) can access protected admin routes.
- [ ] Unauthorized authenticated role is redirected or shown forbidden state.
- [ ] Unauthenticated user is redirected to login.

Example:

```ts
cy.loginAs('collector');
cy.visit('/admin/products/new');
cy.url().should('not.include', '/admin/products/new');
```

## Route Flow Stability Rules

- Own auth and intercept setup inside each spec file.
- Keep API response contract as `{ ok, data }`.
- Use stable selectors/text only (`data-cy`, visible labels).
- Avoid `ng-reflect-*` selectors and orphan waits.
- Assert route changes with `cy.url()` or location checks after user action.

## Minimal Endpoint Checklist by Domain

Use the relevant subset depending on route under test.

### Auth Routes

- [ ] Login/session endpoint
- [ ] Current user/profile endpoint
- [ ] Permissions/roles endpoint used by guards

### Product Routes

- [ ] List endpoint (`/admin/products`)
- [ ] Create endpoint (`POST /products`) for `/admin/products/new`
- [ ] Detail endpoint if redirect lands on product detail

### Customer Routes

- [ ] Customer list/search endpoint
- [ ] Create/update customer endpoint
- [ ] Customer detail endpoint

### Credits / Collections Routes

- [ ] Credits list/detail endpoint
- [ ] Collection/payment submit endpoint
- [ ] Status/history endpoint for route data panels

### Portal Credits Routes

- [ ] Portal session/auth context endpoint
- [ ] Portal credits list endpoint
- [ ] Portal credit detail/payment status endpoint
