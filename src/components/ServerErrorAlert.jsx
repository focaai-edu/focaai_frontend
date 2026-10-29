import { useEffect, useState } from 'react';
import socket from '../services/socket';

const VISIBLE_MS = 6000;
const FALLBACK_MESSAGE = 'Ocorreu um erro no servidor.';

/**
 * Aviso não bloqueante para o `error { message }` que o servidor envia só ao
 * remetente (ex.: falha ao transcrever ou salvar). Montado uma vez no App, vale
 * para qualquer tela; não troca de tela nem interrompe a aula (#3, F17).
 */
export default function ServerErrorAlert() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let timer = null;
    const onError = (data) => {
      clearTimeout(timer);
      setMessage(data?.message || FALLBACK_MESSAGE);
      timer = setTimeout(() => setMessage(null), VISIBLE_MS);
    };
    socket.on('error', onError);
    return () => {
      clearTimeout(timer);
      socket.off('error', onError);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] px-4 py-3 rounded-lg bg-[#1B4F81] text-[#F1F5F9] text-sm shadow-sm"
    >
      {message}
    </div>
  );
}
