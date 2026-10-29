import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act } from '@testing-library/react';
import { setupEnvironment, teardownEnvironment, flush, emitted, FakeMediaRecorder } from '../../test/attentionHarness';
import { renderRoutes } from '../../test/router';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

import api from '../../services/api';
import TeacherClassLive from './ClassLive';

const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' };
const LEAVE_TEXT = 'A aula continua ao vivo. Encerrar a aula também?';

let env;
beforeEach(() => {
  env = setupEnvironment();
  api.get.mockReset();
  api.patch.mockReset();
  api.get.mockResolvedValue({ data: { class: LIVE } });
  socket.current.connected = true;
  socket.current.emit.mockClear();
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
});

async function renderLive() {
  const utils = renderRoutes([
    { path: '/teacher/classes/:id/live', element: <TeacherClassLive /> },
    { path: '/teacher/dashboard', element: <p>Painel do professor</p> },
    { path: '/teacher/classes/:id/report', element: <p>Relatório</p> },
  ], '/teacher/classes/7/live');
  await flush();
  await flush();
  return utils;
}

const audioChunks = () => socket.current.emit.mock.calls.filter(([ev]) => ev === 'audio_chunk').map(([, p]) => p);

describe('Aula ao vivo do professor — reconexão (#3 CA8, F08)', () => {
  it('ao reconectar, emite join_class de novo e os eventos seguintes aparecem na tela', async () => {
    env.getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
    await renderLive();
    expect(emitted(socket.current)).toEqual([['join_class']]);

    socket.current.trigger('disconnect', 'transport close');
    socket.current.trigger('connect');
    expect(emitted(socket.current)).toEqual([['join_class'], ['join_class']]);

    socket.current.trigger('new_transcription', { class_id: 7, content: 'A fotossíntese ocorre nos cloroplastos.', timestamp: '2026-10-29T12:00:05Z' });
    socket.current.trigger('student_joined', { student_id: 3, student_name: 'Ana Souza' });
    expect(screen.getByText('A fotossíntese ocorre nos cloroplastos.')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
  });
});

describe('Aula ao vivo do professor — áudio (#9 CA2/CA3/CA10)', () => {
  it('CA2: sem câmera da sala, com o microfone permitido, grava e envia trechos de 5 s', async () => {
    await renderLive();
    expect(env.getUserMedia).toHaveBeenCalledWith({ audio: true });
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => { vi.advanceTimersByTime(5000); });
    // #4 CA1: cada trecho leva a duração real.
    expect(audioChunks()).toEqual([
      { class_id: 7, audio: 'QUJD', duration_ms: 5000 },
      { class_id: 7, audio: 'QUJD', duration_ms: 5000 },
    ]);
    expect(screen.getByText('Gravando')).toBeTruthy();
  });

  it('CA3 (erro): microfone negado mostra o aviso e não emite audio_chunk', async () => {
    env.getUserMedia.mockRejectedValue(Object.assign(new Error('negado'), { name: 'NotAllowedError' }));
    await renderLive();
    act(() => { vi.advanceTimersByTime(15000); });
    expect(screen.getByText('Não foi possível acessar o microfone. A aula continua, mas sem transcrição.')).toBeTruthy();
    expect(audioChunks()).toEqual([]);
  });

  it('CA10 (erro): PATCH /end falhando mantém a aula e o microfone gravando', async () => {
    await renderLive();
    api.patch.mockRejectedValue(new Error('Network Error'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar Aula' })); });
    expect(screen.getByText('Erro ao encerrar aula.')).toBeTruthy();
    expect(env.stream.track.stop).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(audioChunks()).toHaveLength(1);
    expect(screen.getByText('Gravando')).toBeTruthy();
  });

  it('CA10: PATCH /end com sucesso para o microfone e vai para o relatório, sem confirmação', async () => {
    await renderLive();
    api.patch.mockResolvedValue({ data: {} });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar Aula' })); });
    expect(api.patch).toHaveBeenCalledWith('/api/classes/7/end');
    expect(env.stream.track.stop).toHaveBeenCalled();
    expect(screen.getByText('Relatório')).toBeTruthy();
    expect(screen.queryByText(LEAVE_TEXT)).toBeNull();
    expect(FakeMediaRecorder.instances.every((r) => r.state === 'inactive')).toBe(true);
  });
});

describe('Aula ao vivo do professor — grade de alunos (#9 CA11)', () => {
  it('attention_status muda o status do card; student_left mostra o aluno fora da aula', async () => {
    await renderLive();
    socket.current.trigger('student_joined', { student_id: 3, student_name: 'Ana Souza' });
    expect(screen.getByText('Conectado')).toBeTruthy();
    socket.current.trigger('attention_status', { student_id: 3, status: 'distracted' });
    expect(screen.getByText('Desatento')).toBeTruthy();
    socket.current.trigger('attention_status', { student_id: 99, status: 'attentive' });
    expect(screen.queryByText('Atento')).toBeNull();
    socket.current.trigger('student_left', { student_id: 3, student_name: 'Ana Souza' });
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Fora da aula')).toBeTruthy();
    socket.current.trigger('student_joined', { student_id: 3, student_name: 'Ana Souza' });
    expect(screen.getByText('Conectado')).toBeTruthy();
  });
});

describe('Aula ao vivo do professor — sair com a aula ao vivo (#9 CA7/CA13)', () => {
  it('CA7: fechar ou recarregar a aba pede confirmação (beforeunload)', async () => {
    await renderLive();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('CA13/CA7: "← Painel" pede confirmação; "Sair sem encerrar" vai ao painel sem PATCH', async () => {
    await renderLive();
    fireEvent.click(screen.getByRole('button', { name: '← Painel' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(LEAVE_TEXT)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sair sem encerrar' })); });
    expect(screen.getByText('Painel do professor')).toBeTruthy();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('CA7: "Encerrar aula" no diálogo faz o PATCH /end e segue para o destino', async () => {
    await renderLive();
    api.patch.mockResolvedValue({ data: {} });
    fireEvent.click(screen.getByRole('button', { name: '← Painel' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar aula' })); });
    expect(api.patch).toHaveBeenCalledWith('/api/classes/7/end');
    expect(screen.getByText('Painel do professor')).toBeTruthy();
  });

  it('CA7 (erro): "Encerrar aula" com PATCH falhando fica na tela e avisa', async () => {
    await renderLive();
    api.patch.mockRejectedValue(new Error('Network Error'));
    fireEvent.click(screen.getByRole('button', { name: '← Painel' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar aula' })); });
    expect(screen.queryByText('Painel do professor')).toBeNull();
    expect(screen.getByText('Erro ao encerrar aula.')).toBeTruthy();
  });

  it('CA7: navegar por fora da tela (voltar/menu) também pede confirmação; "Continuar na aula" cancela', async () => {
    const { router } = await renderLive();
    await act(async () => { router.navigate('/teacher/dashboard'); });
    expect(screen.getByText(LEAVE_TEXT)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continuar na aula' })); });
    expect(screen.queryByText(LEAVE_TEXT)).toBeNull();
    expect(screen.queryByText('Painel do professor')).toBeNull();
    expect(router.state.location.pathname).toBe('/teacher/classes/7/live');
  });

  it('CA7: class_ended vindo do servidor vai para o relatório sem confirmação', async () => {
    await renderLive();
    socket.current.trigger('class_ended', { class_id: 7, ended_at: '2026-10-29T12:30:00Z' });
    await flush();
    expect(screen.getByText('Relatório')).toBeTruthy();
    expect(screen.queryByText(LEAVE_TEXT)).toBeNull();
  });
});

describe('Aula ao vivo do professor — duração (#9 CA14)', () => {
  it('mostra a duração com o formatador único', async () => {
    await renderLive();
    expect(screen.getByText('10 min')).toBeTruthy();
  });

  it('acima de 24 h, mostra o aviso de aula aberta', async () => {
    api.get.mockResolvedValue({ data: { class: { ...LIVE, started_at: '2026-10-28T09:50:00Z' } } });
    await renderLive();
    expect(screen.getByText('26 h 10 min')).toBeTruthy();
    expect(screen.getByText('Aula aberta há mais de 24 horas. Encerre-a se ela já terminou.')).toBeTruthy();
  });
});

describe('Aula ao vivo do professor — trechos de áudio (#4)', () => {
  it('CA3/CA8: ao encerrar, o último trecho sai com a duração real antes de liberar o microfone', async () => {
    await renderLive();
    act(() => { vi.advanceTimersByTime(5000); });
    act(() => { vi.advanceTimersByTime(3200); });
    api.patch.mockResolvedValue({ data: {} });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Encerrar Aula' })); });
    expect(audioChunks().map((c) => c.duration_ms)).toEqual([5000, 3200]);
    expect(env.stream.track.stop).toHaveBeenCalled();
  });

  it('CA7 (erro): sem conexão, descarta o trecho e troca o indicador; ao voltar, nada do período sai', async () => {
    await renderLive();
    socket.current.connected = false;
    socket.current.trigger('disconnect', 'transport close');
    expect(screen.getByText('Sem conexão — o áudio não está sendo enviado')).toBeTruthy();
    expect(screen.queryByText('Gravando')).toBeNull();
    act(() => { vi.advanceTimersByTime(10000); });
    expect(audioChunks()).toEqual([]);
    socket.current.connected = true;
    socket.current.trigger('connect');
    expect(screen.getByText('Gravando')).toBeTruthy();
    expect(audioChunks()).toEqual([]);
  });
});
