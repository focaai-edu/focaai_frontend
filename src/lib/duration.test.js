import { describe, it, expect } from 'vitest';
import { formatDuration, OVER_24H_SECONDS } from './duration';

describe('formatDuration (#9 CA8/CA14)', () => {
  it.each([
    [0, 'menos de 1 min'],
    [59, 'menos de 1 min'],
    [60, '1 min'],
    [12 * 60 + 30, '12 min'],
    [59 * 60 + 59, '59 min'],
    [3600, '1 h 00 min'],
    [3600 + 5 * 60, '1 h 05 min'],
    [2 * 3600 + 15 * 60, '2 h 15 min'],
    [26 * 3600 + 10 * 60, '26 h 10 min'],
    [3380 * 3600 + 29 * 60, '3380 h 29 min'],
  ])('%i s → "%s"', (secs, text) => {
    expect(formatDuration(secs)).toBe(text);
  });

  it('valores negativos ou inválidos (relógio adiantado) viram "menos de 1 min"', () => {
    expect(formatDuration(-30)).toBe('menos de 1 min');
    expect(formatDuration(NaN)).toBe('menos de 1 min');
  });

  it('o limite do aviso de aula aberta é 24 h', () => {
    expect(OVER_24H_SECONDS).toBe(24 * 3600);
  });
});
