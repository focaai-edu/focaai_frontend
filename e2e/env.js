// Ambiente do e2e (#40): URL do banco de teste e checagem do Chromium.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_E2E_DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/foca_ai_e2e_test';
const E2E_DB = 'foca_ai_e2e_test';

// .env simples: CHAVE=valor, com ou sem aspas; ignora comentários e linhas vazias.
export function readDotenv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2').replace(/['"]$/, '');
  }
  return out;
}

// E2E_DATABASE_URL > TEST_DATABASE_URL do backend/.env com o banco trocado > padrão.
export function e2eDatabaseUrl(env, backendDotenvPath) {
  if (env.E2E_DATABASE_URL) return env.E2E_DATABASE_URL;
  const testUrl = readDotenv(backendDotenvPath).TEST_DATABASE_URL;
  if (!testUrl) return DEFAULT_E2E_DATABASE_URL;
  return testUrl.replace(/\/[^/?]*(\?.*)?$/, (_, query = '') => `/${E2E_DB}${query}`);
}

export function assertChromium(path) {
  if (!path || !existsSync(path)) {
    throw new Error(`Chromium do Playwright não encontrado em ${path}. Rode \`npx playwright install chromium\` ou defina E2E_CHROMIUM.`);
  }
}

// Mesma regra, lendo o .env da pasta do backend escolhida (E2E_BACKEND_DIR).
export function e2eDatabaseUrlFor(env, backendDir) {
  return e2eDatabaseUrl(env, join(backendDir, '.env'));
}
