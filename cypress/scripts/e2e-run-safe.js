#!/usr/bin/env node

const { spawnSync } = require('child_process');

/**
 * Detecta si se pasó --spec en los argumentos de CLI.
 * @param {string[]} args - Argumentos recibidos por pnpm run.
 * @returns {boolean} true si existe --spec o --spec=valor.
 */
function hasExplicitSpec(args) {
  return args.some((arg, index) => {
    if (arg === '--spec') {
      const next = args[index + 1];
      return Boolean(next && !next.startsWith('-'));
    }
    return arg.startsWith('--spec=') && arg.length > '--spec='.length;
  });
}

const forwardedArgs = process.argv.slice(2);

if (!hasExplicitSpec(forwardedArgs)) {
  console.error('[e2e:run] Seguridad Cypress: este comando requiere --spec explícito.');
  console.error('Ejemplo: pnpm e2e:run --spec "cypress/e2e/01-auth-real.cy.ts"');
  console.error('Suite completa: pnpm e2e:run:all');
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'cypress', 'run', ...forwardedArgs], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error('[e2e:run] Error ejecutando Cypress:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
