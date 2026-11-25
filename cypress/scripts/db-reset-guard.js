const fs = require('fs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Indica por qué no se debe ejecutar el reset destructivo de la base, o null si está permitido.
 * Exige opt-in explícito (CYPRESS_allowDbReset=true) y un backend local que no sea producción.
 * @param {Record<string, unknown>} cypressEnv - variables de entorno de Cypress (config.env)
 * @param {Record<string, string | undefined>} backendEnv - variables del .env del backend
 * @returns {string | null} motivo del bloqueo, o null si el reset puede correr
 */
function dbResetBlockReason(cypressEnv, backendEnv) {
  const optIn = cypressEnv.allowDbReset;
  if (optIn !== true && optIn !== 'true') {
    return 'db:reset:full is disabled. Run Cypress with CYPRESS_allowDbReset=true to allow it.';
  }
  if (backendEnv.NODE_ENV === 'production') {
    return 'db:reset:full refused: the backend .env has NODE_ENV=production.';
  }
  if (!LOCAL_HOSTS.has(String(backendEnv.DB_HOST || '').trim())) {
    return `db:reset:full refused: DB_HOST "${backendEnv.DB_HOST}" is not a local host.`;
  }
  return null;
}

/**
 * Lee un archivo .env simple (CLAVE=valor) sin dependencias externas.
 * @param {string} filePath - ruta al .env
 * @returns {Record<string, string>} pares clave/valor (vacío si el archivo no existe)
 */
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

module.exports = { dbResetBlockReason, readEnvFile };
