const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dbResetBlockReason } = require('./db-reset-guard');

const localEnv = { NODE_ENV: 'development', DB_HOST: 'localhost', DB_NAME: 'gestion_creditos' };

test('blocks the reset unless allowDbReset is explicitly true', () => {
  assert.match(dbResetBlockReason({}, localEnv), /allowDbReset/);
  assert.match(dbResetBlockReason({ allowDbReset: 'yes' }, localEnv), /allowDbReset/);
});

test('allows the reset on a local database when opted in', () => {
  assert.equal(dbResetBlockReason({ allowDbReset: true }, localEnv), null);
  assert.equal(dbResetBlockReason({ allowDbReset: 'true' }, { ...localEnv, DB_HOST: '127.0.0.1' }), null);
});

test('never resets a production backend, even when opted in', () => {
  assert.match(
    dbResetBlockReason({ allowDbReset: true }, { ...localEnv, NODE_ENV: 'production' }),
    /production/,
  );
});

test('never resets a remote database host', () => {
  assert.match(
    dbResetBlockReason({ allowDbReset: true }, { ...localEnv, DB_HOST: 'db.example.com' }),
    /local/,
  );
});
