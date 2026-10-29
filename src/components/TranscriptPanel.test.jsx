import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../services/api';
import TranscriptPanel from './TranscriptPanel';

beforeEach(() => { api.get.mockReset(); });
afterEach(cleanup);

async function renderPanel() {
  render(<TranscriptPanel classId={7} />);
  await act(async () => {});
}

describe('TranscriptPanel (#5 CA10)', () => {
  it('erro de rede mostra "Não foi possível carregar." e "Tentar de novo" recarrega', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { request: {} }));
    await renderPanel();
    expect(screen.getByText('Não foi possível carregar.')).toBeTruthy();
    api.get.mockResolvedValue({ data: { transcriptions: [{ content: 'Olá turma', timestamp_start: '2026-10-29T13:00:00Z' }] } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    expect(screen.queryByText('Não foi possível carregar.')).toBeNull();
    expect(screen.getByText(/Transcrição completa da aula/)).toBeTruthy();
  });

  it('403 (não participou) continua sem renderizar nada', async () => {
    api.get.mockImplementation(async () => { throw Object.assign(new Error('403'), { response: { status: 403 } }); });
    await renderPanel();
    expect(screen.queryByText('Não foi possível carregar.')).toBeNull();
    expect(screen.queryByText(/Transcrição completa/)).toBeNull();
  });
});
