import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';

const socket = vi.hoisted(() => ({ current: null }));
vi.mock('../services/socket', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});

import ServerErrorAlert from './ServerErrorAlert';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const wait = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('ServerErrorAlert (#3 CA9/CA10, F17)', () => {
  it('CA9: error { message } aparece num role="alert" por pelo menos 5 s e depois some', () => {
    render(<ServerErrorAlert />);
    expect(screen.queryByRole('alert')).toBeNull();
    socket.current.trigger('error', { message: 'Erro ao processar audio' });
    expect(screen.getByRole('alert').textContent).toContain('Erro ao processar audio');
    wait(5000);
    expect(screen.getByRole('alert').textContent).toContain('Erro ao processar audio');
    wait(1100);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('CA10: error sem message mostra "Ocorreu um erro no servidor."', () => {
    render(<ServerErrorAlert />);
    socket.current.trigger('error', {});
    expect(screen.getByRole('alert').textContent).toContain('Ocorreu um erro no servidor.');
    socket.current.trigger('error', undefined);
    expect(screen.getByRole('alert').textContent).toContain('Ocorreu um erro no servidor.');
  });

  it('CA9: um erro novo substitui o anterior e reinicia o prazo', () => {
    render(<ServerErrorAlert />);
    socket.current.trigger('error', { message: 'primeiro' });
    wait(4000);
    socket.current.trigger('error', { message: 'segundo' });
    wait(4000);
    expect(screen.getByRole('alert').textContent).toContain('segundo');
    expect(screen.getByRole('alert').textContent).not.toContain('primeiro');
  });

  it('CA9: ao desmontar, para de ouvir o error', () => {
    const { unmount } = render(<ServerErrorAlert />);
    unmount();
    socket.current.trigger('error', { message: 'x' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
