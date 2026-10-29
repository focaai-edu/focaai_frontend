import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_KEY, initialTheme, applyTheme } from './theme';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const head = html.slice(0, html.indexOf('</head>'));
const inlineScript = head.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function prefersDark(dark) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark });
}

function runIndexScript() {
  new Function(inlineScript)();
}

describe('tema antes do primeiro render (#18 CA3, F37)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });
  afterEach(() => vi.restoreAllMocks());

  it('index.html tem um script inline no <head>, antes do bundle do React, com a mesma chave do localStorage', () => {
    expect(inlineScript).toBeTruthy();
    expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('src="/src/main.jsx"'));
    expect(inlineScript).toContain(`'${THEME_KEY}'`);
  });

  it('com "dark" gravado, o script põe a classe dark no <html> sem o React', () => {
    prefersDark(false);
    localStorage.setItem(THEME_KEY, 'dark');
    runIndexScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sem preferência gravada, segue o sistema operacional', () => {
    prefersDark(true);
    runIndexScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('o script e initialTheme() decidem igual em todas as combinações (inclusive valor inválido)', () => {
    for (const stored of [null, 'dark', 'light', 'roxo']) {
      for (const os of [true, false]) {
        localStorage.clear();
        if (stored) localStorage.setItem(THEME_KEY, stored);
        prefersDark(os);
        document.documentElement.classList.remove('dark');
        runIndexScript();
        const fromScript = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        expect(fromScript, `stored=${stored} os=${os}`).toBe(initialTheme());
      }
    }
  });

  it('erro: localStorage bloqueado não quebra o carregamento e cai na preferência do sistema', () => {
    prefersDark(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(() => runIndexScript()).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(initialTheme()).toBe('dark');
    expect(() => applyTheme('light')).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
