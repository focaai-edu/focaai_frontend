// Formatador numérico único da interface, no padrão pt-BR (#19, V14): vírgula
// decimal e ponto de milhar. Até uma casa decimal, sem zeros à direita.
const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatNumber(value) {
  return Number.isFinite(value) ? NUMBER.format(value) : '—';
}

export function formatPercent(value) {
  return Number.isFinite(value) ? `${NUMBER.format(value)}%` : '—';
}
