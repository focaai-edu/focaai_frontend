import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';
import AttentionTimeline from '../../components/AttentionTimeline';

export default function StudentClassReview() {
  const { id } = useParams();
  const classId = parseInt(id, 10);
  const [cls, setCls] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidePanel, setSidePanel] = useState(null);
  const [stats] = useState({ timeAttentive: 0, timeDistracted: 0, timeNoCamera: 0, attentionPct: 0 });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const classRes = await api.get(`/api/classes/${classId}`);
        if (!cancelled) { setCls(classRes.data.class); setEvents([]); }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [classId]);

  const handleDistractionClick = useCallback(async (event) => {
    try {
      const res = await api.get(`/api/attention-events/${event.id}/summaries`);
      const summaryData = res.data?.summaries?.[0] || res.data?.summary;
      setSidePanel({ event, summary: summaryData?.summary_text || summaryData?.summary || 'Resumo não disponível.', start: event.started_at, end: event.ended_at });
    } catch {
      setSidePanel({ event, summary: 'Resumo não disponível.', start: event.started_at, end: event.ended_at });
    }
  }, []);

  const totalDuration = cls
    ? Math.round(((cls.ended_at ? new Date(cls.ended_at) - new Date(cls.started_at) : 0) / 1000) / 60)
    : 45;

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

      {/* Stats */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 mb-8">
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-2xl font-bold m-0 text-green-500">{stats.timeAttentive}m</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Tempo atento</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-2xl font-bold m-0 text-[#4A90D9]">{stats.timeDistracted}m</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Tempo desatento</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-2xl font-bold m-0 text-amber-500">{stats.attentionPct}%</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Atenção</p>
        </div>
      </div>

      {/* Timeline */}
      <div className={`p-5 ${cardBase} mb-8`}>
        <h2 className="text-base font-semibold mb-4 text-gray-900 dark:text-[#F1F5F9]">Linha do Tempo de Atenção</h2>
        {events.length > 0 ? (
          <AttentionTimeline events={events} totalDurationMinutes={totalDuration} onPeriodClick={handleDistractionClick} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-[#64748B] text-center py-8">Dados de atenção serão exibidos após integração completa.</p>
        )}
      </div>

      <div className="text-center">
        <button
          onClick={() => {
            const blob = new Blob(['Resumo da aula disponível em breve.'], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `resumo-aula-${classId}.txt`;
            a.click(); URL.revokeObjectURL(url);
          }}
          className="px-6 py-2.5 rounded-lg bg-[#4A90D9] text-white font-semibold text-sm hover:bg-[#3A7BC8] transition-colors"
        >
          Baixar Resumo Completo
        </button>
      </div>

      {/* Side Panel */}
      {sidePanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[999]" onClick={() => setSidePanel(null)} />
          <div className="fixed top-0 right-0 w-[400px] h-full bg-white dark:bg-[#1E293B] border-l border-gray-200 dark:border-[#334155] shadow-[-4px_0_20px_rgba(0,0,0,0.2)] z-[1000] flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-[#334155] flex justify-between items-center">
              <h3 className="text-base font-semibold m-0 text-gray-900 dark:text-[#F1F5F9]">
                {sidePanel.start ? new Date(sidePanel.start).toLocaleTimeString('pt-BR') : ''}
                {' — '}
                {sidePanel.end ? new Date(sidePanel.end).toLocaleTimeString('pt-BR') : ''}
              </h3>
              <button onClick={() => setSidePanel(null)} className="bg-transparent border-none text-xl text-gray-500 dark:text-[#64748B] cursor-pointer hover:text-gray-900 dark:hover:text-white">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-900 dark:text-[#F1F5F9]">{sidePanel.summary}</p>
              <p className="text-xs text-gray-500 dark:text-[#64748B] mt-2 italic">Este conteúdo foi gerado por IA.</p>
              <button
                onClick={() => {
                  const blob = new Blob([`Resumo:\n${sidePanel.summary}`], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `resumo-aula-${classId}.txt`;
                  a.click(); URL.revokeObjectURL(url);
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
