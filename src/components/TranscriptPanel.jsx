import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Painel colapsável com a transcrição completa de uma aula encerrada.
 * Busca GET /api/classes/<classId>/transcriptions.
 *
 * O backend autoriza: professor dono da aula, ou aluno que participou
 * (tem class_session). Em 403/erro o painel simplesmente não aparece.
 *
 * Props:
 *   classId        — id da aula
 *   defaultOpen    — começa expandido? (default false)
 */
export default function TranscriptPanel({ classId, defaultOpen = false }) {
  const [blocks, setBlocks] = useState(null); // null = carregando, [] = vazio
  const [open, setOpen] = useState(defaultOpen);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get(`/api/classes/${classId}/transcriptions`);
        if (!cancelled) setBlocks(res.data.transcriptions || []);
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 403) setDenied(true);
          setBlocks([]);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [classId]);

  // Sem permissão ou sem nenhum bloco: não renderiza nada.
  if (denied) return null;
  if (blocks !== null && blocks.length === 0) return null;

  const fmt = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const cardBase = 'rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155]';

  return (
    <div className={`${cardBase} overflow-hidden mb-8`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center p-4 bg-transparent border-none cursor-pointer text-left hover:bg-gray-50 dark:hover:bg-[#0F172A]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#4A90D9]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-base font-semibold m-0 text-gray-900 dark:text-[#F1F5F9]">
            Transcrição completa da aula
          </h2>
          {blocks !== null && (
            <span className="text-xs text-gray-400 dark:text-[#64748B]">({blocks.length} trechos)</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 dark:text-[#64748B] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-[#334155] p-5 max-h-[420px] overflow-y-auto">
          {blocks === null ? (
            <p className="text-sm text-gray-500 dark:text-[#64748B] text-center py-6 m-0">Carregando transcrição...</p>
          ) : (
            <div className="text-sm leading-relaxed">
              {blocks.map((b, i) => (
                <div key={i} className={`mb-4 pb-4 ${i < blocks.length - 1 ? 'border-b border-gray-100 dark:border-[#334155]/50' : ''}`}>
                  <span className="text-xs font-mono text-gray-400 dark:text-[#64748B] block mb-1">
                    {fmt(b.timestamp_start)}{b.timestamp_end ? ` – ${fmt(b.timestamp_end)}` : ''}
                  </span>
                  <p className="m-0 text-gray-700 dark:text-[#CBD5E1]">{b.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
