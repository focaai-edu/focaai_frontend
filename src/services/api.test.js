import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import api, { onUnauthorized } from './api';
import { fakeAdapter, networkError } from '../test/fakeAdapter';

let status;
let unsubscribe;
const handler = vi.fn();
const original = api.defaults.adapter;

beforeEach(() => {
  status = 200;
  handler.mockClear();
  unsubscribe = onUnauthorized(handler);
  api.defaults.adapter = fakeAdapter((url, config) => {
    if (status === 'network') throw networkError(config);
    return { status, data: status === 401 ? { error: 'Não autenticado.' } : { ok: true } };
  });
});
afterEach(() => {
  unsubscribe();
  api.defaults.adapter = original;
});

describe('interceptor de 401 do cliente api (#45)', () => {
  it('CA1 e CA6: 401 numa chamada autenticada avisa o AuthContext e a chamada continua rejeitada', async () => {
    status = 401;
    const error = await api.get('/api/classes').catch((e) => e);
    expect(error.response.status).toBe(401);
    expect(error.response.data).toEqual({ error: 'Não autenticado.' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('CA2 e CA3: 401 de /api/auth/login, /api/auth/me e do próprio logout não encerra a sessão', async () => {
    status = 401;
    await expect(api.post('/api/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    await expect(api.get('/api/auth/me')).rejects.toMatchObject({ response: { status: 401 } });
    // logout com sessão já expirada: o logout da aba não mostra o aviso (RF22, #32)
    await expect(api.post('/api/auth/logout')).rejects.toMatchObject({ response: { status: 401 } });
    expect(handler).not.toHaveBeenCalled();
  });

  it.each(['network', 403, 500, 503])('CA5: %s não desloga', async (s) => {
    status = s;
    await expect(api.get('/api/classes')).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  it('sucesso passa direto e, sem ouvinte, o 401 só rejeita', async () => {
    await expect(api.get('/api/classes')).resolves.toMatchObject({ data: { ok: true } });
    unsubscribe();
    status = 401;
    await expect(api.get('/api/classes')).rejects.toMatchObject({ response: { status: 401 } });
    expect(handler).not.toHaveBeenCalled();
  });
});
