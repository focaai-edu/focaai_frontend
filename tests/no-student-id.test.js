// @vitest-environment node
// #24 CA2: o monitor e o hook de atenção não recebem nem repassam studentId.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return sources(p);
  return /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [p] : [];
});

describe('studentId fora do fluxo de atenção (#24 CA2)', () => {
  it('nenhum arquivo de src/hooks ou src/components menciona studentId', () => {
    const offenders = [...sources(join(root, 'src/hooks')), ...sources(join(root, 'src/components'))]
      .filter((f) => readFileSync(f, 'utf8').includes('studentId'));
    expect(offenders).toEqual([]);
  });

  it('a tela do aluno não passa user.id para o monitor', () => {
    expect(readFileSync(join(root, 'src/pages/student/ClassLive.jsx'), 'utf8')).not.toMatch(/studentId=/);
  });
});
