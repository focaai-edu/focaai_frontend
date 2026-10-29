import { STATUS_LABELS } from '../lib/labels';

const STATUS_COLORS = {
  attentive: 'var(--color-attentive)',
  distracted: 'var(--color-distracted)',
  no_camera: 'var(--color-no-camera)',
  disconnected: 'var(--color-disconnected)',
};

export default function AttentionIndicator({ status = 'disconnected', showLabel = true, size = 12 }) {
  const key = STATUS_COLORS[status] ? status : 'disconnected';
  const color = STATUS_COLORS[key];
  const label = STATUS_LABELS[key] || 'Desconectado';

  return (
    <div className="inline-flex items-center gap-1.5 opacity-90" title={label}>
      <span
        className="rounded-full flex-shrink-0 transition-colors duration-200"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
        }}
      />
      {showLabel && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
