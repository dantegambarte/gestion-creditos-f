const fs = require('fs');
const path = require('path');

// Comandos que solo existen contra el backend real (login real o llamadas API directas).
const REAL_BACKEND_PATTERN = /\bcy\.(loginReal|loginPortalReal|getAuthToken|apiRequest|api[A-Z]\w*)\s*\(/;

/**
 * Indica si el código de un spec usa el backend real.
 * @param {string} source - contenido del archivo .cy.ts
 * @returns {boolean}
 */
function usesRealBackend(source) {
  return REAL_BACKEND_PATTERN.test(source);
}

/**
 * Lista los specs de cypress/e2e que usan el backend real, con ruta relativa
 * al proyecto y separador "/" (el mismo formato que Cypress.spec.relative).
 * @param {string} projectRoot - raíz del proyecto frontend
 * @returns {string[]} rutas relativas ordenadas
 */
function findRealSpecs(projectRoot) {
  const e2eDir = path.join(projectRoot, 'cypress', 'e2e');
  if (!fs.existsSync(e2eDir)) return [];
  return fs
    .readdirSync(e2eDir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.cy.ts'))
    .filter((file) => usesRealBackend(fs.readFileSync(path.join(e2eDir, file), 'utf8')))
    .map((file) => `cypress/e2e/${file.split(path.sep).join('/')}`)
    .sort();
}

module.exports = { usesRealBackend, findRealSpecs };
