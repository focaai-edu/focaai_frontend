import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import api from '../../services/api';
import socket from '../../services/socket';
import StudentGrid from '../../components/StudentGrid';
import OpenTooLongNotice from '../../components/OpenTooLongNotice';
import { useElapsed } from '../../hooks/useElapsed';
import { useLiveClassExitGuard } from '../../hooks/useLiveClassExitGuard';
import { useAudioChunks } from '../../hooks/useAudioChunks';
import { formatDuration } from '../../lib/duration';
import { MODE_LABELS } from '../../lib/labels';

export default function TeacherClassLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transcriptions, setTranscriptions] = useState([]);

  const bottomRef = useRef(null);

  const classId = parseInt(id, 10);

  // Os dados carregam antes de a aula ser conhecida; o guard só vale com ela ao vivo.
  const [isLive, setIsLive] = useState(false);
  const { allowLeave, dialog: leaveDialog } = useLiveClassExitGuard({ classId, active: isLive });

  const modes = Object.entries(MODE_LABELS).map(([key, label]) => ({ key, label }));

  // ---- Data loading ----
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/api/classes/${classId}`);
        if (!cancelled) {
          setCls(res.data.class);
          if (res.data.class.status !== 'live') navigate('/teacher/dashboard');
          else setIsLive(true);
        }
      } catch {
        if (!cancelled) navigate('/teacher/dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [classId, navigate]);

  // ---- Socket events ----
  useEffect(() => {
    const join = () => socket.emit('join_class', { class_id: classId });
    // Ao (re)conectar, entra de novo na sala para seguir recebendo transcrição e presença (F08).
    socket.on('connect', join);
    if (socket.connected) join();
    else socket.connect();

    const setStudentStatus = (studentId, status) =>
      setStudents(prev => prev.map(s => (s.student_id === studentId ? { ...s, status } : s)));
    socket.on('student_joined', (data) => {
      setStudents(prev => {
        if (prev.find(s => s.student_id === data.student_id)) {
          return prev.map(s => (s.student_id === data.student_id ? { ...s, status: 'connected' } : s));
        }
        return [...prev, { student_id: data.student_id, student_name: data.student_name, status: 'connected' }];
      });
    });
    // O card fica na grade, marcado como fora da aula (#9, F18).
    socket.on('student_left', (data) => setStudentStatus(data.student_id, 'disconnected'));
    // Status de atenção confirmado de cada aluno (RN13).
    socket.on('attention_status', (data) => setStudentStatus(data.student_id, data.status));
    socket.on('monitoring_mode_changed', (data) => {
      setCls(prev => prev ? { ...prev, monitoring_mode: data.mode } : prev);
    });
    socket.on('class_ended', () => {
      allowLeave();
      navigate(`/teacher/classes/${classId}/report`);
    });

    socket.on('new_transcription', (data) => {
      if (data.class_id === classId) {
        setTranscriptions(prev => [...prev, { content: data.content, timestamp: data.timestamp }]);
      }
    });

    return () => {
      socket.emit('leave_class', { class_id: classId });
      socket.off('student_joined'); socket.off('student_left'); socket.off('attention_status');
      socket.off('monitoring_mode_changed'); socket.off('class_ended');
      socket.off('new_transcription');
      socket.off('connect', join);
    };
  }, [classId, navigate, allowLeave]);

  // ---- Áudio: grava com a aula ao vivo, sem depender da câmera da sala (RF14) ----
  const audio = useAudioChunks(classId, { enabled: cls?.status === 'live' });
  const micActive = audio.status === 'recording';
  const stopAudio = audio.stop;

  const elapsed = useElapsed(cls?.started_at);

  // ---- Auto-scroll transcriptions ----
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcriptions]);

  const changeMode = useCallback((mode) => {
    // Optimistic update so the button highlights immediately
    setCls(prev => prev ? { ...prev, monitoring_mode: mode } : prev);
    socket.emit('change_monitoring_mode', { class_id: classId, mode });
  }, [classId]);

  // O microfone só para depois de o servidor confirmar o fim; se o PATCH
  // falhar, a aula segue ao vivo e a gravação continua (#9, F13).
  const endClass = useCallback(async () => {
    setError('');
    try {
      await api.patch(`/api/classes/${classId}/end`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao encerrar aula.');
      return;
    }
    // Finaliza e envia o trecho em curso antes de liberar o microfone (#4, F10).
    stopAudio();
    allowLeave();
    navigate(`/teacher/classes/${classId}/report`);
  }, [classId, navigate, stopAudio, allowLeave]);

  const isBreak = cls?.monitoring_mode === 'break';

  if (loading) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (!cls) return null;

  return (
    <div className="h-screen bg-bg-light dark:bg-bg-dark flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-4 md:px-8 py-3 md:py-4 bg-primary text-white flex justify-between items-center flex-wrap gap-2 md:gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/teacher/dashboard')}
            className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
          >
            ← Painel
          </button>
          <div>
          <h1 className="text-xl font-semibold m-0 mb-0.5">{cls.title}</h1>
          <div className="flex items-center gap-3 text-xs opacity-80">
            <span>{formatDuration(elapsed)}</span>
            {micActive && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Gravando
              </span>
            )}
            {audio.status === 'offline' && (
              <span role="status" className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                Sem conexão — o áudio não está sendo enviado
              </span>
            )}
          </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="text-sm font-semibold">AO VIVO</span>
          <button onClick={endClass} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
            Encerrar Aula
          </button>
        </div>
      </header>

      <OpenTooLongNotice elapsedSeconds={elapsed} />

      {/* Mode Selector */}
      <div className="flex-shrink-0 px-4 md:px-8 py-2.5 md:py-3 bg-white dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex gap-2 overflow-x-auto flex-nowrap scrollbar-none">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => changeMode(m.key)}
            className={`px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap flex-shrink-0 border-none cursor-pointer transition-colors ${
              cls.monitoring_mode === m.key
                ? 'bg-secondary text-white'
                : 'bg-bg-light dark:bg-slate-700 text-gray-900 dark:text-text-primary-dark hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {audio.status === 'error' && (
        <div className="px-4 md:px-8 py-3 bg-red-50 text-red-600 text-sm border-b border-red-100 dark:bg-danger/10 dark:text-red-300 dark:border-danger/30">
          Não foi possível acessar o microfone. A aula continua, mas sem transcrição.
        </div>
      )}
      {error && (
        <div className="px-4 md:px-8 py-3 bg-red-50 text-red-600 text-sm border-b border-red-100 dark:bg-danger/10 dark:text-red-300 dark:border-danger/30">{error}</div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0">
        <div className="w-full md:flex-[7] p-4 md:p-6 overflow-y-visible md:overflow-y-auto">
          <StudentGrid students={students} monitoringMode={cls.monitoring_mode} />
        </div>
        <div className="w-full md:flex-[3] p-4 md:p-6 border-t md:border-t-0 md:border-l border-border-light dark:border-border-dark bg-white dark:bg-surface-dark overflow-y-visible md:overflow-y-auto min-h-[250px] md:min-h-0">
          <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-text-primary-dark flex items-center gap-2">
            Transcrição
            {isBreak && (
              <span className="text-xs font-normal text-gray-400 dark:text-text-muted-dark">(pausada no intervalo)</span>
            )}
          </h3>

          {transcriptions.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-text-muted-dark text-sm py-8">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {micActive ? 'Aguardando fala...' : 'Microfone indisponível.'}
            </div>
          ) : (
            <div className="text-sm leading-relaxed">
              {transcriptions.map((entry, i) => (
                <div key={i} className={`mb-3 pb-3 ${i < transcriptions.length - 1 ? 'border-b border-border-light dark:border-border-dark' : ''}`}>
                  <span className="text-xs text-gray-400 dark:text-text-muted-dark block mb-1">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('pt-BR') : ''}
                  </span>
                  <p className="m-0 text-gray-900 dark:text-text-primary-dark">{entry.content}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
      {leaveDialog}
    </div>
  );
}
