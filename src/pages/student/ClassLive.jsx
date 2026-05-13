import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../services/socket';
import AttentionMonitor from '../../components/AttentionMonitor';

const MODE_LABELS = {
  full_attention: 'Atenção Total',
  activity: 'Atividade',
  exam: 'Prova',
  break: 'Intervalo',
};

export default function StudentClassLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cls, setCls] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState('full_attention');
  const [loading, setLoading] = useState(true);
  const [showDistraction, setShowDistraction] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const bottomRef = useRef(null);

  const classId = parseInt(id, 10);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/api/classes/${classId}`);
        if (!cancelled) {
          if (res.data.class.status !== 'live') { navigate('/student/dashboard'); return; }
          setCls(res.data.class);
          setMode(res.data.class.monitoring_mode);
        }
      } catch { if (!cancelled) navigate('/student/dashboard'); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [classId, navigate]);

  useEffect(() => {
    if (!socket.connected) socket.connect();
    socket.emit('join_class', { class_id: classId });

    socket.on('class_state', (data) => {
      setCls(prev => prev || data.class);
      setMode(data.class.monitoring_mode);
    });
    socket.on('monitoring_mode_changed', (data) => setMode(data.mode));
    socket.on('class_ended', () => navigate(`/student/classes/${classId}/review`));
    socket.on('attention_alert', (data) => {
      if (data.status === 'distracted' && data.duration_seconds > 30) {
        setShowDistraction(true);
        setTimeout(() => setShowDistraction(false), 5000);
      }
    });
    socket.on('new_transcription', (data) => {
      if (data.class_id === classId) {
        setTranscriptions(prev => [...prev, { content: data.content, timestamp: data.timestamp }]);
      }
    });

    return () => {
      socket.emit('leave_class', { class_id: classId });
      socket.off('class_state'); socket.off('monitoring_mode_changed');
      socket.off('class_ended'); socket.off('attention_alert');
      socket.off('new_transcription');
    };
  }, [classId, navigate]);

  useEffect(() => {
    if (!cls?.started_at) return;
    const started = new Date(cls.started_at).getTime();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [cls?.started_at]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptions]);

  const formatTime = (secs) => {
    const t = Math.max(0, secs);
    const m = Math.floor(t / 60), s = t % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0F172A] text-white text-sm">Carregando aula...</div>;
  }
  if (!cls) return null;

  return (
    <div className="h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 bg-[#1B4F81] flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold m-0">{cls.title}</h1>
          <span className="text-xs opacity-80">{formatTime(elapsed)} · {MODE_LABELS[mode] || mode}</span>
        </div>
        <button
          onClick={() => { socket.emit('leave_class', { class_id: classId }); navigate('/student/dashboard'); }}
          className="px-4 py-1.5 rounded border border-white/30 bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
        >
          Sair
        </button>
      </header>

      {/* Distraction notice */}
      {showDistraction && (
        <div className="flex-shrink-0 px-6 py-3 bg-[#4A90D9] text-white text-center text-sm font-medium">
          Ei, parece que você se distraiu. A aula continua sendo salva para você.
        </div>
      )}

      {/* Main two-column layout — min-h-0 lets flex children respect overflow */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Camera + Attention Monitor */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 overflow-y-auto">
          <AttentionMonitor
            classId={classId}
            studentId={user.id}
            monitoringMode={mode}
          />
        </div>

        {/* Right: Transcription — fixed width, scrolls independently */}
        <div className="w-[300px] flex flex-col border-l border-[#1E293B] bg-[#1E293B]">
          <h3 className="flex-shrink-0 text-sm font-semibold px-5 pt-5 pb-3 text-white border-b border-[#334155]">
            Transcrição ao vivo
          </h3>
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {transcriptions.length === 0 ? (
              <div className="text-center text-[#64748B] text-sm py-8">
                <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Aguardando transcrição...
              </div>
            ) : (
              <div className="text-sm leading-relaxed">
                {transcriptions.map((entry, i) => (
                  <div key={i} className={`mb-3 pb-3 ${i < transcriptions.length - 1 ? 'border-b border-[#334155]' : ''}`}>
                    <span className="text-xs text-[#64748B] block mb-1">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('pt-BR') : ''}
                    </span>
                    <p className="m-0 text-[#F1F5F9]">{entry.content}</p>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
