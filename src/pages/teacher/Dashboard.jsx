import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { formatDuration } from '../../lib/duration';
import LoadError from '../../components/LoadError';
import Dialog from '../../components/Dialog';
import { isLoadFailure } from '../../lib/loadError';

const STATUS_LABELS = { live: 'Ao Vivo', scheduled: 'Agendada', ended: 'Encerrada' };
const STATUS_COLORS = {
  live: 'bg-green-100 text-green-700 dark:bg-success/15 dark:text-success',
  scheduled: 'bg-amber-100 text-amber-700 dark:bg-warning/15 dark:text-warning',
  ended: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Confirmação de exclusão (#20) ──────────────────────────────────────────────

function DeleteClassDialog({ cls, busy, onConfirm, onCancel }) {
  // Encerrada tem dados que somem junto (cascata do backend, RN04); agendada ainda não.
  const message = cls.status === 'ended'
    ? `Tem certeza que deseja excluir a aula "${cls.title}"? A transcrição, os eventos de atenção e os resumos dessa aula serão removidos permanentemente. Esta ação não pode ser desfeita.`
    : `Tem certeza que deseja excluir a aula "${cls.title}"? Esta ação não pode ser desfeita.`;
  return (
    <div className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4" onClick={busy ? undefined : onCancel}>
      <Dialog
        titleId="delete-class-title"
        onClose={busy ? () => {} : onCancel}
        className="bg-white dark:bg-surface-dark rounded-2xl p-6 max-w-md w-full shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-class-title" className="text-lg font-semibold text-gray-900 dark:text-text-primary-dark mb-3">Excluir aula</h2>
        <p className="text-sm text-gray-600 dark:text-text-muted-dark mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-border-dark text-gray-600 dark:text-text-muted-dark text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-border-dark transition-colors bg-transparent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-danger text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          >
            {busy ? 'Excluindo…' : 'Excluir aula'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

// ── Class Form Modal (create + edit) ──────────────────────────────────────────

function ClassFormModal({ editing, onSave, onClose }) {
  const [title, setTitle]             = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const isEdit = Boolean(editing);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Título é obrigatório.'); return; }
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.patch(`/api/classes/${editing.id}`, { title, description });
      } else {
        await api.post('/api/classes', { title, description });
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar aula.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Dialog
        titleId="class-form-title"
        onClose={onClose}
        className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-md w-full shadow-sm border border-border-light dark:border-border-dark"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="class-form-title" className="text-lg font-semibold text-gray-900 dark:text-text-primary-dark">
            {isEdit ? 'Editar Aula' : 'Nova Aula'}
          </h2>
          <button
            type="button"
            aria-label="Fechar janela"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-text-muted-dark hover:text-gray-600 dark:hover:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors border-none bg-transparent cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="cls-title" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Título <span className="text-red-400">*</span>
            </label>
            <input
              id="cls-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Matemática — Revisão para prova"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-bg-dark text-gray-900 dark:text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>
          <div>
            <label htmlFor="cls-desc" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              Descrição <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              id="cls-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descreva o conteúdo da aula..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-bg-dark text-gray-900 dark:text-text-primary-dark text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary resize-none placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border-light dark:border-border-dark text-gray-600 dark:text-text-secondary-dark text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-transparent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Aula'}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [allClasses, setAllClasses]   = useState([]);
  const [tab, setTab]                 = useState('live');
  const [loadFailed, setLoadFailed]   = useState(false);
  // Relógio do "Ao vivo há ..." dos cards (#9, CA8).
  const [now, setNow]                 = useState(() => Date.now());
  const [editingClass, setEditingClass] = useState(null); // null = closed, undefined = create, obj = edit
  const [showModal, setShowModal]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const [live, scheduled, ended] = await Promise.all([
        api.get('/api/classes', { params: { status: 'live' } }),
        api.get('/api/classes', { params: { status: 'scheduled' } }),
        api.get('/api/classes', { params: { status: 'ended' } }),
      ]);
      setAllClasses([
        ...live.data.classes,
        ...scheduled.data.classes,
        ...ended.data.classes,
      ]);
      setLoadFailed(false);
    } catch (err) {
      if (isLoadFailure(err)) setLoadFailed(true);
      else setAllClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const openCreate = () => { setEditingClass(null); setShowModal(true); };
  const openEdit   = (cls) => { setEditingClass(cls); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditingClass(null); };

  const handleSaved = async () => {
    closeModal();
    await fetchClasses();
  };

  const handleStart = async (id) => {
    setError('');
    try {
      // Só REST: o PATCH já muda o estado; o emit de socket era redundante (#9, F19).
      await api.patch(`/api/classes/${id}/start`);
      navigate(`/teacher/classes/${id}/live`);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao iniciar aula.');
    }
  };

  const handleEnd = async (id) => {
    setError('');
    try {
      await api.patch(`/api/classes/${id}/end`);
      await fetchClasses();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao encerrar aula.');
    }
  };

  // Exclusão confirmada no Dialog (#20). Sucesso: tira o card da lista na hora
  // (o contador da aba acompanha), sem recarregar. Erro: o card fica e o aviso diz.
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'success' | 'error', text }

  const confirmDelete = async () => {
    const cls = deleting;
    setDeleteBusy(true);
    try {
      await api.delete(`/api/classes/${cls.id}`);
      setAllClasses((prev) => prev.filter((c) => c.id !== cls.id));
      setNotice({ kind: 'success', text: 'Aula excluída com sucesso.' });
    } catch {
      setNotice({ kind: 'error', text: 'Não foi possível excluir a aula. Tente novamente.' });
    } finally {
      setDeleteBusy(false);
      setDeleting(null);
    }
  };

  const tabs = [
    { key: 'live', label: 'Ao Vivo' },
    { key: 'scheduled', label: 'Agendadas' },
    { key: 'ended', label: 'Encerradas' },
  ];

  const counts = {
    live:      allClasses.filter(c => c.status === 'live').length,
    scheduled: allClasses.filter(c => c.status === 'scheduled').length,
    ended:     allClasses.filter(c => c.status === 'ended').length,
  };

  const classes = allClasses.filter(c => c.status === tab);

  const emptyMessages = {
    live:      { title: 'Nenhuma aula ao vivo',    sub: 'Inicie uma aula agendada para aparecer aqui.' },
    scheduled: { title: 'Nenhuma aula agendada',   sub: 'Clique em "+ Nova Aula" para criar.' },
    ended:     { title: 'Nenhuma aula encerrada',  sub: 'As aulas encerradas ficam arquivadas aqui.' },
  };

  return (
    <Layout role="teacher">
      {/* Page header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-text-primary-dark m-0 mb-1">Minhas Aulas</h1>
          <p className="text-sm text-gray-500 dark:text-text-muted-dark m-0">
            {counts.live > 0 && <span className="text-green-600 font-medium">{counts.live} ao vivo · </span>}
            {counts.scheduled} agendada{counts.scheduled !== 1 ? 's' : ''} · {counts.ended} encerrada{counts.ended !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Aula
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mb-4 p-3 rounded-lg text-sm ${notice.kind === 'error'
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400'
            : 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400'}`}
        >
          {notice.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0 mb-6 border-b border-border-light dark:border-border-dark">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            // Rótulo e número separados para o leitor de tela: "Agendadas, 1 aula" (#19, V13).
            aria-label={counts[t.key] > 0 ? `${t.label}, ${counts[t.key]} ${counts[t.key] === 1 ? 'aula' : 'aulas'}` : t.label}
            className={`relative px-5 py-2.5 text-sm font-medium border-none cursor-pointer transition-colors bg-transparent ${
              tab === t.key
                ? 'text-primary dark:text-secondary'
                : 'text-gray-500 dark:text-text-muted-dark hover:text-gray-700 dark:hover:text-text-secondary-dark'
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span aria-hidden="true" className={`ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                t.key === 'live'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-text-secondary-dark'
              }`}>{counts[t.key]}</span>
            )}
            {tab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-surface-dark rounded-xl animate-pulse" />
          ))}
        </div>
      ) : loadFailed ? (
        <LoadError onRetry={() => { setLoading(true); fetchClasses(); }} />
      ) : classes.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-surface-dark flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-gray-700 dark:text-slate-300 font-medium text-sm mb-1">{emptyMessages[tab].title}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs">{emptyMessages[tab].sub}</p>
          {tab === 'scheduled' && (
            <button
              onClick={openCreate}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              + Nova Aula
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map(cls => (
            <div
              key={cls.id}
              className="group bg-white dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark px-5 py-4 flex items-center gap-4 hover:border-secondary/40 hover:shadow-sm transition-all"
            >
              {/* Status dot */}
              <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-0.5 ${
                cls.status === 'live'      ? 'bg-green-500' :
                cls.status === 'scheduled' ? 'bg-amber-400' : 'bg-gray-300'
              }`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 dark:text-text-primary-dark truncate">{cls.title}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_COLORS[cls.status]}`}>
                    {STATUS_LABELS[cls.status]}
                  </span>
                </div>
                {cls.description && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{cls.description}</p>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                  {cls.status === 'live'      && cls.started_at && `Ao vivo há ${formatDuration((now - new Date(cls.started_at).getTime()) / 1000)}`}
                  {cls.status === 'scheduled' && `Criada em ${formatDate(cls.created_at)}`}
                  {cls.status === 'ended'     && cls.ended_at   && `Encerrada em ${formatDate(cls.ended_at)}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {cls.status === 'scheduled' && (
                  <>
                    <button
                      onClick={() => handleStart(cls.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      Iniciar
                    </button>
                    <button
                      onClick={() => openEdit(cls)}
                      title="Editar aula"
                      aria-label={`Editar aula ${cls.title}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-light dark:border-border-dark text-gray-500 dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-transparent cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(cls)}
                      title="Excluir aula"
                      aria-label={`Excluir aula ${cls.title}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 dark:border-red-900/40 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-transparent cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m6 0H7" />
                      </svg>
                    </button>
                  </>
                )}

                {cls.status === 'live' && (
                  <>
                    <button
                      onClick={() => navigate(`/teacher/classes/${cls.id}/live`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
                      Acessar
                    </button>
                    {/* Câmera da sala: experimental, fica como opção secundária (#9). */}
                    <button
                      onClick={() => navigate('/room')}
                      className="px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-gray-600 dark:text-text-secondary-dark text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-transparent cursor-pointer"
                    >
                      Câmera da sala
                    </button>
                    <button
                      onClick={() => handleEnd(cls.id)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-danger/40 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-danger/10 transition-colors bg-transparent cursor-pointer"
                    >
                      Encerrar
                    </button>
                  </>
                )}

                {cls.status === 'ended' && (
                  <>
                    <button
                      onClick={() => navigate(`/teacher/classes/${cls.id}/report`)}
                      className="px-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark text-gray-600 dark:text-text-secondary-dark text-xs font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-transparent cursor-pointer"
                    >
                      Ver Relatório
                    </button>
                    <button
                      onClick={() => openEdit(cls)}
                      title="Editar aula"
                      aria-label={`Editar aula ${cls.title}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border-light dark:border-border-dark text-gray-500 dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors bg-transparent cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(cls)}
                      title="Excluir aula"
                      aria-label={`Excluir aula ${cls.title}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-100 dark:border-red-900/40 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-transparent cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m6 0H7" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <DeleteClassDialog cls={deleting} busy={deleteBusy} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}

      {showModal && (
        <ClassFormModal
          editing={editingClass}
          onSave={handleSaved}
          onClose={closeModal}
        />
      )}
    </Layout>
  );
}
