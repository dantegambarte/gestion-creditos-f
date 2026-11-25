#!/usr/bin/env node
// Decides which unit tests CI runs for a set of changed files.
// Usage: git diff --name-only <base>...HEAD | node scripts/ci-scope.mjs [--full]
// Prints JSON: { mode: 'none' | 'affected' | 'full', includes: string[], lintFiles: string[] }
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SHARED_PATTERNS = [
  /^src\/app\/core\//,
  /^src\/app\/shared\//,
  /^src\/environments\//,
  /^angular\.json$/,
  /^package(-lock)?\.json$/,
  /^tsconfig[^/]*\.json$/,
  /^karma\.conf\.js$/,
  /^eslint\.config\.js$/,
  /^scripts\//,
  /^\.github\//,
];

// Paths that never affect unit tests: docs, E2E specs (not run per PR) and local tooling.
const NO_UNIT_IMPACT_PATTERN = /(\.md$)|(^docs\/)|(^cypress\/)|(^\.husky\/)|(^\.atl\/)/;
const FEATURE_PATTERN = /^src\/app\/features\/([^/]+)\//;
const LINTABLE_PATTERN = /^src\/.*\.(ts|html)$/;

/**
 * Resolves the CI test scope from the changed file list.
 * @param {string[]} files - repository-relative changed paths
 * @param {{ forceFull?: boolean, hasSpecs?: (dir: string) => boolean }} [options] -
 *   forceFull runs everything (main, nightly, ci:full label); hasSpecs drops feature
 *   folders with no spec on disk (deleted or spec-less), since `ng test --include` fails on them
 * @returns {{ mode: string, includes: string[], lintFiles: string[] }}
 */
export function resolveScope(files, { forceFull = false, hasSpecs = () => true } = {}) {
  const changed = files.map((f) => f.trim()).filter(Boolean);
  const lintFiles = changed.filter((f) => LINTABLE_PATTERN.test(f));

  if (forceFull) return { mode: 'full', includes: [], lintFiles };

  const code = changed.filter((f) => !NO_UNIT_IMPACT_PATTERN.test(f));
  if (code.length === 0) return { mode: 'none', includes: [], lintFiles };

  const features = new Set();
  for (const file of code) {
    if (SHARED_PATTERNS.some((p) => p.test(file))) return { mode: 'full', includes: [], lintFiles };
    const match = FEATURE_PATTERN.exec(file);
    // Any other path runs everything: safer than silently skipping tests.
    if (!match) return { mode: 'full', includes: [], lintFiles };
    features.add(match[1]);
  }

  const includes = [...features]
    .sort()
    .map((f) => `src/app/features/${f}`)
    .filter((dir) => hasSpecs(dir));
  if (includes.length === 0) return { mode: 'none', includes: [], lintFiles };
  return { mode: 'affected', includes, lintFiles };
}

/**
 * Indica si una carpeta contiene al menos un archivo *.spec.ts en disco.
 * @param {string} dir - carpeta relativa al repositorio
 * @returns {boolean}
 */
function dirHasSpecs(dir) {
  if (!existsSync(dir)) return false;
  return readdirSync(dir, { recursive: true }).some((f) => String(f).endsWith('.spec.ts'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = readFileSync(0, 'utf8');
  const scope = resolveScope(input.split('\n'), {
    forceFull: process.argv.includes('--full'),
    hasSpecs: dirHasSpecs,
  });
  process.stdout.write(JSON.stringify(scope));
}
