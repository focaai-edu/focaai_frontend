// Adapter do axios para testes: responde por URL sem rede. A rota devolve
// { status, data } ou lança (falha de rede, sem resposta).
import { AxiosError } from 'axios';

export function fakeAdapter(route) {
  return async (config) => {
    const result = await route(config.url, config);
    const response = { data: result.data ?? {}, status: result.status ?? 200, statusText: '', headers: {}, config };
    if (response.status >= 200 && response.status < 300) return response;
    const code = response.status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST;
    throw new AxiosError(`Request failed with status code ${response.status}`, code, config, null, response);
  };
}

export function networkError(config) {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, null);
}
