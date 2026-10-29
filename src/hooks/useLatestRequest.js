import { useCallback, useRef } from 'react';

// Devolve `begin()`: cada chamada abre uma requisição e invalida as anteriores.
// Antes de aplicar a resposta, confira `isLatest()`: uma resposta lenta de um
// pedido antigo não sobrescreve a mais nova (#35, F23).
export function useLatestRequest() {
  const counter = useRef(0);
  return useCallback(() => {
    const id = ++counter.current;
    return { isLatest: () => id === counter.current };
  }, []);
}
