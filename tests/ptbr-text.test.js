// @vitest-environment node
// #19 CA6: textos da interface em pt-BR com acento (V12) — sem as grafias sem acento mais comuns.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return sources(p);
  return /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [p] : [];
});
// Palavras que, em mensagem ao usuário, precisam de acento.
const UNACCENTED = /\b(invalid[oa]s?|Permissao|nao|voce|sessao|conexao|possivel|usuario|numero|camera)\b/i;

describe('textos em pt-BR (#19 CA6)', () => {
  it('strings de interface não têm as grafias sem acento comuns', () => {
    const offenders = [];
    for (const f of sources(join(root, 'src'))) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // só literais de texto em setError/mensagens/JSX; ignora identificadores, imports e URLs.
        for (const [, txt] of line.matchAll(/'([^'\n]*[a-z][^'\n]* [^'\n]*)'/gi)) {
          if (UNACCENTED.test(txt) && !/\?\.|\|\||[()]/.test(txt)) offenders.push(`${f.replace(root, '')}:${i + 1}: ${txt}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
