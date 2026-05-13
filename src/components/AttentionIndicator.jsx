const STATUS_CONFIG = {
  attentive: { color: '#22C55E', label: 'Atento' },
  distracted: { color: '#4A90D9', label: 'Desatento' },
  no_camera: { color: '#F59E0B', label: 'Sem câmera' },
  disconnected: { color: '#9CA3AF', label: 'Desconectado' },
};

export default function AttentionIndicator({ status = 'disconnected', showLabel = true, size = 12 }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.disconnected;

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
