import { STATUS_LABELS } from '../lib/labels';

const STATUS_COLORS = {
  attentive: '#22C55E',
  distracted: '#4A90D9',
  no_camera: '#F59E0B',
  disconnected: '#9CA3AF',
};

export default function AttentionIndicator({ status = 'disconnected', showLabel = true, size = 12 }) {
  const key = STATUS_COLORS[status] ? status : 'disconnected';
  const config = { color: STATUS_COLORS[key], label: STATUS_LABELS[key] };

  return (
    <div className="inline-flex items-center gap-1.5 opacity-90" title={config.label}>
      <span
        className="rounded-full flex-shrink-0 transition-colors duration-300"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: config.color,
          boxShadow: status === 'attentive' ? `0 0 6px ${config.color}` : 'none',
        }}
      />
      {showLabel && (
        <span className="text-xs font-medium" style={{ color: config.color }}>
          {config.label}
        </span>
      )}
    </div>
  );
}
