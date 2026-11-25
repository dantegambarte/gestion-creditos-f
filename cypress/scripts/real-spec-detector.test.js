const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { usesRealBackend, findRealSpecs } = require('./real-spec-detector');

test('detects specs that talk to the real backend', () => {
  assert.equal(usesRealBackend("cy.loginReal('ADMIN', '/admin');"), true);
  assert.equal(usesRealBackend("cy.getAuthToken('SELLER')"), true);
  assert.equal(usesRealBackend("cy.apiRequest('GET', '/x', null, t)"), true);
  assert.equal(usesRealBackend('cy.apiCreateCustomer({})'), true);
});

test('ignores mocked specs', () => {
  assert.equal(usesRealBackend("cy.loginAs('ADMIN'); cy.intercept('GET', '/api/x')"), false);
});

test('lists real specs relative to the project root', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'real-specs-'));
  const e2e = path.join(root, 'cypress', 'e2e');
  fs.mkdirSync(e2e, { recursive: true });
  fs.writeFileSync(path.join(e2e, '01-real.cy.ts'), "cy.loginReal('ADMIN');");
  fs.writeFileSync(path.join(e2e, '02-mock.cy.ts'), "cy.loginAs('ADMIN');");
  try {
    assert.deepEqual(findRealSpecs(root), ['cypress/e2e/01-real.cy.ts']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
