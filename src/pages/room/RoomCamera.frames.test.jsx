import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act } from '@testing-library/react';
import { setupEnvironment, teardownEnvironment, flush } from '../../test/attentionHarness';
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
const ANSWER = { class_id: 7, faces: [], img_w: 640, img_h: 480 };

beforeEach(() => {
  setupEnvironment();
  localStorage.setItem('foca_cameras', JSON.stringify([{ id: 'cam1', name: 'Webcam', stream_url: '__webcam__' }]));
  localStorage.setItem('foca_active_camera_id', 'cam1');
  api.get.mockReset();
  api.get.mockResolvedValue({ data: { classes: [LIVE] } });
  socket.current.connected = true;
  socket.current.emit.mockClear();
  // <video> pronto e canvas que desenha e exporta (o jsdom não faz nenhum dos dois).
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4);
  const ctx = new Proxy({}, { get: () => () => {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,AAAA');
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
  localStorage.clear();
});

async function openRoom() {
  renderRoutes([{ path: '/room', element: <RoomCamera /> }], '/room');
  await flush();
  await flush();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abrir Sala' })); });
  await flush();
}

const frames = () => socket.current.emit.mock.calls.filter(([ev]) => ev === 'room_frame').length;
const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });
const answer = (data = ANSWER) => socket.current.trigger('faces_identified', data);

describe('/room — 1 frame por segundo, um por vez (#51)', () => {
  it('CA1: com resposta rápida, envia na abertura e depois a cada 1000 ms', async () => {
    await openRoom();
    expect(frames()).toBe(1);
    // #56 CA3: o frame continua JPEG 0,75
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.75);
    for (let i = 2; i <= 4; i++) {
      answer();
      tick(999);
      expect(frames()).toBe(i - 1);
      tick(1);
      expect(frames()).toBe(i);
    }
  });

  it('CA2: sem resposta, o tique seguinte não envia; a resposta libera o próximo', async () => {
    await openRoom();
    tick(1000);
    tick(1000);
    expect(frames()).toBe(1);
    // resposta de outra aula não conta
    answer({ ...ANSWER, class_id: 99 });
    tick(1000);
    expect(frames()).toBe(1);
    answer();
    tick(1000);
    expect(frames()).toBe(2);
  });

  it('CA3 (erro): sem resposta por 5 s, libera; um error do servidor também libera', async () => {
    await openRoom();
    tick(4000);
    expect(frames()).toBe(1);
    tick(1000);
    expect(frames()).toBe(2);
    socket.current.trigger('error', { message: 'Não foi possível salvar a alteração.' });
    tick(1000);
    expect(frames()).toBe(3);
  });

  it('CA4: fechar e reabrir a sala começa sem bloqueio herdado', async () => {
    await openRoom();
    expect(frames()).toBe(1);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fechar Sala' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abrir Sala' })); });
    await flush();
    expect(frames()).toBe(2);
  });

  it('#53: zero rostos mostra "Nenhum rosto detectado"; rostos voltam ao agregado; reabrir volta a "Analisando"', async () => {
    await openRoom();
    expect(screen.getByText('Analisando frame...')).toBeTruthy();
    const update = (total, attentive) => socket.current.trigger('room_attention_update', {
      class_id: 7, total_faces: total, attentive, distracted: total - attentive, attention_pct: 0, monitoring_mode: 'full_attention',
    });
    update(0, 0);
    expect(screen.getByText('Nenhum rosto detectado')).toBeTruthy();
    expect(screen.queryByText('Analisando frame...')).toBeNull();
    update(2, 1);
    expect(screen.getByText(/1\/2 atentos/)).toBeTruthy();
    expect(screen.queryByText('Nenhum rosto detectado')).toBeNull();
    update(0, 0);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fechar Sala' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abrir Sala' })); });
    await flush();
    expect(screen.getByText('Analisando frame...')).toBeTruthy();
  });
});
