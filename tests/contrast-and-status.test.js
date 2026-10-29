import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  hexToRgb,
  getLuminance,
  getContrastRatio,
  THEME_COLORS,
  STATUS_COLORS,
  getAttentionColor,
  CHART_COLORS,
} from '../src/lib/colors';

const SRC_DIR = path.resolve(__dirname, '../src');
const CSS_PATH = path.resolve(SRC_DIR, 'index.css');

describe('Contraste WCAG AA e semântica de cores de status (#15 / V07, V08, V22, F35, F38)', () => {
  const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');

  it('CA1 (V07, F38): --color-text-muted-dark em index.css atinge contraste WCAG AA >= 4.5:1 no modo escuro', () => {
    expect(cssContent).toMatch(/--color-text-muted-dark:\s*#94A3B8/i);
    // #94A3B8 (slate-400) sobre fundo #0F172A
    const ratioBg = getContrastRatio(THEME_COLORS.textMutedDark, THEME_COLORS.bgDark);
    expect(ratioBg).toBeGreaterThanOrEqual(4.5);

    // #94A3B8 sobre superfície #1E293B
    const ratioSurface = getContrastRatio(THEME_COLORS.textMutedDark, THEME_COLORS.surfaceDark);
    expect(ratioSurface).toBeGreaterThanOrEqual(4.5);
  });

  it('CA2 (V07, F38): inputs de login e registro utilizam placeholder com contraste >= 4.5:1', () => {
    const loginContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/Login.jsx'), 'utf-8');
    const registerContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/Register.jsx'), 'utf-8');

    // Deve usar placeholder-slate-400 (ou text-slate-400), nunca placeholder-slate-500
    expect(loginContent).not.toMatch(/placeholder-slate-500/);
    expect(registerContent).not.toMatch(/placeholder-slate-500/);
    expect(loginContent).toMatch(/placeholder-slate-400/);
    expect(registerContent).toMatch(/placeholder-slate-400/);

    // #94A3B8 (slate-400) sobre #1E293B (slate-800)
    const ratio = getContrastRatio('#94A3B8', '#1E293B');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('CA3 (V22): banner LGPD em ClassReport.jsx utiliza dark:text-blue-300 com contraste > 5.5:1 sobre a superfície escura', () => {
    const reportContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/teacher/ClassReport.jsx'), 'utf-8');
    expect(reportContent).toMatch(/dark:text-blue-300/);
    expect(reportContent).not.toMatch(/text-xs text-primary dark:text-secondary m-0/);

    // #93C5FD (blue-300) sobre #1E293B (surfaceDark)
    const ratio = getContrastRatio('#93C5FD', THEME_COLORS.surfaceDark);
    expect(ratio).toBeGreaterThan(5.5);
  });

  it('CA4 (V08, F35): status "Desatento" passa para Âmbar #F59E0B em index.css e colors.js (desvinculando o azul #4A90D9)', () => {
    expect(cssContent).toMatch(/--color-distracted:\s*#F59E0B/i);
    expect(STATUS_COLORS.distracted).toBe('#F59E0B');

    // Nenhuma ocorrência de azul #4A90D9 atribuída a distração
    expect(STATUS_COLORS.distracted).not.toBe('#4A90D9');
  });

  it('CA5 (V08, F35): paleta semântica unificada de status segue estritamente a especificação', () => {
    expect(STATUS_COLORS.attentive).toBe('#22C55E'); // Verde
    expect(STATUS_COLORS.distracted).toBe('#F59E0B'); // Âmbar
    expect(STATUS_COLORS.no_camera).toBe('#94A3B8'); // Cinza
    expect(STATUS_COLORS.break).toBe('#94A3B8'); // Cinza
    expect(STATUS_COLORS.absent).toBe('#EF4444'); // Vermelho
    expect(STATUS_COLORS.disconnected).toBe('#EF4444'); // Vermelho

    // Função de faixa percentual de atenção
    expect(getAttentionColor(85)).toBe('#22C55E');
    expect(getAttentionColor(70)).toBe('#22C55E');
    expect(getAttentionColor(65)).toBe('#F59E0B');
    expect(getAttentionColor(40)).toBe('#F59E0B');
    expect(getAttentionColor(35)).toBe('#EF4444');
    expect(getAttentionColor(0)).toBe('#EF4444');
  });

  it('Fonte única JS: ClassReport, RoomCamera e RoomCameraTest consomem cores de src/lib/colors.js', () => {
    const reportContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/teacher/ClassReport.jsx'), 'utf-8');
    const roomCameraContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/room/RoomCamera.jsx'), 'utf-8');
    const roomTestContent = fs.readFileSync(path.resolve(SRC_DIR, 'pages/room/RoomCameraTest.jsx'), 'utf-8');

    // ClassReport importa getAttentionColor e CHART_COLORS
    expect(reportContent).toMatch(/from ['"]\.\.\/\.\.\/lib\/colors['"]/);
    expect(reportContent).not.toMatch(/const attColor =/);

    // RoomCamera importa STATUS_COLORS
    expect(roomCameraContent).toMatch(/from ['"]\.\.\/\.\.\/lib\/colors['"]/);
    expect(roomCameraContent).not.toMatch(/const color = dist \? '#F59E0B' : '#22C55E'/);

    // RoomCameraTest importa STATUS_COLORS
    expect(roomTestContent).toMatch(/from ['"]\.\.\/\.\.\/lib\/colors['"]/);
    expect(roomTestContent).not.toMatch(/const color = status === 'distracted' \? '#F59E0B' : '#22C55E'/);
  });

  it('CA6 (V07, borda): contraste de elementos gráficos de status atinge >= 3:1 sobre superfície escura', () => {
    for (const [status, hex] of Object.entries(STATUS_COLORS)) {
      const ratio = getContrastRatio(hex, THEME_COLORS.bgDark);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    }
  });
});
