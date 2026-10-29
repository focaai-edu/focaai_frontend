import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { setupEnvironment, teardownEnvironment, flush, FakeMediaRecorder } from '../test/attentionHarness';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket, fakeSocketModule } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return fakeSocketModule(socket.current);
});

import { useAudioChunks } from './useAudioChunks';

let env;
beforeEach(() => {
  env = setupEnvironment();
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

const chunks = () => socket.current.emit.mock.calls.filter(([ev]) => ev === 'audio_chunk').map(([, p]) => p);
const wait = (ms) => act(() => { vi.advanceTimersByTime(ms); });

async function record(props = { classId: 7, enabled: true }) {
  const hook = renderHook((p) => useAudioChunks(p.classId, { enabled: p.enabled }), { initialProps: props });
  await flush();
  return hook;
}

describe('useAudioChunks (#4)', () => {
  it('CA1/CA4: trechos de 5 s saem com class_id, audio e duration_ms medido', async () => {
    const { result } = await record();
    expect(env.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.status).toBe('recording');
    wait(5000);
    wait(5000);
    expect(chunks()).toEqual([
      { class_id: 7, audio: 'QUJD', duration_ms: 5000 },
      { class_id: 7, audio: 'QUJD', duration_ms: 5000 },
    ]);
  });

  it('CA3/CA8: stop() finaliza o trecho em curso com a duração real e só então libera o microfone', async () => {
    const { result } = await record();
    wait(5000);
    wait(2300);
    expect(env.stream.track.stop).not.toHaveBeenCalled();
    act(() => { result.current.stop(); });
    expect(chunks().map((c) => c.duration_ms)).toEqual([5000, 2300]);
    expect(env.stream.track.stop).toHaveBeenCalled();
    const recorders = FakeMediaRecorder.instances.length;
    wait(10000);
    expect(FakeMediaRecorder.instances.length).toBe(recorders);
    expect(chunks()).toHaveLength(2);
    expect(result.current.status).toBe('idle');
  });

  it('CA8: desligar (enabled=false) ou desmontar também envia o último trecho', async () => {
    const { rerender, unmount } = await record();
    wait(1700);
    rerender({ classId: 7, enabled: false });
    expect(chunks()).toEqual([{ class_id: 7, audio: 'QUJD', duration_ms: 1700 }]);
    rerender({ classId: 7, enabled: true });
    await flush();
    wait(900);
    unmount();
    expect(chunks().map((c) => c.duration_ms)).toEqual([1700, 900]);
  });

  it('CA5: trecho com 500 bytes ou menos é descartado; com 501 é enviado', async () => {
    FakeMediaRecorder.size = 500;
    await record();
    wait(5000);
    expect(chunks()).toEqual([]);
    FakeMediaRecorder.size = 501;
    wait(5000);
    expect(chunks()).toHaveLength(1);
  });

  it('CA7 (erro): offline, o trecho é descartado e o status vira offline; ao voltar, nada do período sai', async () => {
    const { result } = await record();
    socket.current.connected = false;
    socket.current.trigger('disconnect', 'transport close');
    expect(result.current.status).toBe('offline');
    wait(5000);
    wait(5000);
    expect(chunks()).toEqual([]);
    socket.current.connected = true;
    socket.current.trigger('connect');
    expect(result.current.status).toBe('recording');
    expect(chunks()).toEqual([]);
    wait(5000);
    expect(chunks()).toHaveLength(1);
  });

  it('CA9 (erro): permissão concedida depois de sair da tela para as tracks e não grava', async () => {
    let grant;
    env.getUserMedia.mockReturnValue(new Promise((resolve) => { grant = resolve; }));
    const { unmount } = await record();
    unmount();
    await act(async () => { grant(env.stream); });
    expect(env.stream.track.stop).toHaveBeenCalled();
    wait(10000);
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    expect(chunks()).toEqual([]);
  });

  it('microfone negado: status error e nenhum audio_chunk', async () => {
    env.getUserMedia.mockRejectedValue(Object.assign(new Error('negado'), { name: 'NotAllowedError' }));
    const { result } = await record();
    wait(10000);
    expect(result.current.status).toBe('error');
    expect(chunks()).toEqual([]);
  });

  it('desligado (enabled=false) não pede o microfone', async () => {
    await record({ classId: 7, enabled: false });
    expect(env.getUserMedia).not.toHaveBeenCalled();
  });

  it('CA11 (erro): depois de um error do servidor, nada é reenviado e a gravação segue', async () => {
    await record();
    wait(5000);
    socket.current.trigger('error', { message: 'Erro ao processar audio' });
    wait(5000);
    expect(chunks()).toHaveLength(2);
  });

  it('CA8: trocar ou zerar a aula junto com desligar envia o último trecho para a aula da gravação', async () => {
    const { rerender } = await record();
    wait(1200);
    rerender({ classId: null, enabled: false });
    expect(chunks()).toEqual([{ class_id: 7, audio: 'QUJD', duration_ms: 1200 }]);
  });

  it('trocar de aula com a gravação ligada fecha o trecho na aula antiga e segue na nova', async () => {
    const { rerender } = await record();
    wait(1000);
    rerender({ classId: 8, enabled: true });
    await flush();
    wait(5000);
    expect(chunks()).toEqual([
      { class_id: 7, audio: 'QUJD', duration_ms: 1000 },
      { class_id: 8, audio: 'QUJD', duration_ms: 5000 },
    ]);
  });
});
