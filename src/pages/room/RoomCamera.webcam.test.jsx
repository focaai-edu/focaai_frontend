import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act } from '@testing-library/react';
import { setupEnvironment, teardownEnvironment, flush, createFakeStream } from '../../test/attentionHarness';
import { renderRoutes } from '../../test/router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket, fakeSocketModule } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return fakeSocketModule(socket.current);
});
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

import api from '../../services/api';
import RoomCamera from './RoomCamera';

const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention' };
const OTHER = { id: 8, title: 'Química', status: 'live', monitoring_mode: 'full_attention' };

function liveStream() {
  const stream = createFakeStream();
  stream.track.readyState = 'live';
  stream.track.stop.mockImplementation(() => { stream.track.readyState = 'ended'; });
  return stream;
}

function mediaError(name) {
  return Object.assign(new Error(name), { name });
}

let env;
let video; // respostas do getUserMedia de vídeo, em ordem: stream, erro ou promessa
beforeEach(() => {
  env = setupEnvironment();
  localStorage.setItem('foca_cameras', JSON.stringify([{ id: 'cam1', name: 'Webcam', stream_url: '__webcam__' }]));
  localStorage.setItem('foca_active_camera_id', 'cam1');
  api.get.mockReset();
  api.get.mockResolvedValue({ data: { classes: [LIVE] } });
  socket.current.connected = true;
  video = [];
  env.getUserMedia.mockImplementation(async (constraints) => {
    if (!constraints.video) return env.stream; // microfone (RF14)
    const next = video.length ? video.shift() : liveStream();
    if (next instanceof Error) throw next;
    return next;
  });
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
  localStorage.clear();
});

async function renderRoom() {
  renderRoutes([{ path: '/room', element: <RoomCamera /> }], '/room');
  await flush();
  await flush();
}

const abrir = () => screen.getByRole('button', { name: 'Abrir Sala' });
const videoEl = () => document.querySelector('video');
const videoCalls = () => env.getUserMedia.mock.calls.filter(([c]) => c.video).length;

describe('/room — erro da webcam e nova tentativa (#47)', () => {
  it.each([
    ['NotReadableError', 'A câmera está em uso por outro aplicativo ou navegador. Feche-o e clique em Tentar de novo.'],
    ['NotAllowedError', 'Permissão da câmera negada. Libere o acesso à câmera no navegador e clique em Tentar de novo.'],
    ['NotFoundError', 'Nenhuma câmera encontrada. Conecte uma webcam e clique em Tentar de novo.'],
    ['AbortError', 'Não foi possível abrir a câmera. Clique em Tentar de novo.'],
  ])('CA1/CA2: %s mostra o motivo e o botão "Tentar de novo"', async (name, text) => {
    video = [mediaError(name)];
    await renderRoom();
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
    expect(abrir().disabled).toBe(true);
  });

  it('CA3: "Tentar de novo" refaz o getUserMedia, liga o vídeo e libera "Abrir Sala"', async () => {
    const ok = liveStream();
    video = [mediaError('NotReadableError'), ok];
    await renderRoom();
    expect(videoCalls()).toBe(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    await flush();
    expect(videoCalls()).toBe(2);
    expect(videoEl().srcObject).toBe(ok);
    expect(screen.queryByText(/A câmera está em uso/)).toBeNull();
    expect(abrir().disabled).toBe(false);
  });

  it('CA4: stream que chega depois de trocar a aula é parada; o vídeo fica com a atual', async () => {
    api.get.mockResolvedValue({ data: { classes: [LIVE, OTHER] } });
    let resolveOld;
    const old = liveStream();
    const current = liveStream();
    video = [new Promise((r) => { resolveOld = () => r(old); }), current];
    await renderRoom();
    // troca de aula com o primeiro getUserMedia ainda pendente
    await act(async () => { fireEvent.change(screen.getByRole('combobox'), { target: { value: '8' } }); });
    await flush();
    await act(async () => { resolveOld(); });
    await flush();
    expect(old.track.stop).toHaveBeenCalled();
    expect(videoEl().srcObject).toBe(current);
    expect(current.track.stop).not.toHaveBeenCalled();
  });

  it('CA5: "Usar câmera" na câmera já ativa não derruba a stream nem desabilita "Abrir Sala"', async () => {
    await renderRoom();
    expect(abrir().disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Usar câmera Webcam' })); });
    await flush();
    expect(abrir().disabled).toBe(false);
    expect(videoEl().srcObject).toBeTruthy();
  });

  it('#56 CA1/CA2: pede 1280x720 como ideal (nunca exact/min), também no "Tentar de novo"', async () => {
    video = [mediaError('NotReadableError')];
    await renderRoom();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    await flush();
    const asked = env.getUserMedia.mock.calls.map(([c]) => c).filter((c) => c.video);
    expect(asked).toHaveLength(2);
    for (const c of asked) {
      expect(c).toEqual({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
      expect(JSON.stringify(c)).not.toMatch(/exact|min/);
    }
  });
});
