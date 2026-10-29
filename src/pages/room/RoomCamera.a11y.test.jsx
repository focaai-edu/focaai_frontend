import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupEnvironment, teardownEnvironment, flush } from '../../test/attentionHarness';
import { renderRoutes } from '../../test/router';
import { iconButtonsWithoutLabel } from '../../test/a11y';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../../services/socket', async () => {
  const { createFakeSocket, fakeSocketModule } = await import('../../test/attentionHarness');
  socket.current = createFakeSocket();
  return fakeSocketModule(socket.current);
});
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

import api from '../../services/api';
import RoomCamera from './RoomCamera';

const LIVE = { id: 7, title: 'Biologia', status: 'live', monitoring_mode: 'full_attention', started_at: '2026-10-29T11:50:00Z' };

beforeEach(() => {
  setupEnvironment();
  // Estes testes não dependem de tempo; o user-event trava com os timers falsos do harness.
  vi.useRealTimers();
  localStorage.setItem('foca_cameras', JSON.stringify([{ id: 'cam1', name: 'Webcam da sala', stream_url: '__webcam__' }]));
  localStorage.setItem('foca_active_camera_id', 'cam1');
  api.get.mockReset();
  api.get.mockResolvedValue({ data: { classes: [LIVE] } });
  socket.current.connected = true;
});
afterEach(() => {
  cleanup();
  teardownEnvironment();
  localStorage.clear();
});

async function renderRoom() {
  renderRoutes([
    { path: '/room', element: <RoomCamera /> },
    { path: '/teacher/dashboard', element: <p>Painel do professor</p> },
  ], '/room');
  await flush();
  await flush();
}
const keyboardUser = () => userEvent.setup();

describe('Câmera da sala — acessibilidade (#16)', () => {
  it('CA1/CA4: o botão de engrenagem tem aria-label e aria-expanded; a gaveta é um dialog rotulado', async () => {
    const user = keyboardUser();
    await renderRoom();
    const gear = screen.getByRole('button', { name: 'Configurações' });
    expect(gear.getAttribute('aria-expanded')).toBe('false');
    await user.click(gear);
    const drawer = screen.getByRole('dialog', { name: 'Configurações' });
    expect(drawer.getAttribute('aria-modal')).toBe('true');
    expect(gear.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Fechar configurações' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar câmera Webcam da sala' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remover câmera Webcam da sala' })).toBeTruthy();
    expect(iconButtonsWithoutLabel()).toEqual([]);
  });

  it('CA6: só teclado — abre a gaveta, adiciona câmera no modal, Escape fecha o modal e depois a gaveta', async () => {
    const user = keyboardUser();
    await renderRoom();
    const gear = screen.getByRole('button', { name: 'Configurações' });
    gear.focus();
    await user.keyboard('{Enter}');
    const drawer = screen.getByRole('dialog', { name: 'Configurações' });
    expect(drawer.contains(document.activeElement)).toBe(true);
    // Tab fica na gaveta.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(drawer.contains(document.activeElement)).toBe(true);
    }
    // A câmera da lista é selecionável pelo teclado.
    expect(screen.getByRole('button', { name: /Usar câmera Webcam da sala/ }).getAttribute('aria-pressed')).toBe('true');

    const add = screen.getByRole('button', { name: '+ Adicionar câmera' });
    add.focus();
    await user.keyboard('{Enter}');
    const modal = screen.getByRole('dialog', { name: 'Adicionar câmera' });
    expect(modal.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 8; i++) {
      await user.tab();
      expect(modal.contains(document.activeElement)).toBe(true);
    }
    expect(screen.getByRole('button', { name: 'Fechar janela' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Adicionar câmera' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeTruthy();
    expect(document.activeElement).toBe(add);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Configurações' })).toBeNull();
    expect(document.activeElement).toBe(gear);
  });

  it('diálogo de saída: é um dialog rotulado; Escape equivale a "Continuar na aula" e devolve o foco', async () => {
    const user = keyboardUser();
    await renderRoom();
    const back = screen.getByRole('button', { name: '← Painel' });
    back.focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'A aula continua ao vivo. Encerrar a aula também?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Painel do professor')).toBeNull();
    expect(document.activeElement).toBe(back);
  });
});
