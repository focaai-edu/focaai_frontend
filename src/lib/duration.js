// Formatador único da duração de uma aula ao vivo (card do dashboard e cabeçalho
// das telas ao vivo, #9): "menos de 1 min", "12 min", "1 h 05 min", "26 h 10 min".

// Acima disso, a tela avisa que a aula está aberta há mais de 24 horas.
export const OVER_24H_SECONDS = 24 * 3600;

export function formatDuration(totalSeconds) {
  const secs = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  if (secs < 60) return 'menos de 1 min';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}
