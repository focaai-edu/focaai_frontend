import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';
import AttentionTimeline from '../../components/AttentionTimeline';
import { useAuth } from '../../context/AuthContext';

export default function StudentClassReview() {
  const { id } = useParams();
  const classId = parseInt(id, 10);
  const { user } = useAuth();

  const [cls, setCls]             = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [sidePanel, setSidePanel] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    async function load() {
      try {
        const [classRes, reportRes] = await Promise.all([
          api.get(`/api/classes/${classId}`),
          api.get(`/api/classes/${classId}/report/${user.id}`),
        ]);
        if (!cancelled) {
          setCls(classRes.data.class);
          setStudentData(reportRes.data.student_data || null);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [classId, user?.id]);

  // Distraction events from the report already include summary text — no
  // extra request needed. Adapt shape so AttentionTimeline receives it.
  const events = (studentData?.distraction_events || []).map((evt, i) => ({
    id: i,
    status: 'distracted',
    started_at: evt.started_at,
    ended_at: evt.ended_at,
    duration_seconds: evt.duration_seconds,
    monitoring_mode: evt.monitoring_mode,
    summary: evt.summary,
  }));

  const handleDistractionClick = useCallback((event) => {
    setSidePanel(event);
  }, []);

  const totalDuration = cls
    ? Math.round(((cls.ended_at ? new Date(cls.ended_at) - new Date(cls.started_at) : 0) / 1000) / 60)
    : 45;

  const handleDownload = () => {
    if (!studentData) return;
    const lines = [
      `Resumo da Aula: ${cls?.title || classId}`,
      `Atenção: ${studentData.attention_percentage}%`,
      `Tempo atento: ${studentData.time_attentive_minutes} min`,
      `Tempo desatento: ${studentData.time_distracted_minutes} min`,
      '',
      '--- Momentos de Desatenção ---',
      ...events.map((e, i) =>
        `\n[${i + 1}] ${e.started_at ? new Date(e.started_at).toLocaleTimeString('pt-BR') : '?'} → ${e.ended_at ? new Date(e.ended_at).toLocaleTimeString('pt-BR') : '?'}\n${e.summary || 'Sem resumo disponível.'}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resumo-aula-${classId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Layout role="student"><p className="text-gray-500 dark:text-[#64748B]">Carregando revisão...</p></Layout>;
  }

  const cardBase = "rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155]";

  return (
    <Layout role="student">
      <div className="mb-6">
        <h1 className="text-2xl font-bold m-0 mb-1 text-gray-900 dark:text-[#F1F5F9]">{cls?.title || 'Revisão da Aula'}</h1>
        <p className="text-sm text-gray-500 dark:text-[#64748B] m-0">Duração: {totalDuration} minutos</p>
      </div>

      {!studentData ? (
        <div className={`py-12 text-center ${cardBase}`}>
          <p className="text-gray-500 dark:text-[#64748B] text-sm">
            Você não participou desta aula ou os dados ainda não estão disponíveis.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 mb-8">
            <div className={`p-5 ${cardBase} text-center`}>
              <p className="text-2xl font-bold m-0 text-green-500">{studentData.time_attentive_minutes}m</p>
              <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Tempo atento</p>
            </div>
            <div className={`p-5 ${cardBase} text-center`}>
              <p className="text-2xl font-bold m-0 text-[#4A90D9]">{studentData.time_distracted_minutes}m</p>
              <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Tempo desatento</p>
            </div>
            <div className={`p-5 ${cardBase} text-center`}>
              <p className={`text-2xl font-bold m-0 ${studentData.attention_percentage >= 70 ? 'text-green-500' : studentData.attention_percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                {studentData.attention_percentage}%
              </p>
              <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Atenção</p>
            </div>
            {studentData.time_no_camera_minutes > 0 && (
              <div className={`p-5 ${cardBase} text-center`}>
                <p className="text-2xl font-bold m-0 text-amber-500">{studentData.time_no_camera_minutes}m</p>
                <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Sem câmera</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className={`p-5 ${cardBase} mb-8`}>
            <h2 className="text-base font-semibold mb-4 text-gray-900 dark:text-[#F1F5F9]">Linha do Tempo de Atenção</h2>
            {events.length > 0 ? (
              <AttentionTimeline
                events={events}
                totalDurationMinutes={totalDuration}
                onPeriodClick={handleDistractionClick}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-[#64748B] text-center py-8">
                Nenhum evento de desatenção registrado. Parabéns!
              </p>
            )}
          </div>

          {/* Distraction events list */}
          {events.length > 0 && (
            <div className={`${cardBase} overflow-hidden mb-8`}>
              <h2 className="text-base font-semibold p-4 border-b border-gray-200 dark:border-[#334155] m-0 text-gray-900 dark:text-[#F1F5F9]">
                Resumos dos Momentos Perdidos ({events.length})
              </h2>
              <div className="divide-y divide-gray-200 dark:divide-[#334155]">
                {events.map((evt, i) => (
                  <div
                    key={i}
                    onClick={() => handleDistractionClick(evt)}
                    className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-[#0F172A]/50 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-mono text-gray-500 dark:text-[#64748B]">
                        {evt.started_at ? new Date(evt.started_at).toLocaleTimeString('pt-BR') : '?'}
                        {' → '}
                        {evt.ended_at ? new Date(evt.ended_at).toLocaleTimeString('pt-BR') : '?'}
                      </span>
                      <span className="text-xs text-[#4A90D9] font-semibold">
                        {Math.round(evt.duration_seconds / 60)} min
                      </span>
                    </div>
                    {evt.summary ? (
                      <p className="text-sm text-gray-700 dark:text-[#CBD5E1] m-0 line-clamp-2">{evt.summary}</p>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-[#475569] m-0 italic">Sem resumo disponível.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 rounded-lg bg-[#4A90D9] text-white font-semibold text-sm hover:bg-[#3A7BC8] transition-colors"
            >
              Baixar Resumo Completo
            </button>
          </div>
        </>
      )}

      {/* Side Panel */}
      {sidePanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[999]" onClick={() => setSidePanel(null)} />
          <div className="fixed top-0 right-0 w-[400px] h-full bg-white dark:bg-[#1E293B] border-l border-gray-200 dark:border-[#334155] shadow-[-4px_0_20px_rgba(0,0,0,0.2)] z-[1000] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-[#334155] flex justify-between items-center">
              <h3 className="text-base font-semibold m-0 text-gray-900 dark:text-[#F1F5F9]">
                {sidePanel.started_at ? new Date(sidePanel.started_at).toLocaleTimeString('pt-BR') : ''}
                {' — '}
                {sidePanel.ended_at ? new Date(sidePanel.ended_at).toLocaleTimeString('pt-BR') : ''}
              </h3>
              <button
                onClick={() => setSidePanel(null)}
                className="bg-transparent border-none text-xl text-gray-500 dark:text-[#64748B] cursor-pointer hover:text-gray-900 dark:hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {sidePanel.summary ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-900 dark:text-[#F1F5F9]">{sidePanel.summary}</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-[#475569] italic">
                  Não há conteúdo registrado para esse período.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-[#64748B] mt-2 italic">Este conteúdo foi gerado por IA.</p>
              <button
                onClick={() => {
                  const blob = new Blob([`Resumo:\n${sidePanel.summary || ''}`], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `resumo-aula-${classId}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full mt-4 py-2 rounded-lg bg-[#4A90D9] text-white text-sm font-semibold hover:bg-[#3A7BC8] transition-colors"
              >
                Baixar este resumo
              </button>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
