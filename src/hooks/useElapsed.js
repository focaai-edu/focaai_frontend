import { useEffect, useState } from 'react';

// Segundos desde `startedAt` (ISO), atualizado a cada segundo. Começa já com o
// valor certo, sem um primeiro render em zero.
export function useElapsed(startedAt) {
  const since = startedAt ? new Date(startedAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);

  return since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
}
