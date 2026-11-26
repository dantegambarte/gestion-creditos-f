import { defineConfig } from 'cypress';
import { execSync } from 'child_process';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { dbResetBlockReason, readEnvFile, effectiveBackendEnv } = require('./cypress/scripts/db-reset-guard');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { findRealSpecs } = require('./cypress/scripts/real-spec-detector');

const BACKEND_DIR = path.resolve(
  __dirname,
  '../../backend/gestion_creditos_backend',
);
const API_BASE = 'http://localhost:3000/api';

export default defineConfig({
  env: {
    // ── Modo real ─────────────────────────────────────────────────────
    // Habilitar con CYPRESS_realAuthEnabled=true o sobreescribir aquí.
    realAuthEnabled: true,

    // ── Credenciales reales ───────────────────────────────────────────
    // Nunca se hardcodean acá. Se leen de CYPRESS_realAdminDni,
    // CYPRESS_realAdminPassword, etc. o de cypress.env.json (gitignored;
    // ver cypress.env.example.json). Sin ellas, loginReal falla explícitamente.

    // ── URL base del backend (usada por los helpers cy.api*) ──────────
    apiBaseUrl: API_BASE,
  },

  e2e: {
    baseUrl: 'http://localhost:4200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',

    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 8000,
    video: false,
    screenshotOnRunFailure: true,

    reporter: 'mochawesome',
    reporterOptions: {
      reportDir: 'cypress/reports/mocha',
      quite: true,
      overwrite: false,
      html: false,
      json: true,
    },

    setupNodeEvents(on, config) {
      // Specs que usan el backend real: cypress/support/e2e.ts los saltea
      // cuando realAuthEnabled es false, en vez de fallar en cy.loginReal.
      config.env.realSpecs = findRealSpecs(__dirname);

      on('task', {
        /**
         * Ejecuta la semilla 05 de E2E contra la BD local.
         * Idempotente: la propia semilla saltea si ya fue ejecutada.
         */
        'db:seed:e2e'() {
          try {
            execSync('node src/seeds/05_e2e.seed.js', {
              cwd: BACKEND_DIR,
              stdio: 'pipe',
            });
            return { ok: true };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, error: msg };
          }
        },

        /**
         * Ejecuta db:reset completo + todas las semillas.
         * ⚠️ DESTRUCTIVO — bloqueado salvo opt-in explícito
         * (CYPRESS_allowDbReset=true) y backend local que no sea producción.
         */
        'db:reset:full'() {
          const blockReason = dbResetBlockReason(
            config.env,
            effectiveBackendEnv(readEnvFile(path.join(BACKEND_DIR, '.env')), process.env),
          );
          // Fallar el test (no devolver ok:false): un spec que no revisa el
          // resultado seguiría corriendo contra una base sin resetear.
          if (blockReason) throw new Error(blockReason);
          try {
            execSync('npm run db:reset', {
              cwd: BACKEND_DIR,
              stdio: 'pipe',
              timeout: 120_000,
            });
            return { ok: true };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, error: msg };
          }
        },

        /** Imprime en la consola de Cypress (útil para debug en tasks). */
        log(message: string) {
          console.log('[cy:task]', message);
          return null;
        },

        /**
         * Corre un cron job del backend de forma síncrona vía
         * `src/scripts/run-cron.js <jobName>` (mismo binario que QA/ops usan
         * en producción — no reimplementa la lógica del job).
         * Requiere que el backend corra con la MISMA base de datos que usa
         * el server de `npm start` (no un proceso aparte con su propio pool).
         */
        'cron:run'(jobName: string) {
          const ALLOWED_JOBS = [
            'overdueInstallments',
            'creditExpiry',
            'tokenCleanup',
            'weeklyCommissionCycle',
          ];
          if (!ALLOWED_JOBS.includes(jobName)) {
            return { ok: false, error: `Job no permitido: ${jobName}` };
          }
          try {
            const output = execSync(`node src/scripts/run-cron.js ${jobName}`, {
              cwd: BACKEND_DIR,
              stdio: 'pipe',
            }).toString();
            return { ok: true, output };
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            return { ok: false, error: msg };
          }
        },
      });

      return config;
    },
  },
});
