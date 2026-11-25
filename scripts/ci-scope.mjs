#!/usr/bin/env node
// Decides which unit tests CI runs for a set of changed files.
// Usage: git diff --name-only <base>...HEAD | node scripts/ci-scope.mjs [--full]
// Prints JSON: { mode: 'none' | 'affected' | 'full', includes: string[], lintFiles: string[] }
import { readFileSync } from 'node:fs';
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

const DOC_PATTERN = /(\.md$)|(^docs\/)/;
const FEATURE_PATTERN = /^src\/app\/features\/([^/]+)\//;
const LINTABLE_PATTERN = /^src\/.*\.(ts|html)$/;

/**
 * Resolves the CI test scope from the changed file list.
 * @param {string[]} files - repository-relative changed paths
 * @param {{ forceFull?: boolean }} [options] - forceFull runs everything (main, nightly, ci:full label)
 * @returns {{ mode: string, includes: string[], lintFiles: string[] }}
 */
export function resolveScope(files, { forceFull = false } = {}) {
  const changed = files.map((f) => f.trim()).filter(Boolean);
  const lintFiles = changed.filter((f) => LINTABLE_PATTERN.test(f));

  if (forceFull) return { mode: 'full', includes: [], lintFiles };

  const code = changed.filter((f) => !DOC_PATTERN.test(f));
  if (code.length === 0) return { mode: 'none', includes: [], lintFiles };

  const features = new Set();
  for (const file of code) {
    if (SHARED_PATTERNS.some((p) => p.test(file))) return { mode: 'full', includes: [], lintFiles };
    const match = FEATURE_PATTERN.exec(file);
    // Unknown source paths run everything: safer than silently skipping tests.
    if (!match) {
      if (file.startsWith('src/')) return { mode: 'full', includes: [], lintFiles };
      continue;
    }
    features.add(match[1]);
  }

  if (features.size === 0) return { mode: 'none', includes: [], lintFiles };
  const includes = [...features].sort().map((f) => `src/app/features/${f}`);
  return { mode: 'affected', includes, lintFiles };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = readFileSync(0, 'utf8');
  const scope = resolveScope(input.split('\n'), { forceFull: process.argv.includes('--full') });
  process.stdout.write(JSON.stringify(scope));
}
