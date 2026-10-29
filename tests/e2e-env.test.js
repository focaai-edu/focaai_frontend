// @vitest-environment node
// #40: ambiente do e2e — URL do banco derivada do .env do backend e checagem do Chromium.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { e2eDatabaseUrl, readDotenv, assertChromium, DEFAULT_E2E_DATABASE_URL } from '../e2e/env.js';

const dotenvWith = (content) => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-env-'));
  writeFileSync(join(dir, '.env'), content);
  return join(dir, '.env');
};

describe('e2eDatabaseUrl (#40 CA1/CA2)', () => {
  it.each([
    ["TEST_DATABASE_URL='postgresql://ana:s3gr3do@db.local:6543/foca_ai_test'"],
    ['TEST_DATABASE_URL="postgresql://ana:s3gr3do@db.local:6543/foca_ai_test"'],
    ['TEST_DATABASE_URL=postgresql://ana:s3gr3do@db.local:6543/foca_ai_test'],
  ])('CA1: deriva de %s trocando só o banco', (line) => {
    const env = dotenvWith(`DATABASE_URL=postgresql://x@y/foca_ai\n${line}\nGROQ_API_KEY=abc\n`);
    expect(e2eDatabaseUrl({}, env)).toBe('postgresql://ana:s3gr3do@db.local:6543/foca_ai_e2e_test');
  });

  it('CA2: E2E_DATABASE_URL explícita tem prioridade', () => {
    const env = dotenvWith('TEST_DATABASE_URL=postgresql://ana:x@h/foca_ai_test\n');
    expect(e2eDatabaseUrl({ E2E_DATABASE_URL: 'postgresql://b@c/outro_test' }, env)).toBe('postgresql://b@c/outro_test');
  });

  it('CA2 (erro): sem .env ou sem TEST_DATABASE_URL, cai no padrão', () => {
    expect(e2eDatabaseUrl({}, '/nao/existe/.env')).toBe(DEFAULT_E2E_DATABASE_URL);
    expect(e2eDatabaseUrl({}, dotenvWith('DATABASE_URL=postgresql://x@y/z\n'))).toBe(DEFAULT_E2E_DATABASE_URL);
    expect(DEFAULT_E2E_DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/foca_ai_e2e_test');
  });

  it('readDotenv ignora comentários e linhas vazias', () => {
    expect(readDotenv(dotenvWith('# c\n\nA=1\nB = "dois"\n'))).toEqual({ A: '1', B: 'dois' });
  });
});

describe('assertChromium (#40 CA3)', () => {
  it('erro com a instrução quando o executável não existe', () => {
    expect(() => assertChromium('/nao/existe/chrome')).toThrow(
      'Chromium do Playwright não encontrado em /nao/existe/chrome. Rode `npx playwright install chromium` ou defina E2E_CHROMIUM.',
    );
  });
  it('passa quando o executável existe', () => {
    expect(() => assertChromium(process.execPath)).not.toThrow();
  });
});
