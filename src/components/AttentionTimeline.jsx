import { formatSeconds } from '../lib/duration';

const STATUS_COLORS = {
  attentive: '#22C55E',
  distracted: '#4A90D9',
  no_camera: '#F59E0B',
  disconnected: '#EF4444',
  absent: '#1F2937',
  break: '#9CA3AF',
};

const STATUS_LABELS = {
  attentive: 'Atento',
  distracted: 'Distraído',
  no_camera: 'Sem câmera',
  disconnected: 'Fora',
  absent: 'Ausente',
  break: 'Intervalo',
};

/**
 * Segmentos da linha do tempo na escala real da aula (#5, F28): cada evento fica
 * na posição e com a largura do seu início e duração desde `classStart`; o que
 * não tem evento (o aluno saiu, ou ainda não tinha entrado) vira "Fora". Evento
 * aberto vai até `classEnd`. Aula de duração 0 não gera NaN/Infinity.
 * `left`/`width` são percentuais.
 */
export function buildSegments(events, classStart, classEnd) {
  const start = Date.parse(classStart);
  const end = Date.parse(classEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const total = end - start;
  const pct = (ms) => ((ms - start) / total) * 100;

  const sorted = [...events]
    .map((e) => ({
      event: e,
      from: Math.max(start, Date.parse(e.started_at)),
      to: Math.min(end, e.ended_at ? Date.parse(e.ended_at) : end),
    }))
    .filter((s) => Number.isFinite(s.from) && Number.isFinite(s.to) && s.to > s.from)
    .sort((a, b) => a.from - b.from);

  const segments = [];
  const gap = (from, to) => {
    if (to > from) segments.push({ status: 'disconnected', from, to, left: pct(from), width: pct(to) - pct(from) });
  };
  let cursor = start;
  for (const s of sorted) {
    gap(cursor, s.from);
    const from = Math.max(s.from, cursor);
    if (s.to > from) {
      segments.push({ status: s.event.status, event: s.event, from, to: s.to, left: pct(from), width: pct(s.to) - pct(from) });
      cursor = s.to;
    }
  }
  gap(cursor, end);
  return segments;
}

export default function AttentionTimeline({ events = [], classStart, classEnd, onPeriodClick }) {
  const segments = buildSegments(events, classStart, classEnd);
  if (segments.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">Sem dados de atenção disponíveis.</div>
    );
  }

  return (
    <div>
      <div className="relative h-8 rounded-lg overflow-hidden border border-gray-200 mb-3">
        {segments.map((seg, i) => {
          const clickable = seg.status === 'distracted' && Boolean(onPeriodClick);
          return (
            <div
              key={i}
              data-status={seg.status}
              title={`${STATUS_LABELS[seg.status] || seg.status}: ${formatSeconds((seg.to - seg.from) / 1000)}`}
              onClick={() => clickable && onPeriodClick(seg.event)}
              className="absolute top-0 h-full transition-opacity hover:opacity-80"
              style={{
                left: `${seg.left}%`,
                width: `${seg.width}%`,
                backgroundColor: STATUS_COLORS[seg.status] || '#9CA3AF',
                cursor: clickable ? 'pointer' : 'default',
              }}
            />
          );
        })}
      </div>

      <div className="flex gap-4 flex-wrap text-xs">
        {Object.entries(STATUS_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-gray-500">{STATUS_LABELS[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
