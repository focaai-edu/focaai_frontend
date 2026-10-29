import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../services/socket';
import AttentionMonitor from '../../components/AttentionMonitor';
import OpenTooLongNotice from '../../components/OpenTooLongNotice';
import { useElapsed } from '../../hooks/useElapsed';
import { formatDuration } from '../../lib/duration';

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
  // Presença do professor (RN25): false = ele caiu e a aula segue sem áudio (#9).
  const [teacherAway, setTeacherAway] = useState(false);
  const [mode, setMode] = useState('full_attention');
  const [loading, setLoading] = useState(true);
  const [summaryNotice, setSummaryNotice] = useState(false);
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
    const join = () => socket.emit('join_class', { class_id: classId });
    // O `class_ended` pode ter se perdido durante a queda: confere a aula e, se
    // ela não está mais ao vivo, vai para a revisão (desmontar para câmera e detector) (F07).
    const checkStillLive = async () => {
      try {
        const res = await api.get(`/api/classes/${classId}`);
        if (res.data.class.status !== 'live') navigate(`/student/classes/${classId}/review`);
      } catch { /* sem resposta: continua na tela e tenta de novo na próxima reconexão */ }
    };
    // Ao (re)conectar, entra de novo na sala (RF10); o status é reemitido pelo useAttention.
    const onConnect = () => {
      join();
      checkStillLive();
    };
    socket.on('connect', onConnect);
    // `error` ao reentrar (ex.: "Aula nao esta ao vivo"): mesma consulta (F07).
    socket.on('error', checkStillLive);
    if (socket.connected) join();
    else socket.connect();

    socket.on('class_state', (data) => {
      setCls(prev => prev || data.class);
      setMode(data.class.monitoring_mode);
      // Ao entrar ou reconectar, já recebe a ausência persistida (RN26).
      if (data.teacher_presence) setTeacherAway(data.teacher_presence.connected === false);
    });
    socket.on('teacher_presence', (data) => {
      if (data.class_id === classId) setTeacherAway(data.connected === false);
    });
    socket.on('monitoring_mode_changed', (data) => setMode(data.mode));
    socket.on('class_ended', () => navigate(`/student/classes/${classId}/review`));
    // Resumo de um trecho perdido salvo (RN21): só o do próprio aluno (#5, RF13).
    let noticeTimer = null;
    const onSummaryReady = (data) => {
      if (data.class_id !== classId || data.student_id !== user?.id) return;
      setSummaryNotice(true);
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => setSummaryNotice(false), 8000);
    };
    socket.on('summary_ready', onSummaryReady);
    socket.on('new_transcription', (data) => {
      if (data.class_id === classId) {
        setTranscriptions(prev => [...prev, { content: data.content, timestamp: data.timestamp }]);
      }
    });

    return () => {
      socket.emit('leave_class', { class_id: classId });
      socket.off('class_state'); socket.off('monitoring_mode_changed');
      socket.off('class_ended');
      socket.off('summary_ready', onSummaryReady);
      clearTimeout(noticeTimer);
      socket.off('new_transcription');
      socket.off('teacher_presence');
      socket.off('connect', onConnect);
      socket.off('error', checkStillLive);
    };
  }, [classId, navigate, user?.id]);

  const elapsed = useElapsed(cls?.started_at);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptions]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-[#0F172A] text-white text-sm">Carregando aula...</div>;
  }
  if (!cls) return null;

  return (
    <div className="h-screen bg-[#0F172A] text-[#F1F5F9] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-4 md:px-6 py-3 bg-[#1B4F81] flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold m-0">{cls.title}</h1>
          <span className="text-xs opacity-80">{formatDuration(elapsed)} · {MODE_LABELS[mode] || mode}</span>
        </div>
        <button
          onClick={() => { socket.emit('leave_class', { class_id: classId }); navigate('/student/dashboard'); }}
          className="px-4 py-1.5 rounded border border-white/30 bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
        >
          Sair
        </button>
      </header>

      <OpenTooLongNotice elapsedSeconds={elapsed} />

      {teacherAway && (
        <div role="status" className="flex-shrink-0 px-4 md:px-6 py-2 bg-[#334155] text-[#F1F5F9] text-center text-sm font-medium">
          Professor desconectado
        </div>
      )}

      {/* Aviso de resumo pronto (RF13) */}
      {summaryNotice && (
        <div role="status" className="flex-shrink-0 px-4 md:px-6 py-3 bg-[#4A90D9] text-white text-center text-sm font-medium motion-safe:animate-pulse">
          Você perdeu um trecho da aula — o resumo já está disponível na revisão.
        </div>
      )}

      {/* Main two-column layout — responsive stacking on mobile */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
        {/* Left: Camera + Attention Monitor */}
        <div className="w-full md:flex-1 flex flex-col items-center justify-center p-4 md:p-6 gap-3 overflow-y-visible md:overflow-y-auto flex-shrink-0 md:flex-shrink">
          <AttentionMonitor
            classId={classId}
            studentId={user.id}
            monitoringMode={mode}
          />
        </div>

        {/* Right: Transcription — full width on mobile, fixed width on desktop */}
        <div className="w-full md:w-[300px] flex flex-col border-t md:border-t-0 md:border-l border-[#1E293B] bg-[#1E293B] min-h-[300px] md:min-h-0">
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
