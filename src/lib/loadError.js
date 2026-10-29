// Falha de carga = sem resposta (rede, servidor fora) ou erro 5xx. Respostas 4xx
// (sem permissão, não encontrado) continuam tratadas como estado vazio (#5, F33).
export function isLoadFailure(err) {
  const status = err?.response?.status;
  return status === undefined || status >= 500;
}
