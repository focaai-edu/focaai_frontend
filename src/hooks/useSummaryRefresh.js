import { useEffect, useState } from 'react';

export const SUMMARY_WAIT_MS = 60000;
const REFRESH_MS = 5000;

/**
 * Resumos chegam alguns segundos depois do fim da aula (RN18: 8 s de carência,
 * em segundo plano). Enquanto a aula terminou há menos de 60 s e falta algum
 * resumo, chama `reload` a cada 5 s. Devolve `generating`: se um resumo que
 * falta ainda pode chegar ("Gerando resumo…") ou não ("Resumo não disponível…").
 * Usado na revisão do aluno e no relatório do professor (#5).
 */
export function useSummaryRefresh({ endedAt, missing, reload }) {
  const [now, setNow] = useState(() => Date.now());
  const ended = endedAt ? Date.parse(endedAt) : NaN;
  const generating = Number.isFinite(ended) && now - ended < SUMMARY_WAIT_MS;

  useEffect(() => {
    if (!missing || !generating) return undefined;
    const timer = setTimeout(() => {
      setNow(Date.now());
      reload();
    }, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [missing, generating, now, reload]);

  return { generating };
}
