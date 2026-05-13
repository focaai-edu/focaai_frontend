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

export default function AttentionTimeline({ events = [], totalDurationMinutes = 45, onPeriodClick }) {
  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">Sem dados de atenção disponíveis.</div>
    );
  }

  const totalSeconds = totalDurationMinutes * 60;

  return (
    <div>
      <div className="flex h-8 rounded-lg overflow-hidden border border-gray-200 mb-3">
        {events.map((event, i) => {
          const startSec = (new Date(event.started_at).getTime() - new Date(events[0].started_at).getTime()) / 1000;
          const endSec = event.ended_at
            ? (new Date(event.ended_at).getTime() - new Date(events[0].started_at).getTime()) / 1000
            : startSec + 30;
          const widthPct = ((endSec - startSec) / totalSeconds) * 100;

          return (
            <div
              key={i}
              title={`${STATUS_LABELS[event.status]}: ${Math.round((endSec - startSec) / 60)} min`}
              onClick={() => event.status === 'distracted' && onPeriodClick?.(event)}
              className="h-full transition-opacity hover:opacity-80"
              style={{
                width: `${Math.max(widthPct, 0.5)}%`,
                backgroundColor: STATUS_COLORS[event.status] || '#9CA3AF',
                cursor: event.status === 'distracted' ? 'pointer' : 'default',
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
