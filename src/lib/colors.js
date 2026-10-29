/**
 * Fonte única de cores e design tokens para consumo em JavaScript / Canvas / Recharts / SVG.
 * Espelha fielmente os tokens do @theme em src/index.css e as regras de acessibilidade WCAG AA (#15).
 */

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function getLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hex1, hex2) {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export const THEME_COLORS = {
  primary: '#1B4F81',
  primaryLight: '#4A90D9',
  secondary: '#4A90D9',
  bgDark: '#0F172A',
  bgLight: '#F1F5F9',
  surfaceDark: '#1E293B',
  surfaceLight: '#FFFFFF',
  surfaceCardDark: '#334155',
  borderDark: '#334155',
  borderLight: '#E2E8F0',
  textPrimaryDark: '#F1F5F9',
  textSecondaryDark: '#94A3B8',
  textMutedDark: '#94A3B8', // slate-400 (WCAG AA >= 4.5:1 sobre #0F172A e #1E293B)
  textPrimaryLight: '#0F172A',
  textSecondaryLight: '#475569',
  textMutedLight: '#64748B',
};

/**
 * Paleta semântica unificada de status de atenção (CA4, CA5 / V08, F35):
 * - attentive: Verde #22C55E
 * - distracted: Âmbar #F59E0B (fundo suave rgba(245, 158, 11, 0.15))
 * - no_camera: Cinza #94A3B8
 * - break: Cinza #94A3B8 (Intervalo)
 * - absent: Vermelho #EF4444 (Ausente)
 * - disconnected: Vermelho #EF4444 (Fora da aula)
 */
export const STATUS_COLORS = {
  attentive: '#22C55E',
  distracted: '#F59E0B',
  no_camera: '#94A3B8',
  break: '#94A3B8',
  absent: '#EF4444',
  disconnected: '#EF4444',
};

/**
 * Retorna a cor de atenção por faixa percentual (ClassReport, etc.):
 * >= 70%: verde (#22C55E)
 * >= 40%: âmbar (#F59E0B)
 * < 40%: vermelho (#EF4444)
 */
export const getAttentionColor = (pct) => {
  if (pct >= 70) return STATUS_COLORS.attentive;
  if (pct >= 40) return STATUS_COLORS.distracted;
  return STATUS_COLORS.absent;
};

/**
 * Cores para gráficos (Recharts, ClassReport):
 */
export const CHART_COLORS = {
  primary: THEME_COLORS.primary,
  secondary: THEME_COLORS.secondary,
  secondaryLight: '#7DB8F0',
  grid: THEME_COLORS.borderDark,
  axis: THEME_COLORS.textSecondaryDark,
  barLabel: THEME_COLORS.textSecondaryDark,
};
