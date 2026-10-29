// @vitest-environment node
// Garante que o `npm run lint` analisa .jsx, conhece o navegador e pega erros de hooks (#2).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

async function lint(code, filePath = 'src/__fixture__.jsx') {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => ({ rule: m.ruleId, severity: m.severity }));
}

describe('eslint.config.mjs', () => {
  it('analisa .jsx com JSX e globals do navegador sem erro', async () => {
    const code = `export default function A() {
  const w = window.innerWidth + navigator.language.length + localStorage.length;
  return <div>{w}</div>;
}
`;
    expect(await lint(code)).toEqual([]);
  });

  it('import usado só no JSX não conta como variável sem uso', async () => {
    const code = `import Box from './Box';
export default function A() {
  return <Box />;
}
`;
    expect(await lint(code)).toEqual([]);
  });

  it('acusa variável não declarada num .jsx (no-undef como erro)', async () => {
    const msgs = await lint('export default function A() { return <div>{naoExiste}</div>; }\n');
    expect(msgs).toContainEqual({ rule: 'no-undef', severity: 2 });
  });

  it('acusa dependência faltando no useEffect (exhaustive-deps como warning)', async () => {
    const code = `import { useEffect } from 'react';
export default function A({ id }) {
  useEffect(() => { console.log(id); }, []);
  return null;
}
`;
    expect(await lint(code)).toContainEqual({ rule: 'react-hooks/exhaustive-deps', severity: 1 });
  });

  it('acusa hook chamado condicionalmente (rules-of-hooks como erro)', async () => {
    const code = `import { useState } from 'react';
export default function A({ on }) {
  if (on) useState(0);
  return null;
}
`;
    expect(await lint(code)).toContainEqual({ rule: 'react-hooks/rules-of-hooks', severity: 2 });
  });

  it('todo pacote importado pela config está em devDependencies', () => {
    const root = new URL('..', import.meta.url);
    const config = readFileSync(new URL('eslint.config.mjs', root), 'utf8');
    const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
    const imported = [...config.matchAll(/from\s+'([^'.][^']*)'/g)].map((m) => m[1]);
    expect(imported.length).toBeGreaterThan(0);
    for (const name of imported) expect(Object.keys(pkg.devDependencies)).toContain(name);
  });
});
