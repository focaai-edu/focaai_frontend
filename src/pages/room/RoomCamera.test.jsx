import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act } from '@testing-library/react';
import { setupEnvironment, teardownEnvironment, flush, FakeMediaRecorder } from '../../test/attentionHarness';
import { renderRoutes } from '../../test/router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

import api from '../../services/api';
import RoomCamera from './RoomCamera';

const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' };
const LEAVE_TEXT = 'A aula continua ao vivo. Encerrar a aula também?';

let env;
beforeEach(() => {
  env = setupEnvironment();
  localStorage.setItem('foca_cameras', JSON.stringify([{ id: 'cam1', name: 'Webcam', stream_url: '__webcam__' }]));
  localStorage.setItem('foca_active_camera_id', 'cam1');
  api.get.mockReset();
  api.patch.mockReset();
  api.get.mockResolvedValue({ data: { classes: [LIVE] } });
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
  localStorage.clear();
});

async function renderRoom() {
  const utils = renderRoutes([
    { path: '/room', element: <RoomCamera /> },
    { path: '/teacher/dashboard', element: <p>Painel do professor</p> },
  ], '/room');
  await flush();
  await flush();
  return utils;
}

async function openRoom() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abrir Sala' })); });
  await flush();
}

const emittedEvents = () => socket.current.emit.mock.calls.map(([ev]) => ev);

describe('Câmera da sala — aula ao vivo (#9 CA7/CA9/CA13)', () => {
  it('CA7: com aula ao vivo selecionada, fechar a aba pede confirmação', async () => {
    await renderRoom();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('CA7: "Fechar Sala" pergunta; "Sair sem encerrar" fecha a sala sem PATCH', async () => {
    await renderRoom();
    await openRoom();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Sala' }));
    expect(screen.getByText(LEAVE_TEXT)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    expect(screen.getByRole('button', { name: 'Abrir Sala' })).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('CA7: "Fechar Sala" → "Encerrar aula" faz o PATCH e fecha a sala', async () => {
    await renderRoom();
    await openRoom();
    api.patch.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Sala' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar aula' })); });
    expect(api.patch).toHaveBeenCalledWith('/api/classes/7/end');
    expect(screen.getByRole('button', { name: 'Abrir Sala' })).toBeTruthy();
  });

  it('CA13: "← Painel" pede confirmação e, sem encerrar, volta ao painel', async () => {
    await renderRoom();
    fireEvent.click(screen.getByRole('button', { name: '← Painel' }));
    expect(screen.getByText(LEAVE_TEXT)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    expect(screen.getByText('Painel do professor')).toBeTruthy();
  });

  it('CA9: class_ended da aula fecha a sala, avisa e recarrega a lista', async () => {
    await renderRoom();
    await openRoom();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(emittedEvents()).toContain('audio_chunk');
    api.get.mockClear();
    api.get.mockResolvedValue({ data: { classes: [] } });
    socket.current.trigger('class_ended', { class_id: 7, ended_at: '2026-10-29T12:30:00Z' });
    await flush();
    expect(screen.getByText('A aula foi encerrada.')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/api/classes', { params: { status: 'live' } });
    expect(env.stream.track.stop).toHaveBeenCalled();
    socket.current.emit.mockClear();
    act(() => { vi.advanceTimersByTime(15000); });
    expect(emittedEvents()).not.toContain('room_frame');
    expect(emittedEvents()).not.toContain('audio_chunk');
    // Sem aula ao vivo, sair não pergunta mais.
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('CA9 (erro): class_ended de outra aula não fecha a sala', async () => {
    await renderRoom();
    await openRoom();
    socket.current.trigger('class_ended', { class_id: 99, ended_at: '2026-10-29T12:30:00Z' });
    await flush();
    expect(screen.queryByText('A aula foi encerrada.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar Sala' })).toBeTruthy();
  });
});

describe('Câmera da sala — trechos de áudio (#4)', () => {
  const audioChunks = () => socket.current.emit.mock.calls.filter(([ev]) => ev === 'audio_chunk').map(([, p]) => p);

  it('CA2: os trechos levam duration_ms medido', async () => {
    await renderRoom();
    await openRoom();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(audioChunks()).toEqual([{ class_id: 7, audio: 'QUJD', duration_ms: 5000 }]);
  });

  it('CA5: trecho com 500 bytes ou menos não é enviado (antes /room enviava)', async () => {
    FakeMediaRecorder.size = 500;
    await renderRoom();
    await openRoom();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(audioChunks()).toEqual([]);
  });

  it('CA8 (F10): "Fechar Sala" envia o trecho em curso com a duração real', async () => {
    await renderRoom();
    await openRoom();
    act(() => { vi.advanceTimersByTime(2600); });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar Sala' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    expect(audioChunks()).toEqual([{ class_id: 7, audio: 'QUJD', duration_ms: 2600 }]);
    expect(env.stream.track.stop).toHaveBeenCalled();
  });

  it('CA7 (erro): sem conexão, descarta e mostra o aviso', async () => {
    await renderRoom();
    await openRoom();
    socket.current.connected = false;
    socket.current.trigger('disconnect', 'transport close');
    expect(screen.getByText(/Sem conexão — o áudio não está sendo enviado/)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(audioChunks()).toEqual([]);
  });
});
