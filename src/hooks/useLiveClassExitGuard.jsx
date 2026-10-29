import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import api from '../services/api';
import Dialog from '../components/Dialog';

/**
 * Sair de uma aula ao vivo sem encerrar deixa a aula `live` sem áudio até o
 * backend encerrá-la por ausência (RN25). Por isso, com a aula ao vivo (#9, CA7):
 * - fechar ou recarregar a aba pede a confirmação do navegador (`beforeunload`);
 * - navegação interna (voltar, menu, "← Painel") e ações como "Fechar Sala"
 *   abrem o diálogo "Encerrar a aula também?".
 *
 * `requestLeave(proceed)` abre o diálogo para uma ação da tela; `allowLeave()`
 * libera saídas legítimas (aula encerrada) sem perguntar.
 */
export function useLiveClassExitGuard({ classId, active }) {
  const [pending, setPending] = useState(null); // { proceed, cancel }
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const allowed = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    active && !allowed.current && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    setError('');
    setPending({ proceed: () => blocker.proceed(), cancel: () => blocker.reset() });
  }, [blocker]);

  useEffect(() => {
    if (!active) return undefined;
    const onBeforeUnload = (event) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = ''; // navegadores antigos
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  const allowLeave = useCallback(() => { allowed.current = true; }, []);

  const requestLeave = useCallback((proceed) => {
    if (!active) { proceed(); return; }
    setError('');
    setPending({ proceed, cancel: () => {} });
  }, [active]);

  const leaveWithoutEnding = () => {
    const p = pending;
    setPending(null);
    p.proceed();
  };

  const endAndLeave = async () => {
    setEnding(true);
    setError('');
    try {
      await api.patch(`/api/classes/${classId}/end`);
      allowed.current = true;
      const p = pending;
      setPending(null);
      p.proceed();
    } catch {
      setError('Erro ao encerrar aula.');
    } finally {
      setEnding(false);
    }
  };

  const stay = () => {
    const p = pending;
    setPending(null);
    p.cancel();
  };

  const dialog = pending && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Dialog
        titleId="leave-live-class-title"
        onClose={stay}
        className="w-full max-w-sm rounded-xl bg-white dark:bg-[#1E293B] p-6 text-gray-900 dark:text-[#F1F5F9]"
      >
        <p id="leave-live-class-title" className="m-0 mb-4 text-base font-semibold">
          A aula continua ao vivo. Encerrar a aula também?
        </p>
        {error && <p role="alert" className="m-0 mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={endAndLeave}
            disabled={ending}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-60"
          >
            Encerrar aula
          </button>
          <button
            type="button"
            onClick={leaveWithoutEnding}
            disabled={ending}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#334155] text-sm font-semibold bg-transparent"
          >
            Sair sem encerrar
          </button>
          <button
            type="button"
            onClick={stay}
            disabled={ending}
            autoFocus
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#1B4F81] dark:text-[#4A90D9] bg-transparent"
          >
            Continuar na aula
          </button>
        </div>
      </Dialog>
    </div>
  );

  return { requestLeave, allowLeave, dialog };
}
