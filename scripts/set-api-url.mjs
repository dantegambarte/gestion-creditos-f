/**
 * Inyecta la URL del backend en environment.ts en tiempo de build, para no versionar
 * la URL de producción en el repositorio público.
 * Lee API_BASE_URL (la usa el script de deploy al VPS); si falta, deja environment.ts como está.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../src/environments/environment.ts', import.meta.url);
const url = process.env.API_BASE_URL?.trim();

if (!url) {
  console.log('API_BASE_URL not set; keeping environment.ts as is.');
  process.exit(0);
}

if (!/^https?:\/\/\S+$/.test(url)) {
  console.error('API_BASE_URL must be an http(s) URL.');
  process.exit(1);
}

const source = readFileSync(file, 'utf8');
const pattern = /apiBaseUrl:\s*'[^']*'/;
if (!pattern.test(source)) {
  console.error('apiBaseUrl not found in environment.ts.');
  process.exit(1);
}
writeFileSync(file, source.replace(pattern, `apiBaseUrl: '${url.replace(/'/g, '')}'`));
console.log('apiBaseUrl injected from API_BASE_URL.');
