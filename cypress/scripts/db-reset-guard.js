const fs = require('fs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Indica por qué no se debe ejecutar el reset destructivo de la base, o null si está permitido.
 * Exige opt-in explícito (CYPRESS_allowDbReset=true) y un backend local que no sea producción.
 * @param {Record<string, unknown>} cypressEnv - variables de entorno de Cypress (config.env)
 * @param {Record<string, string | undefined>} backendEnv - entorno efectivo del backend
 * @returns {string | null} motivo del bloqueo, o null si el reset puede correr
 */
function dbResetBlockReason(cypressEnv, backendEnv) {
  const optIn = cypressEnv.allowDbReset;
  if (optIn !== true && optIn !== 'true') {
    return 'db:reset:full is disabled. Run Cypress with CYPRESS_allowDbReset=true to allow it.';
  }
  if (String(backendEnv.NODE_ENV || '').trim() === 'production') {
    return 'db:reset:full refused: the backend .env has NODE_ENV=production.';
  }
  if (!LOCAL_HOSTS.has(String(backendEnv.DB_HOST || '').trim())) {
    return `db:reset:full refused: DB_HOST "${backendEnv.DB_HOST}" is not a local host.`;
  }
  return null;
}

/**
 * Lee un archivo .env simple (CLAVE=valor) sin dependencias externas.
 * Recorta espacios y, en valores sin comillas, descarta comentarios inline
 * ("valor # comentario"), con el mismo criterio que dotenv.
 * @param {string} filePath - ruta al .env
 * @returns {Record<string, string>} pares clave/valor (vacío si el archivo no existe)
 */
function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const raw = match[2].trim();
    const quote = raw[0];
    const isQuoted = (quote === '"' || quote === "'") && raw.length > 1 && raw.endsWith(quote);
    env[match[1]] = isQuoted ? raw.slice(1, -1) : raw.replace(/\s+#.*$/, '').trim();
  }
  return env;
}

/**
 * Combina el .env del backend con el entorno del proceso: las variables ya
 * definidas en el proceso ganan, igual que dotenv (que no las sobreescribe).
 * @param {Record<string, string>} fileEnv - valores leídos del .env
 * @param {Record<string, string | undefined>} processEnv - entorno heredado por el backend
 * @returns {Record<string, string | undefined>} entorno efectivo del backend
 */
function effectiveBackendEnv(fileEnv, processEnv) {
  const env = { ...fileEnv };
  for (const key of ['NODE_ENV', 'DB_HOST', 'DB_NAME']) {
    if (processEnv[key] !== undefined) env[key] = processEnv[key];
  }
  return env;
}

module.exports = { dbResetBlockReason, readEnvFile, effectiveBackendEnv };
