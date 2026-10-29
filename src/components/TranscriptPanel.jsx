import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadError from './LoadError';
import { isLoadFailure } from '../lib/loadError';

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
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await api.get(`/api/classes/${classId}/transcriptions`);
      setBlocks(res.data.transcriptions || []);
    } catch (err) {
      if (err.response?.status === 403) setDenied(true);
      // Rede ou 5xx: erro visível em vez de sumir sem aviso (#5, F33).
      else if (isLoadFailure(err)) setFailed(true);
      setBlocks([]);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  // Sem permissão ou sem nenhum bloco: não renderiza nada.
  if (denied) return null;
  if (failed) return <LoadError onRetry={() => { setBlocks(null); load(); }} className="mb-8" />;
  if (blocks !== null && blocks.length === 0) return null;

  const fmt = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  const cardBase = 'rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm';

  return (
    <div className={`${cardBase} overflow-hidden mb-8`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center p-4 bg-transparent border-none cursor-pointer text-left hover:bg-slate-50 dark:hover:bg-bg-dark/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-base font-semibold m-0 text-slate-900 dark:text-text-primary-dark">
            Transcrição completa da aula
          </h2>
          {blocks !== null && (
            <span className="text-xs text-slate-500 dark:text-text-muted-dark">({blocks.length} trechos)</span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 dark:text-text-muted-dark transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-border-light dark:border-border-dark p-5 max-h-[420px] overflow-y-auto">
          {blocks === null ? (
            <p className="text-sm text-slate-500 dark:text-text-muted-dark text-center py-6 m-0">Carregando transcrição...</p>
          ) : (
            <div className="text-sm leading-relaxed">
              {blocks.map((b, i) => (
                <div key={i} className={`mb-4 pb-4 ${i < blocks.length - 1 ? 'border-b border-border-light dark:border-border-dark/50' : ''}`}>
                  <span className="text-xs font-mono text-slate-500 dark:text-text-muted-dark block mb-1">
                    {fmt(b.timestamp_start)}{b.timestamp_end ? ` – ${fmt(b.timestamp_end)}` : ''}
                  </span>
                  <p className="m-0 text-slate-700 dark:text-slate-300">{b.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
