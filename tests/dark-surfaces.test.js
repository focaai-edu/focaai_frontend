// @vitest-environment node
// #18 CA4 (F37): nenhuma superfície clara fixa no modo escuro — estados vazios,
// carregando, banners e badges trazem a variante dark: junto.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return sources(p);
  return /\.jsx$/.test(name) && !/\.test\.jsx$/.test(name) ? [p] : [];
});

const LIGHT = '(?:white|surface-light|surface-card-light|bg-light|(?:gray|slate|zinc|neutral|red|amber|yellow|green|emerald|blue|sky)-(?:50|100|200))';
const lightBg = new RegExp(`(?<![\\w:-])bg-${LIGHT}(?![\\w/-])`);
const lightHover = new RegExp(`(?<![\\w-])hover:bg-${LIGHT}(?![\\w/-])`);

// /room é sempre escuro; as bolinhas brancas da legenda não são superfície.
const ALLOWED = [/^src\/pages\/room\/RoomCamera\.jsx: inline-block w-2\.5 h-2\.5 rounded-full bg-white$/];

function offenders() {
  const found = [];
  for (const file of sources(join(root, 'src'))) {
    const rel = file.replace(root, '');
    const strings = readFileSync(file, 'utf8').match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? [];
    for (const s of strings) {
      const cls = s.slice(1, -1);
      const bad = (lightBg.test(cls) && !/dark:bg-/.test(cls)) || (lightHover.test(cls) && !/dark:hover:bg-/.test(cls));
      const entry = `${rel}: ${cls}`;
      if (bad && !ALLOWED.some((re) => re.test(entry))) found.push(entry);
    }
  }
  return found;
}

describe('superfícies no modo escuro (#18)', () => {
  it('CA4: toda classe de fundo claro (fixo ou no hover) vem com a variante dark: correspondente', () => {
    expect(offenders()).toEqual([]);
  });

  it('o detector pega um banner claro sem dark: (controle do próprio teste)', () => {
    const cls = 'px-4 py-3 bg-red-50 text-red-600';
    expect(lightBg.test(cls) && !/dark:bg-/.test(cls)).toBe(true);
    expect(lightBg.test('bg-white/10')).toBe(false);
  });

  it('Health.jsx (sem rota desde a limpeza #35) saiu; ThemeToggle.jsx é o seletor da sidebar', () => {
    expect(existsSync(join(root, 'src/pages/Health.jsx'))).toBe(false);
    expect(readFileSync(join(root, 'src/components/Sidebar.jsx'), 'utf8')).toMatch(/<ThemeToggle\b/);
  });
});
