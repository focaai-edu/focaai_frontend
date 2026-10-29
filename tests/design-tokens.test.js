import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../src');
const CSS_PATH = path.resolve(SRC_DIR, 'index.css');

function getSourceFiles(dir, exts = ['.jsx', '.js']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.resolve(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getSourceFiles(fullPath, exts));
    } else if (exts.some(ext => file.endsWith(ext)) && !file.includes('.test.') && !file.includes('.spec.')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Design Tokens e Direção A (Foco Total) (#17 / V06, V16, F36)', () => {
  const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

  it('CA3: src/index.css define os tokens oficiais no @theme (primária, secundária, fundos e status)', () => {
    expect(cssContent).toMatch(/--color-primary:\s*#1B4F81/i);
    expect(cssContent).toMatch(/--color-secondary:\s*#4A90D9/i);
    expect(cssContent).toMatch(/--color-bg-dark:\s*#0F172A/i);
    expect(cssContent).toMatch(/--color-bg-light:\s*#F1F5F9/i);
    expect(cssContent).toMatch(/--color-surface-dark:\s*#1E293B/i);
    expect(cssContent).toMatch(/--color-border-dark:\s*#334155/i);
    expect(cssContent).toMatch(/--color-attentive:\s*#22C55E/i);
    expect(cssContent).toMatch(/--color-distracted:\s*#4A90D9/i);
    expect(cssContent).toMatch(/--color-no-camera:\s*#F59E0B/i);
    expect(cssContent).toMatch(/--color-disconnected:\s*#9CA3AF/i);
    expect(cssContent).toMatch(/Inter/i);
  });

  it('CA1 e CA5: nenhum componente renderiza canvas de partículas ou constelações em src/', () => {
    const files = getSourceFiles(SRC_DIR);
    for (const file of files) {
      if (file.endsWith('CameraPreview.jsx')) continue; // Webcam usa canvas para espelho e HUD
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/<ParticleField/);
      expect(content).not.toMatch(/<canvas[^>]*className=["'][^"']*particle/i);
    }
  });

  it('CA2 e CA5: nenhum arquivo em src/ utiliza gradientes radiais cósmicos ou sombras volumosas (0 24px 60px)', () => {
    const files = getSourceFiles(SRC_DIR);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/radial-gradient/i);
      expect(content).not.toMatch(/0\s+24px\s+60px/i);
      expect(content).not.toMatch(/backdrop-blur-(?:2xl|xl|md)/);
    }
  });

  it('CA4: componentes e páginas não possuem classes hex literais arbitrárias (ex: bg-[#1B4F81], text-[#4A90D9])', () => {
    const files = getSourceFiles(SRC_DIR);
    const hexClassRegex = /(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g;
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const matches = content.match(hexClassRegex);
      if (matches) {
        violations.push({ file: path.relative(SRC_DIR, file), matches });
      }
    }

    expect(violations).toEqual([]);
  });
});
