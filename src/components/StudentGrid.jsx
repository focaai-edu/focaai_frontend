export default function StudentGrid({ students = [], monitoringMode = 'full_attention' }) {
  const MODE_LABELS = {
    full_attention: 'Atenção Total',
    activity: 'Atividade',
    exam: 'Prova',
    break: 'Intervalo',
  };

  const STATUS_COLORS = {
    attentive: '#22C55E',
    distracted: '#4A90D9',
    no_camera: '#F59E0B',
    disconnected: '#9CA3AF',
  };

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 text-gray-500 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-gray-500 text-sm font-medium">Nenhum aluno conectado</p>
        <p className="text-gray-500 text-xs mt-1 opacity-70">Aguardando alunos entrarem na aula...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-500">
          {students.length} aluno{students.length !== 1 ? 's' : ''} · {MODE_LABELS[monitoringMode] || monitoringMode}
        </span>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {students.map(student => {
          const status = student.status || 'connected';
          const color = STATUS_COLORS[status] || '#9CA3AF';

          return (
            <div
              key={student.student_id}
              className="bg-white rounded-lg p-4 border-2 transition-shadow hover:shadow-sm"
              style={{ borderColor: color }}
            >
              <div
                className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-2 text-base font-semibold text-gray-900"
              >
                {(student.student_name || '?')[0].toUpperCase()}
              </div>
              <p className="text-sm font-semibold m-0 mb-1 truncate">
                {student.student_name || `Aluno ${student.student_id}`}
              </p>
              <span className="text-xs font-semibold" style={{ color }}>
                {status === 'connected' ? 'Conectado' :
                 status === 'disconnected' ? 'Desconectado' :
                 status === 'attentive' ? 'Atento' :
                 status === 'distracted' ? 'Desatento' :
                 status === 'no_camera' ? 'Sem câmera' : status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
