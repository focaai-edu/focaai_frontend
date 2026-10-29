import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import api from '../../services/api';
import socket from '../../services/socket';
import StudentGrid from '../../components/StudentGrid';
import OpenTooLongNotice from '../../components/OpenTooLongNotice';
import { useElapsed } from '../../hooks/useElapsed';
import { useLiveClassExitGuard } from '../../hooks/useLiveClassExitGuard';
import { formatDuration } from '../../lib/duration';

export default function TeacherClassLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transcriptions, setTranscriptions] = useState([]);
  const [micActive, setMicActive] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const bottomRef = useRef(null);
  const micActiveRef = useRef(false);

  const classId = parseInt(id, 10);

  // Os dados carregam antes de a aula ser conhecida; o guard só vale com ela ao vivo.
  const [isLive, setIsLive] = useState(false);
  const { allowLeave, dialog: leaveDialog } = useLiveClassExitGuard({ classId, active: isLive });

  const modes = [
    { key: 'full_attention', label: 'Atenção Total' },
    { key: 'activity', label: 'Atividade' },
    { key: 'exam', label: 'Prova' },
    { key: 'break', label: 'Intervalo' },
  ];

  // ---- Audio capture ----
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      micActiveRef.current = true;

      const startChunk = () => {
        if (!micActiveRef.current || !streamRef.current) return;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (e) => {
          // Each stop() call produces a *complete* WebM file with its own header.
          // Sending it whole avoids the "incomplete chunk" error from Groq Whisper.
          if (e.data.size > 500 && socket.connected) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              if (base64) {
                socket.emit('audio_chunk', { class_id: classId, audio: base64 });
              }
            };
            reader.readAsDataURL(e.data);
          }
        };

        // When this recorder stops, start a new one (unless mic was turned off).
        recorder.onstop = () => startChunk();
        recorder.onerror = (e) => console.error('[audio] recorder error:', e);

        recorder.start();
        mediaRecorderRef.current = recorder;

        // Stop after 5 s — triggers ondataavailable with a complete WebM file.
        setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, 5000);
      };

      startChunk();
      setMicActive(true);
    } catch {
      setError('Não foi possível acessar o microfone. A aula continua, mas sem transcrição.');
    }
  }, [classId]);

  const stopMic = useCallback(() => {
    micActiveRef.current = false;
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null; // prevent auto-restart
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setMicActive(false);
  }, []);

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

  // ---- Start/stop mic with class lifecycle ----
  useEffect(() => {
    if (!cls) return;
    if (cls.status === 'live') {
      startMic();
    }
    return () => stopMic();
  }, [cls?.status, startMic, stopMic]);

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
    stopMic();
    allowLeave();
    navigate(`/teacher/classes/${classId}/report`);
  }, [classId, navigate, stopMic, allowLeave]);

  const isBreak = cls?.monitoring_mode === 'break';

  if (loading) return <div className="p-8 text-gray-500">Carregando...</div>;
  if (!cls) return null;

  return (
    <div className="min-h-screen bg-[#F1F5F9] dark:bg-[#0F172A] flex flex-col">
      {/* Header */}
      <header className="px-8 py-4 bg-[#1B4F81] text-white flex justify-between items-center flex-wrap gap-3">
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
          </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
          <span className="text-sm font-semibold">AO VIVO</span>
          <button onClick={endClass} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
            Encerrar Aula
          </button>
        </div>
      </header>

      <OpenTooLongNotice elapsedSeconds={elapsed} />

      {/* Mode Selector */}
      <div className="px-8 py-3 bg-white dark:bg-[#1E293B] border-b border-gray-200 dark:border-[#334155] flex gap-2 overflow-x-auto">
        {modes.map(m => (
          <button
            key={m.key}
            onClick={() => changeMode(m.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap border-none cursor-pointer transition-colors ${
              cls.monitoring_mode === m.key
                ? 'bg-[#4A90D9] text-white'
                : 'bg-[#F1F5F9] dark:bg-[#334155] text-gray-900 dark:text-[#F1F5F9] hover:bg-gray-200 dark:hover:bg-[#475569]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-8 py-3 bg-red-50 text-red-600 text-sm border-b border-red-100">{error}</div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-[7] p-6 overflow-y-auto">
          <StudentGrid students={students} monitoringMode={cls.monitoring_mode} />
        </div>
        <div className="flex-[3] p-6 border-l border-gray-200 dark:border-[#334155] bg-white dark:bg-[#1E293B] overflow-y-auto">
          <h3 className="text-base font-semibold mb-4 text-gray-900 dark:text-[#F1F5F9] flex items-center gap-2">
            Transcrição
            {isBreak && (
              <span className="text-xs font-normal text-gray-400 dark:text-[#64748B]">(pausada no intervalo)</span>
            )}
          </h3>

          {transcriptions.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-[#64748B] text-sm py-8">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              {micActive ? 'Aguardando fala...' : 'Microfone indisponível.'}
            </div>
          ) : (
            <div className="text-sm leading-relaxed">
              {transcriptions.map((entry, i) => (
                <div key={i} className={`mb-3 pb-3 ${i < transcriptions.length - 1 ? 'border-b border-gray-200 dark:border-[#334155]' : ''}`}>
                  <span className="text-xs text-gray-400 dark:text-[#64748B] block mb-1">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('pt-BR') : ''}
                  </span>
                  <p className="m-0 text-gray-900 dark:text-[#F1F5F9]">{entry.content}</p>
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
