import { describe, it, expect } from 'vitest';
import { formatNumber, formatPercent } from './numberFormat';

describe('formatador numérico pt-BR (#19 CA3, V14)', () => {
  it.each([[93.3, '93,3%'], [84.44, '84,4%'], [57.9, '57,9%'], [100, '100%'], [0, '0%'], [12.05, '12,1%']])('%s → %s', (v, txt) => {
    expect(formatPercent(v)).toBe(txt);
  });
  it('números com vírgula e milhar com ponto', () => {
    expect(formatNumber(20.5)).toBe('20,5');
    expect(formatNumber(1234.5)).toBe('1.234,5');
    expect(formatNumber(3)).toBe('3');
  });
  it('valor ausente vira "—"', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });
});
