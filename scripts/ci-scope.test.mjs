import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScope } from './ci-scope.mjs';

test('docs-only change runs no tests', () => {
  const scope = resolveScope(['README.md', 'docs/guide.md']);
  assert.equal(scope.mode, 'none');
  assert.deepEqual(scope.includes, []);
});

test('feature change runs only that feature specs', () => {
  const scope = resolveScope([
    'src/app/features/admin/clients/clients.component.ts',
    'src/app/features/collector/route/route.component.html',
  ]);
  assert.equal(scope.mode, 'affected');
  assert.deepEqual(scope.includes, [
    'src/app/features/admin',
    'src/app/features/collector',
  ]);
});

test('shared code forces the full suite', () => {
  for (const file of [
    'src/app/core/auth/auth.service.ts',
    'src/app/shared/directives/x.ts',
    'src/environments/environment.development.ts',
    'angular.json',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    '.nvmrc',
    'tsconfig.app.json',
    'karma.conf.js',
  ]) {
    assert.equal(resolveScope([file]).mode, 'full', file);
  }
});

test('shared code wins over a feature change', () => {
  const scope = resolveScope(['src/app/features/admin/a.ts', 'src/app/shared/b.ts']);
  assert.equal(scope.mode, 'full');
});

test('unknown source paths fall back to the full suite', () => {
  assert.equal(resolveScope(['src/app/app.routes.ts']).mode, 'full');
});

test('unknown root files fall back to the full suite', () => {
  for (const file of ['server.ts', 'tailwind.config.js', 'ngsw-config.json', 'tsconfig.spec.json']) {
    assert.equal(resolveScope([file]).mode, 'full', file);
  }
});

test('e2e-only and tooling-local changes run no unit tests', () => {
  assert.equal(resolveScope(['cypress/e2e/01-auth.cy.ts', '.husky/pre-commit']).mode, 'none');
});

test('features without specs on disk are dropped from the includes', () => {
  const hasSpecs = (dir) => dir === 'src/app/features/admin';
  const scope = resolveScope(
    ['src/app/features/admin/a.ts', 'src/app/features/removed/b.ts'],
    { hasSpecs },
  );
  assert.equal(scope.mode, 'affected');
  assert.deepEqual(scope.includes, ['src/app/features/admin']);
});

test('no remaining specs means no unit tests', () => {
  const scope = resolveScope(['src/app/features/removed/b.ts'], { hasSpecs: () => false });
  assert.equal(scope.mode, 'none');
});

test('lint targets only changed ts and html files under src', () => {
  const scope = resolveScope([
    'src/app/features/admin/a.ts',
    'src/app/features/admin/a.html',
    'src/app/features/admin/a.scss',
    'README.md',
  ]);
  assert.deepEqual(scope.lintFiles, ['src/app/features/admin/a.ts', 'src/app/features/admin/a.html']);
});

test('forced full run ignores the file list', () => {
  assert.equal(resolveScope(['README.md'], { forceFull: true }).mode, 'full');
});
