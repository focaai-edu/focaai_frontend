import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import TeacherClassReport, { ATTENTION_CHART_CONFIG } from './ClassReport';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Prof. Ana', role: 'teacher' } }),
}));

// Mock do TranscriptPanel e Layout para focar no gráfico e relatório
vi.mock('../../components/Layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('../../components/TranscriptPanel', () => ({
  default: () => <div data-testid="transcript-panel" />,
}));

// Mock do ResizeObserver exigido pelo ResponsiveContainer do Recharts no jsdom
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Relatório do Professor — Calibração do Gráfico de Atenção (#14 / V19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('CA1 e CA2: configuração do eixo Y define domínio [0, 100], ticks fixos e formatação percentual', () => {
    expect(ATTENTION_CHART_CONFIG).toBeDefined();
    expect(ATTENTION_CHART_CONFIG.yAxis.domain).toEqual([0, 100]);
    expect(ATTENTION_CHART_CONFIG.yAxis.ticks).toEqual([0, 25, 50, 75, 100]);

    const formatter = ATTENTION_CHART_CONFIG.yAxis.tickFormatter;
    expect(formatter(0)).toBe('0%');
    expect(formatter(25)).toBe('25%');
    expect(formatter(50)).toBe('50%');
    expect(formatter(75)).toBe('75%');
    expect(formatter(100)).toBe('100%');

    // Garante que todos os ticks produzidos são únicos (sem repetições como 0%, 5%)
    const formattedTicks = ATTENTION_CHART_CONFIG.yAxis.ticks.map(formatter);
    const uniqueTicks = new Set(formattedTicks);
    expect(uniqueTicks.size).toBe(5);
  });

  it('CA3: caso de borda com atenção 0% ou 100% não altera a escala fixa do eixo Y', () => {
    // A configuração estática do YAxis impede que o Recharts encolha ou recalibre os ticks
    const domain = ATTENTION_CHART_CONFIG.yAxis.domain;
    const ticks = ATTENTION_CHART_CONFIG.yAxis.ticks;
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBe(100);
    expect(ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it('CA4: eixo X formata os minutos com sufixo "m"', () => {
    const xFormatter = ATTENTION_CHART_CONFIG.xAxis.tickFormatter;
    expect(xFormatter(0)).toBe('0m');
    expect(xFormatter(5)).toBe('5m');
    expect(xFormatter(45)).toBe('45m');
  });

  it('Evita corte dos dígitos do eixo Y: margem esquerda do gráfico é >= 0', () => {
    // Margem negativa (como left: -16) empurrava o texto para fora do SVG, cortando "100%" para "0%" e "75%" para "5%"
    expect(ATTENTION_CHART_CONFIG.margin.left).toBeGreaterThanOrEqual(0);
  });

  it('Renderiza o relatório com o gráfico quando há dados de timeline', async () => {
    const api = (await import('../../services/api')).default;
    api.get.mockResolvedValueOnce({
      data: {
        id: 18,
        title: 'Fotossíntese e Respiração Celular',
        duration_minutes: 45,
        started_at: '2026-10-29T14:00:00Z',
        overview: {
          average_attention_percentage: 80,
          total_distraction_events: 11,
          total_summaries: 11,
          monitoring_modes_used: [
            { mode: 'full_attention', started_at: '2026-10-29T14:00:00Z' },
            { mode: 'exam', started_at: '2026-10-29T14:30:00Z' },
          ],
        },
        students: [
          { student_id: 1, student_name: 'João Silva', attention_percentage: 93.3 },
        ],
        attention_timeline: [
          { minute: 0, attention_pct: 85 },
          { minute: 5, attention_pct: 90 },
          { minute: 10, attention_pct: 75 },
        ],
      },
    });

    render(
      <MemoryRouter initialEntries={['/teacher/classes/18/report']}>
        <Routes>
          <Route path="/teacher/classes/:id/report" element={<TeacherClassReport />} />
        </Routes>
      </MemoryRouter>,
    );

    // Aguarda carregar dados
    const title = await screen.findByText('Fotossíntese e Respiração Celular');
    expect(title).toBeTruthy();
    expect(screen.getByText('Atenção da turma ao longo da aula')).toBeTruthy();
    expect(screen.getByText('% de alunos atentos a cada minuto')).toBeTruthy();
  });
});
