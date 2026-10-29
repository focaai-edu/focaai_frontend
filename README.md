# foca.ai — frontend

React 19 + Vite 7 + Tailwind 4. Regras de negócio em [`docs/SPEC.md`](docs/SPEC.md).

## Rodar

```bash
npm ci
npm run dev          # http://localhost:5173 (API/socket em VITE_API_URL / VITE_SOCKET_URL, padrão :5000)
```

## Verificações

```bash
npm run lint         # eslint src/ public/
npm test             # Vitest (unidade e integração, sem rede)
npm run build
```

## e2e da detecção de atenção (`npm run test:e2e`)

Playwright com câmera falsa (`.y4m`) e o MediaPipe real. Fica fora do `npm test`.

**Pré-requisitos**
- **Rede**: o worker carrega o `@mediapipe/tasks-vision` 0.10.18 e o modelo de um CDN.
- **Postgres local**: o e2e usa um banco próprio, `foca_ai_e2e_test`, criado se faltar. O nome precisa terminar em `_test`; o banco de desenvolvimento nunca é usado.
- **Backend do `main`** e um **Python com as dependências dele** (o venv do backend).
- **Chromium do Playwright**: `npx playwright install chromium`. Se faltar, o `globalSetup` falha com essa instrução. Também dá para apontar um executável existente com `E2E_CHROMIUM`.

**Variáveis**

| Variável | Padrão | Uso |
|---|---|---|
| `E2E_BACKEND_DIR` | `../backend` | pasta do backend (de preferência um checkout limpo do `main`) |
| `E2E_PYTHON` | `python3` | Python com as dependências do backend |
| `E2E_DATABASE_URL` | `TEST_DATABASE_URL` do `.env` em `E2E_BACKEND_DIR`, só com o banco trocado para `foca_ai_e2e_test` (aspas aceitas); se essa pasta não tiver `.env` (ex.: um worktree limpo), defina `E2E_DATABASE_URL`; sem nenhum dos dois, `postgresql://postgres:postgres@localhost:5432/foca_ai_e2e_test` | banco do e2e |
| `E2E_CHROMIUM` | o do Playwright | executável do Chromium |
| `E2E_FRONT_PORT` | `5190` | Vite do e2e (o backend do e2e usa a **5100**) |

```bash
E2E_PYTHON=../backend/.venv/bin/python npm run test:e2e
```

Os clipes são gerados em `e2e/.cache/` a partir de `e2e/fixtures/` (ver o README de lá). Os cenários com movimento real ficam em skip até chegarem os clipes gravados (#11).
