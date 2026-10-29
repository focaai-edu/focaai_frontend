import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';
import AttentionTimeline from '../../components/AttentionTimeline';
import TranscriptPanel from '../../components/TranscriptPanel';
import { useAuth } from '../../context/AuthContext';
import LoadError from '../../components/LoadError';
import Dialog from '../../components/Dialog';
import SummaryText, { summaryPreview } from '../../components/SummaryText';
import { useSummaryRefresh } from '../../hooks/useSummaryRefresh';
import { isLoadFailure } from '../../lib/loadError';
import { formatSeconds } from '../../lib/duration';
import { formatNumber, formatPercent } from '../../lib/numberFormat';

export default function StudentClassReview() {
  const { id } = useParams();
  const classId = parseInt(id, 10);
  const { user } = useAuth();

  const [cls, setCls]             = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [attentionEvents, setAttentionEvents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [sidePanel, setSidePanel] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // Carga completa; também usada na recarga dos resumos (CA5) e no "Tentar de novo".
  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [classRes, reportRes, eventsRes] = await Promise.all([
        api.get(`/api/classes/${classId}`),
        api.get(`/api/classes/${classId}/report/${user.id}`),
        api.get(`/api/classes/${classId}/attention-events`),
      ]);
      setCls(classRes.data.class);
      setStudentData(reportRes.data.student_data || null);
      setAttentionEvents(eventsRes.data.events || []);
      setLoadFailed(false);
    } catch (err) {
      // 4xx (não participou) segue no estado vazio; rede/5xx é erro (F33).
      if (isLoadFailure(err)) setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [classId, user?.id]);

  useEffect(() => { load(); }, [load]);

  // Lista de distrações (com resumo) — alimenta a lista de resumos e o download.
  const events = (studentData?.distraction_events || []).map((evt, i) => ({
    id: i,
    status: 'distracted',
    started_at: evt.started_at,
    ended_at: evt.ended_at,
    duration_seconds: evt.duration_seconds,
    monitoring_mode: evt.monitoring_mode,
    summary: evt.summary,
  }));

  // Resumo que ainda pode chegar: recarrega a cada 5 s até 60 s depois do fim (CA4/CA5).
  const { generating } = useSummaryRefresh({
    endedAt: cls?.ended_at,
    missing: events.some((e) => !e.summary),
    reload: load,
  });
  const noSummaryText = generating ? 'Gerando resumo…' : 'Resumo não disponível para este trecho.';

  // Timeline REAL: sequência completa de eventos do aluno (atento, distraído,
  // sem câmera...) com os status verdadeiros — não só as distrações. Anexa o
  // resumo aos segmentos de distração para que o clique abra o painel lateral,
  // casando pelo attention_event_id (o mesmo do summary_ready; backend#3, #40).
  const distractions = studentData?.distraction_events || [];
  const findDistraction = (e) => distractions.find((d) => d.attention_event_id === e.id);
  const timelineEvents = attentionEvents.map((e, i) => {
    const match = e.status === 'distracted' ? findDistraction(e) : null;
    return {
      id: e.id ?? i,
      status: e.status,
      started_at: e.started_at,
      ended_at: e.ended_at,
      duration_seconds: match?.duration_seconds,
      monitoring_mode: e.monitoring_mode,
      summary: match?.summary,
    };
  });

  const handleDistractionClick = useCallback((event) => {
    setSidePanel(event);
  }, []);

  const totalDuration = cls?.started_at && cls?.ended_at
    ? Math.round((new Date(cls.ended_at) - new Date(cls.started_at)) / 60000)
    : 0;

  const handleDownload = () => {
    if (!studentData) return;
    const lines = [
      `Resumo da Aula: ${cls?.title || classId}`,
      `Atenção: ${formatPercent(studentData.attention_percentage)}`,
      `Tempo atento: ${formatNumber(studentData.time_attentive_minutes)} min`,
      `Tempo desatento: ${formatNumber(studentData.time_distracted_minutes)} min`,
      '',
      '--- Momentos de Desatenção ---',
      ...events.map((e, i) =>
        `\n[${i + 1}] ${e.started_at ? new Date(e.started_at).toLocaleTimeString('pt-BR') : '?'} → ${e.ended_at ? new Date(e.ended_at).toLocaleTimeString('pt-BR') : '?'}\n${e.summary || noSummaryText}`
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
    return <Layout role="student"><p className="text-gray-500 dark:text-text-muted-dark">Carregando revisão...</p></Layout>;
  }

  const cardBase = "rounded-xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm";

  if (loadFailed) {
    return <Layout role="student"><LoadError onRetry={() => { setLoading(true); load(); }} /></Layout>;
  }

  return (
    <Layout role="student">
      <div className="mb-6">
        <h1 className="text-2xl font-bold m-0 mb-1 text-gray-900 dark:text-text-primary-dark">{cls?.title || 'Revisão da Aula'}</h1>
        <p className="text-sm text-gray-500 dark:text-text-muted-dark m-0">Duração: {totalDuration} minutos</p>
      </div>

      {!studentData ? (
        <div className={`py-12 text-center ${cardBase}`}>
          <p className="text-gray-500 dark:text-text-muted-dark text-sm">
            Você não participou desta aula ou os dados ainda não estão disponíveis.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4 mb-8">
            <div className={`p-5 ${cardBase} text-center`}>
              <p className="text-2xl font-bold m-0 text-green-500">{formatNumber(studentData.time_attentive_minutes)}m</p>
              <p className="text-xs text-gray-500 dark:text-text-muted-dark mt-1 m-0">Tempo atento</p>
            </div>
            <div className={`p-5 ${cardBase} text-center`}>
              <p className="text-2xl font-bold m-0 text-secondary">{formatNumber(studentData.time_distracted_minutes)}m</p>
              <p className="text-xs text-gray-500 dark:text-text-muted-dark mt-1 m-0">Tempo desatento</p>
            </div>
            <div className={`p-5 ${cardBase} text-center`}>
              <p className={`text-2xl font-bold m-0 ${studentData.attention_percentage >= 70 ? 'text-green-500' : studentData.attention_percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                {formatPercent(studentData.attention_percentage)}
              </p>
              <p className="text-xs text-gray-500 dark:text-text-muted-dark mt-1 m-0">Atenção</p>
            </div>
            {studentData.time_no_camera_minutes > 0 && (
              <div className={`p-5 ${cardBase} text-center`}>
                <p className="text-2xl font-bold m-0 text-amber-500">{formatNumber(studentData.time_no_camera_minutes)}m</p>
                <p className="text-xs text-gray-500 dark:text-text-muted-dark mt-1 m-0">Sem câmera</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className={`p-5 ${cardBase} mb-8`}>
            <h2 className="text-base font-semibold mb-4 text-gray-900 dark:text-text-primary-dark">Linha do Tempo de Atenção</h2>
            {timelineEvents.length > 0 ? (
              <AttentionTimeline
                events={timelineEvents}
                classStart={cls?.started_at}
                classEnd={cls?.ended_at}
                onPeriodClick={handleDistractionClick}
              />
            ) : (
              <p className="text-sm text-gray-500 dark:text-text-muted-dark text-center py-8">
                Nenhum dado de atenção registrado nesta aula.
              </p>
            )}
          </div>

          {/* Distraction events list */}
          {events.length > 0 && (
            <div className={`${cardBase} overflow-hidden mb-8`}>
              <h2 className="text-base font-semibold p-4 border-b border-border-light dark:border-border-dark m-0 text-gray-900 dark:text-text-primary-dark">
                Resumos dos Momentos Perdidos ({events.length})
              </h2>
              {/* Cada item é um botão: abre o resumo com clique, Enter ou Espaço (#16, V10). */}
              <ul data-distraction-list className="divide-y divide-border-light dark:divide-border-dark m-0 p-0 list-none">
                {events.map((evt, i) => (
                  <li key={i}>
                  <button
                    type="button"
                    onClick={() => handleDistractionClick(evt)}
                    className="w-full text-left block p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-bg-dark/50 transition-colors bg-transparent border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  >
                    <span className="flex justify-between items-center mb-1">
                      <span className="text-xs font-mono text-gray-500 dark:text-text-muted-dark">
                        {evt.started_at ? new Date(evt.started_at).toLocaleTimeString('pt-BR') : '?'}
                        {' → '}
                        {evt.ended_at ? new Date(evt.ended_at).toLocaleTimeString('pt-BR') : '?'}
                      </span>
                      <span className="text-xs text-secondary font-semibold">
                        {formatSeconds(evt.duration_seconds)}
                      </span>
                    </span>
                    {evt.summary ? (
                      <span className="block text-sm text-gray-700 dark:text-slate-300 m-0 line-clamp-2">{summaryPreview(evt.summary)}</span>
                    ) : (
                      <span className="block text-sm text-gray-400 dark:text-slate-500 m-0 italic">{noSummaryText}</span>
                    )}
                  </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcrição completa da aula */}
          <TranscriptPanel classId={classId} />

          <div className="text-center">
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 rounded-lg bg-secondary text-white font-semibold text-sm hover:bg-secondary/90 transition-colors shadow-sm"
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
          <Dialog titleId="summary-panel-title" onClose={() => setSidePanel(null)} className="fixed top-0 right-0 w-[400px] h-full bg-white dark:bg-surface-dark border-l border-border-light dark:border-border-dark shadow-md z-[1000] flex flex-col">
            <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center">
              <h3 id="summary-panel-title" className="text-base font-semibold m-0 text-gray-900 dark:text-text-primary-dark">
                <span className="sr-only">Resumo de </span>
                {sidePanel.started_at ? new Date(sidePanel.started_at).toLocaleTimeString('pt-BR') : ''}
                {' — '}
                {sidePanel.ended_at ? new Date(sidePanel.ended_at).toLocaleTimeString('pt-BR') : ''}
              </h3>
              <button
                type="button"
                aria-label="Fechar resumo"
                onClick={() => setSidePanel(null)}
                className="bg-transparent border-none text-xl text-gray-500 dark:text-text-muted-dark cursor-pointer hover:text-gray-900 dark:hover:text-white"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {sidePanel.summary ? (
                <SummaryText text={sidePanel.summary} className="text-sm leading-relaxed text-gray-900 dark:text-text-primary-dark" />
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500 italic">{noSummaryText}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-text-muted-dark mt-2 italic">Este conteúdo foi gerado por IA.</p>
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
                className="w-full mt-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-secondary/90 transition-colors shadow-sm"
              >
                Baixar este resumo
              </button>
            </div>
          </Dialog>
        </>
      )}
    </Layout>
  );
}
