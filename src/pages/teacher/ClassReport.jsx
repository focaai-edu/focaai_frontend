import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';

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

  return (
    <Layout role="teacher">
      <div className="mb-6">
        <h1 className="text-2xl font-bold m-0 mb-1 text-gray-900 dark:text-[#F1F5F9]">{title || 'Relatório da Aula'}</h1>
        <p className="text-sm text-gray-500 dark:text-[#64748B] m-0">Duração: {duration_minutes} minutos</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 mb-8">
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-3xl font-bold m-0 text-[#1B4F81] dark:text-[#7DB8F0]">{overview.total_present}</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Alunos presentes</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className="text-3xl font-bold m-0 text-red-500">{overview.total_absent}</p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Alunos ausentes</p>
        </div>
        <div className={`p-5 ${cardBase} text-center`}>
          <p className={`text-3xl font-bold m-0 ${overview.average_attention_percentage >= 70 ? 'text-green-500' : overview.average_attention_percentage >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
            {overview.average_attention_percentage}%
          </p>
          <p className="text-xs text-gray-500 dark:text-[#64748B] mt-1 m-0">Atenção média</p>
        </div>
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

      {/* Students List */}
      <div className={`${cardBase} overflow-hidden`}>
        <h2 className="text-base font-semibold p-4 border-b border-gray-200 dark:border-[#334155] m-0 text-gray-900 dark:text-[#F1F5F9]">
          Alunos ({students.length})
        </h2>
        {students.length === 0 ? (
          <p className="py-12 text-center text-gray-500 dark:text-[#64748B] text-sm m-0">Nenhum aluno participou desta aula.</p>
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
                    <p className="text-sm font-semibold m-0 mb-1.5 text-gray-900 dark:text-[#F1F5F9]">Aluno #{student.student_id}</p>
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
