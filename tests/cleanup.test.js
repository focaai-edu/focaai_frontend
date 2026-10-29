// @vitest-environment node
// #35: código e dependências mortas fora, rótulos numa fonte só, worker sem limiares e lintado.
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const sources = (dir) => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return sources(p);
  return /\.(js|jsx|css)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [p] : [];
});
const srcFiles = () => sources(join(root, 'src'));
const grepSrc = (re) => srcFiles().filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.replace(root, ''));

describe('limpeza (#35)', () => {
  it('CA1: arquivos sem uso removidos e sem imports para eles', () => {
    for (const f of ['src/components/TranscriptionFeed.jsx', 'src/hooks/useReducedMotion.js', 'src/lib/faceDetection.js']) {
      expect(existsSync(join(root, f))).toBe(false);
    }
    expect(grepSrc(/TranscriptionFeed|useReducedMotion|faceDetection/)).toEqual([]);
  });

  it('CA2: useCamera sem useRoomCrop/canvasRef; useAttention sem earValue/poseValues/currentStatus no retorno', () => {
    const camera = read('src/hooks/useCamera.js');
    expect(camera).not.toMatch(/useRoomCrop|canvasRef/);
    const attention = read('src/hooks/useAttention.js');
    expect(attention).not.toMatch(/earValue|poseValues|setEarValue|setPoseValues|currentStatus: /);
  });

  it('CA3: a regra .card, .sidebar saiu do CSS global', () => {
    expect(read('src/index.css')).not.toMatch(/\.card\s*,\s*\.sidebar/);
  });

  it('CA4: date-fns e @mediapipe/tasks-vision fora do package.json; nada em src importa o MediaPipe', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).not.toHaveProperty('date-fns');
    expect(deps).not.toHaveProperty('@mediapipe/tasks-vision');
    expect(grepSrc(/@mediapipe\/tasks-vision|date-fns/)).toEqual([]);
    // A versão do CDN fica num lugar só no worker.
    const worker = read('public/attention-worker.js');
    expect(worker.match(/tasks-vision@0\.10\.18/g)).toHaveLength(1);
  });

  it('CA5: rótulos de modo e status vêm de lib/labels.js; sem cópias divergentes', () => {
    expect(grepSrc(/'Atenção Total'|'Distraído'/)).toEqual([]);
    const defs = grepSrc(/full_attention:\s*'Atenção/);
    expect(defs).toEqual(['src/lib/labels.js']);
    expect(grepSrc(/distracted:\s*'Desatento'|distracted:\s*\{[^}]*label:/)).toEqual(['src/lib/labels.js']);
  });

  it('CA6: o worker não tem limiares próprios nem set_thresholds (RF03 só em attentionAlgo.js)', () => {
    const worker = read('public/attention-worker.js');
    expect(worker).not.toMatch(/thresholds|set_thresholds|full_attention/);
  });

  it('CA7: npm run lint inclui o worker, e ele passa sem erros', async () => {
    expect(JSON.parse(read('package.json')).scripts.lint).toMatch(/public\//);
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintFiles(['public/attention-worker.js']);
    expect(result.messages.filter((m) => m.severity === 2)).toEqual([]);
    // O worker é um script clássico de Web Worker: self/importScripts conhecidos.
    const [fixture] = await eslint.lintText('self.postMessage(1); try { self.close(); } catch {}\n', { filePath: 'public/fixture.js' });
    expect(fixture.messages.map((m) => m.ruleId)).toContain('no-empty');
    expect(fixture.messages.map((m) => m.ruleId)).not.toContain('no-undef');
  });
});
