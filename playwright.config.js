// e2e da detecção de atenção com câmera falsa (#11). Rode com `npm run test:e2e`.
// Precisa de rede (o MediaPipe vem do CDN) e de um backend do main:
//   E2E_BACKEND_DIR  pasta do backend (padrão ../backend)
//   E2E_PYTHON       Python com as dependências do backend (padrão python3)
//   E2E_DATABASE_URL banco de TESTE, nome terminado em _test (padrão: TEST_DATABASE_URL de
//                    ../backend/.env com o banco trocado para foca_ai_e2e_test)
//   E2E_CHROMIUM     opcional: executável do Chromium (senão, o do Playwright)
//   E2E_FRONT_PORT   porta do Vite do e2e (padrão 5190; o backend usa 5100)
import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import { e2eDatabaseUrl } from './e2e/env.js';

const BACKEND_PORT = 5100;
const FRONT_PORT = Number(process.env.E2E_FRONT_PORT || 5190);
const backendDir = resolve(process.env.E2E_BACKEND_DIR || '../backend');
const python = process.env.E2E_PYTHON || 'python3';
// Mesma conexão do TEST_DATABASE_URL do backend/.env, só com o banco foca_ai_e2e_test (#40).
const databaseUrl = e2eDatabaseUrl(process.env, resolve('../backend/.env'));
const prepareDb = resolve('e2e/prepare_db.py');

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.js',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${FRONT_PORT}`,
    headless: true,
    launchOptions: process.env.E2E_CHROMIUM ? { executablePath: process.env.E2E_CHROMIUM } : {},
  },
  webServer: [
    {
      // Backend do main numa porta própria, sem Groq e com o banco de teste.
      command: `"${python}" "${prepareDb}" && exec "${python}" run.py`,
      cwd: backendDir,
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      env: { PORT: String(BACKEND_PORT), DATABASE_URL: databaseUrl, GROQ_API_KEY: '', FLASK_DEBUG: '0' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --port ${FRONT_PORT} --strictPort`,
      url: `http://localhost:${FRONT_PORT}`,
      env: { VITE_API_URL: `http://localhost:${BACKEND_PORT}`, VITE_SOCKET_URL: `http://localhost:${BACKEND_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
