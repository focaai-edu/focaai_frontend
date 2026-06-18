import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, BarChart, Bar, Cell,
} from 'recharts';
import Layout from '../../components/Layout';
import TranscriptPanel from '../../components/TranscriptPanel';
import api from '../../services/api';

const MODE_PT = {
  full_attention: 'Atenção Total',
  activity: 'Atividade',
  exam: 'Prova',
  break: 'Intervalo',
};

// Cor de atenção por faixa de % (verde / âmbar / vermelho).
const attColor = (pct) => (pct >= 70 ? '#22C55E' : pct >= 40 ? '#F59E0B' : '#EF4444');

function ChartTooltip({ active, payload, label, suffix }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-[#0F172A] border border-[#334155] px-3 py-2 text-xs text-[#F1F5F9] shadow-lg">
      <p className="m-0 font-semibold">{label}{suffix}</p>
      <p className="m-0 text-[#7DB8F0]">{payload[0].value}% de atenção</p>
    </div>
  );
}

export default function TeacherClassReport() {
  const { id } = useParams();
  const classId = parseInt(id, 10);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedStudent, setExpandedStudent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/api/classes/${classId}/report`);
        if (!cancelled) setReport(res.data);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [classId]);

  if (loading) {
    return <Layout role="teacher"><p className="text-gray-500 dark:text-[#64748B]">Gerando relatório...</p></Layout>;
  }

  if (!report) {
    return (
      <Layout role="teacher">
        <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-[#F1F5F9]">Relatório da Aula</h1>
        <div className="py-12 text-center bg-white dark:bg-[#1E293B] rounded-xl border border-gray-200 dark:border-[#334155]">
          <p className="text-gray-500 dark:text-[#64748B] text-sm">Relatório ainda não disponível. A aula precisa ser encerrada primeiro.</p>
        </div>
      </Layout>
    );
  }

  const { overview, students, title, duration_minutes } = report;
  const cardBase = "rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155]";

  // Dados para a timeline (descarta minutos sem ninguém presente).
  const timeline = (report.attention_timeline || []).filter(p => p.attention_pct !== null);

  // Marcadores de troca de modo (ignora o primeiro modo, que começa em 0).
  const modeMarkers = report.started_at
    ? (overview.monitoring_modes_used || []).slice(1).map(m => ({
        minute: Math.round((new Date(m.started_at) - new Date(report.started_at)) / 60000),
        label: MODE_PT[m.mode] || m.mode,
      })).filter(m => m.minute > 0)
    : [];

  // Ranking de alunos por atenção (maior -> menor) para o gráfico de barras.
  const ranking = [...students]
    .map(s => ({
      name: (s.student_name || `Aluno #${s.student_id}`).split(' ')[0],
      pct: s.attention_percentage,
    }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <Layout role="teacher">
      <div className="mb-6">
        <h1 className="text-2xl font-bold m-0 mb-1 text-gray-900 dark:text-[#F1F5F9]">{title || 'Relatório da Aula'}</h1>
        <p className="text-sm text-gray-500 dark:text-[#64748B] m-0">Duração: {duration_minutes} minutos</p>
      </div>

      {/* Overview Cards — métricas de atenção/valor (sem censo de alunos, LGPD) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 mb-4">
        <div className={`p-5 ${cardBase} text-center`}>
          <p className={`text-3xl font-bold m-0 ${overview.average_attention_percentage >= 70 ? 'text-green-500' : overview.average_attention_percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
            {overview.average_attention_percentage}%
          </p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Atenção média</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-3xl font-bold m-0 text-[#1B4F81] dark:text-[#7DB8F0]">{duration_minutes}<span className="text-base font-semibold"> min</span></p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Duração da aula</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-3xl font-bold m-0 text-amber-500">{overview.total_distraction_events ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Momentos de desatenção</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-3xl font-bold m-0 text-[#4A90D9]">{overview.total_summaries ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Resumos recuperados</p>
        </div>
      </div>

      {/* Nota LGPD — privacy by design */}
      <div className="flex items-start gap-2 mb-8 px-4 py-3 rounded-lg bg-[#E8F0FA] dark:bg-[#1B4F81]/20 border border-[#4A90D9]/30">
        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-[#1B4F81] dark:text-[#7DB8F0] m-0 leading-relaxed">
          <strong>Privacidade (LGPD):</strong> os dados individuais abaixo referem-se apenas a alunos que acompanharam pela própria conta, com webcam aberta. A câmera da sala mede atenção de forma <strong>anônima e agregada</strong> — sem identificar ou contar alunos.
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {/* Attention timeline */}
        {timeline.length > 1 && (
          <div className={`p-5 ${cardBase} lg:col-span-2`}>
            <h2 className="text-base font-semibold mb-1 text-gray-900 dark:text-[#F1F5F9]">Atenção da turma ao longo da aula</h2>
            <p className="text-xs text-gray-500 dark:text-[#64748B] mb-4 m-0">% de alunos atentos a cada minuto</p>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={timeline} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4A90D9" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#4A90D9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} vertical={false} />
                <XAxis
                  dataKey="minute" tickFormatter={(m) => `${m}m`}
                  stroke="#64748B" fontSize={11} tickLine={false} axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                  stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} width={42}
                />
                <Tooltip content={<ChartTooltip suffix="min" />} />
                {modeMarkers.map((mk, i) => (
                  <ReferenceLine
                    key={i} x={mk.minute} stroke="#7DB8F0" strokeDasharray="4 4"
                    label={{ value: mk.label, position: 'insideTopRight', fill: '#7DB8F0', fontSize: 10 }}
                  />
                ))}
                <Area
                  type="monotone" dataKey="attention_pct" stroke="#4A90D9"
                  strokeWidth={2} fill="url(#attGrad)" connectNulls dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-student ranking */}
        {ranking.length > 0 && (
          <div className={`p-5 ${cardBase} ${timeline.length > 1 ? '' : 'lg:col-span-3'}`}>
            <h2 className="text-base font-semibold mb-1 text-gray-900 dark:text-[#F1F5F9]">Atenção por aluno</h2>
            <p className="text-xs text-gray-500 dark:text-[#64748B] mb-4 m-0">% de atenção na aula</p>
            <ResponsiveContainer width="100%" height={Math.max(180, ranking.length * 38)}>
              <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 28, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category" dataKey="name" width={72}
                  stroke="#64748B" fontSize={12} tickLine={false} axisLine={false}
                />
                <Tooltip content={<ChartTooltip suffix="" />} cursor={{ fill: '#33415533' }} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#94A3B8', fontSize: 11, formatter: (v) => `${v}%` }}>
                  {ranking.map((r, i) => <Cell key={i} fill={attColor(r.pct)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Modes Used */}
      {overview.monitoring_modes_used?.length > 0 && (
        <div className={`p-4 ${cardBase} mb-8`}>
          <h2 className="text-base font-semibold mb-3 text-gray-900 dark:text-[#F1F5F9]">Modos de Monitoramento</h2>
          <div className="flex gap-2 flex-wrap">
            {overview.monitoring_modes_used.map((m, i) => (
              <span key={i} className="px-3 py-1 rounded bg-[#E8F0FA] dark:bg-[#1B4F81]/30 text-[#1B4F81] dark:text-[#7DB8F0] text-xs font-semibold">
                {m.mode === 'full_attention' ? 'Atenção Total' : m.mode === 'activity' ? 'Atividade' : m.mode === 'exam' ? 'Prova' : 'Intervalo'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Transcrição completa da aula */}
      <TranscriptPanel classId={classId} />

      {/* Materiais da aula — placeholder (ideia: professor anexa slides/PDFs
          apresentados, e o aluno acompanha o conteúdo junto da transcrição) */}
      <div className={`${cardBase} p-5 mb-8 mt-8`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h2 className="text-base font-semibold m-0 mb-1 text-gray-900 dark:text-[#F1F5F9]">Materiais da aula</h2>
            <p className="text-xs text-gray-500 dark:text-[#64748B] m-0 max-w-md">
              Anexe os slides, PDFs e arquivos apresentados em aula. O aluno acompanha o conteúdo junto da transcrição ao recuperar o que perdeu.
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Em breve"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#4A90D9]/50 text-[#4A90D9] dark:text-[#7DB8F0] text-sm font-semibold opacity-70 cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar materiais
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#E8F0FA] dark:bg-[#1B4F81]/40 text-[#1B4F81] dark:text-[#7DB8F0]">em breve</span>
          </button>
        </div>
      </div>

      {/* Students List */}
      <div className={`${cardBase} overflow-hidden`}>
        <h2 className="text-base font-semibold p-4 border-b border-gray-200 dark:border-[#334155] m-0 text-gray-900 dark:text-[#F1F5F9]">
          Alunos pela própria conta ({students.length})
        </h2>
        {students.length === 0 ? (
          <p className="py-12 text-center text-gray-500 dark:text-[#64748B] text-sm m-0">Nenhum aluno acompanhou pela própria conta nesta aula.</p>
        ) : (
          <div>
            {students.map((student, idx) => (
              <div key={student.student_id}>
                <div
                  onClick={() => setExpandedStudent(expandedStudent === idx ? null : idx)}
                  className={`flex justify-between items-center p-4 cursor-pointer border-b border-gray-200 dark:border-[#334155] transition-colors ${
                    expandedStudent === idx
                      ? 'bg-[#F1F5F9] dark:bg-[#0F172A]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#0F172A]/50'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-semibold m-0 mb-1.5 text-gray-900 dark:text-[#F1F5F9]">{student.student_name || `Aluno #${student.student_id}`}</p>
                    <div className="h-1.5 rounded-full bg-gray-200 dark:bg-[#334155] max-w-[300px] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${student.attention_percentage >= 70 ? 'bg-green-500' : student.attention_percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${student.attention_percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 min-w-[100px]">
                    <p className={`text-lg font-bold m-0 ${student.attention_percentage >= 70 ? 'text-green-500' : student.attention_percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                      {student.attention_percentage}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#64748B] m-0">{student.total_time_in_class_minutes}m total</p>
                  </div>
                </div>

                {expandedStudent === idx && (
                  <div className="p-5 bg-[#F1F5F9] dark:bg-[#0F172A] border-t border-gray-200 dark:border-[#334155]">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-3 mb-4">
                      <div><p className="text-xs text-gray-500 dark:text-[#64748B] m-0 mb-0.5">Atento</p><p className="text-base font-semibold text-green-500 m-0">{student.time_attentive_minutes}m</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-[#64748B] m-0 mb-0.5">Desatento</p><p className="text-base font-semibold text-[#4A90D9] m-0">{student.time_distracted_minutes}m</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-[#64748B] m-0 mb-0.5">Sem câmera</p><p className="text-base font-semibold text-amber-500 m-0">{student.time_no_camera_minutes}m</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-[#64748B] m-0 mb-0.5">Saiu/voltou</p><p className="text-base font-semibold text-gray-900 dark:text-[#F1F5F9] m-0">{student.times_left_and_returned}x</p></div>
                    </div>
                    {student.distraction_events?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-[#F1F5F9]">Eventos de Desatenção ({student.distraction_events.length})</h4>
                        {student.distraction_events.map((evt, i) => (
                          <div key={i} className="p-2.5 rounded bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] mb-1 text-xs">
                            <span className="text-gray-500 dark:text-[#64748B]">
                              {evt.started_at ? new Date(evt.started_at).toLocaleTimeString('pt-BR') : '?'} — {evt.ended_at ? new Date(evt.ended_at).toLocaleTimeString('pt-BR') : '?'}
                            </span>
                            <span className="ml-2 text-[#4A90D9]">({Math.round(evt.duration_seconds / 60)}min)</span>
                            {evt.summary && <p className="mt-1 mb-0 text-xs text-gray-500 dark:text-[#64748B]">{evt.summary.substring(0, 100)}...</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
