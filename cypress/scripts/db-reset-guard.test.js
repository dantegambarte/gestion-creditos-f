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

test('treats a production NODE_ENV with spaces or inline comment as production', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { readEnvFile } = require('./db-reset-guard');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envfile-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'NODE_ENV=production   # prod box\nDB_HOST=localhost \n');
  try {
    const env = readEnvFile(file);
    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.DB_HOST, 'localhost');
    assert.match(dbResetBlockReason({ allowDbReset: true }, env), /production/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('process environment overrides the .env file, like dotenv does', () => {
  const { effectiveBackendEnv } = require('./db-reset-guard');
  const env = effectiveBackendEnv({ DB_HOST: 'localhost', NODE_ENV: 'development' }, { DB_HOST: 'db.remote.io' });
  assert.equal(env.DB_HOST, 'db.remote.io');
  assert.match(dbResetBlockReason({ allowDbReset: true }, env), /local/);
});

test('keeps a quoted value intact when an inline comment follows it', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { readEnvFile } = require('./db-reset-guard');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'envfile-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'NODE_ENV="production" # prod\nDB_NAME=\'with # hash\'\n');
  try {
    const env = readEnvFile(file);
    assert.equal(env.NODE_ENV, 'production');
    assert.equal(env.DB_NAME, 'with # hash');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
