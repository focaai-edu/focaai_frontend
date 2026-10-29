import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../../components/TranscriptPanel', () => ({ default: () => null }));
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

import api from '../../services/api';
import TeacherClassReport from './ClassReport';

const ENDED = '2026-10-29T13:30:00Z';

function report(distraction_events) {
  return {
    class_id: 7, title: 'Biologia', duration_minutes: 30, started_at: '2026-10-29T13:00:00Z', ended_at: ENDED, status: 'ended',
    overview: { average_attention_percentage: 80, total_distraction_events: distraction_events.length, total_summaries: 0, monitoring_modes_used: [] },
    attention_timeline: [],
    students: [{
      student_id: 3, student_name: 'Ana Souza', attention_percentage: 80, time_attentive_minutes: 20, time_distracted_minutes: 2,
      time_no_camera_minutes: 0, times_left_and_returned: 0, distraction_events,
    }],
  };
}

async function renderReport() {
  render(
    <MemoryRouter initialEntries={['/teacher/classes/7/report']}>
      <Routes><Route path="/teacher/classes/:id/report" element={<TeacherClassReport />} /></Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
}
const reportCalls = () => api.get.mock.calls.filter(([u]) => u === '/api/classes/7/report').length;
const expandAna = () => fireEvent.click(screen.getByText('Ana Souza'));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(Date.parse(ENDED) + 10 * 60000);
  api.get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Relatório do professor — distrações e resumos (#5)', () => {
  it('CA8: duração da distração em segundos e prévia do resumo sem marcadores Markdown', async () => {
    api.get.mockResolvedValue({ data: report([
      { started_at: '2026-10-29T13:05:00Z', ended_at: '2026-10-29T13:05:20Z', duration_seconds: 20, summary: '**Luz** e água' },
      { started_at: '2026-10-29T13:10:00Z', ended_at: '2026-10-29T13:11:35Z', duration_seconds: 95, summary: null },
    ]) });
    await renderReport();
    expandAna();
    expect(screen.getByText('(20 s)')).toBeTruthy();
    expect(screen.getByText('(1 min 35 s)')).toBeTruthy();
    expect(screen.getByText('Luz e água')).toBeTruthy();
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('CA11: logo depois do fim, com distração sem resumo, recarrega a cada 5 s até chegar', async () => {
    vi.setSystemTime(Date.parse(ENDED) + 5000);
    let summary = null;
    api.get.mockImplementation(async () => ({ data: report([{ started_at: '2026-10-29T13:05:00Z', ended_at: '2026-10-29T13:06:00Z', duration_seconds: 60, summary }]) }));
    await renderReport();
    expandAna();
    expect(screen.getByText('Gerando resumo…')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(reportCalls()).toBe(2);
    summary = 'Resumo pronto';
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Resumo pronto')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(reportCalls()).toBe(3);
  });

  it('CA11: passado 60 s do fim, para de recarregar', async () => {
    vi.setSystemTime(Date.parse(ENDED) + 58000);
    api.get.mockResolvedValue({ data: report([{ started_at: '2026-10-29T13:05:00Z', ended_at: '2026-10-29T13:06:00Z', duration_seconds: 60, summary: null }]) });
    await renderReport();
    await act(async () => { vi.advanceTimersByTime(5000); });
    const calls = reportCalls();
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(reportCalls()).toBe(calls);
    expandAna();
    expect(screen.getByText('Resumo não disponível para este trecho.')).toBeTruthy();
  });

  it('CA10 (erro): servidor fora mostra "Não foi possível carregar." e "Tentar de novo" refaz', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('502'), { response: { status: 502 } }));
    await renderReport();
    expect(screen.getByText('Não foi possível carregar.')).toBeTruthy();
    expect(screen.queryByText(/A aula precisa ser encerrada primeiro/)).toBeNull();
    api.get.mockResolvedValue({ data: report([]) });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' })); });
    await act(async () => {});
    expect(screen.getByText('Ana Souza')).toBeTruthy();
  });

  it('CA10: 4xx (aula não encerrada) continua com a mensagem de estado vazio', async () => {
    api.get.mockRejectedValue(Object.assign(new Error('400'), { response: { status: 400 } }));
    await renderReport();
    expect(screen.getByText(/A aula precisa ser encerrada primeiro/)).toBeTruthy();
  });
});
