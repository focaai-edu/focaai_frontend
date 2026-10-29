import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { setupEnvironment, teardownEnvironment, flush } from '../test/attentionHarness';
import { renderRoutes } from '../test/router';
import StudentClassLive from './student/ClassLive';
import TeacherClassLive from './teacher/ClassLive';

const socket = vi.hoisted(() => ({ current: null }));
const LIVE_CLASS = vi.hoisted(() => ({
  id: 24,
  title: 'Fotossíntese Avançada',
  status: 'live',
  monitoring_mode: 'full_attention',
  started_at: '2026-10-29T11:50:00Z',
}));

vi.mock('../services/socket', async () => {
  const { createFakeSocket } = await import('../test/attentionHarness');
  socket.current = createFakeSocket();
  return { default: socket.current };
});

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import api from '../services/api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Usuário Teste', role: 'student' } }),
}));

describe('Responsividade das telas de aula ao vivo no mobile (#13 / V02 / V20)', () => {
  beforeEach(() => {
    setupEnvironment();
    api.get.mockReset();
    api.patch.mockReset();
    api.get.mockResolvedValue({ data: { class: LIVE_CLASS } });
    socket.current.connected = true;
    socket.current.emit.mockClear();
  });

  afterEach(() => {
    cleanup();
    teardownEnvironment();
  });

  async function renderStudentLive() {
    render(
      <MemoryRouter initialEntries={['/student/classes/24/live']}>
        <Routes>
          <Route path="/student/classes/:id/live" element={<StudentClassLive />} />
          <Route path="/student/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await flush();
    await flush();
  }

  async function renderTeacherLive() {
    const utils = renderRoutes([
      { path: '/teacher/classes/:id/live', element: <TeacherClassLive /> },
      { path: '/teacher/dashboard', element: <p>Dashboard</p> },
      { path: '/teacher/classes/:id/report', element: <p>Relatório</p> },
    ], '/teacher/classes/24/live');
    await flush();
    await flush();
    return utils;
  }

  describe('Tela do Aluno (/student/classes/:id/live) — CA1, CA2 e CA5', () => {
    it('CA1: o container principal usa layout empilhado flex-col no mobile e flex-row no desktop (flex-col md:flex-row)', async () => {
      await renderStudentLive();

      const transcriptionHeading = screen.getByText('Transcrição ao vivo');
      const transcriptionCol = transcriptionHeading.closest('div[class*="border"]');
      const mainContainer = transcriptionCol?.parentElement;

      expect(mainContainer).toBeTruthy();
      expect(mainContainer.className).toContain('flex-col');
      expect(mainContainer.className).toContain('md:flex-row');
    });

    it('CA1 e CA2: transcrição no mobile ocupa largura total w-full md:w-[300px] em vez de w-[300px] fixo', async () => {
      await renderStudentLive();

      const transcriptionHeading = screen.getByText('Transcrição ao vivo');
      const transcriptionCol = transcriptionHeading.closest('div[class*="border"]');

      expect(transcriptionCol).toBeTruthy();
      expect(transcriptionCol.className).toContain('w-full');
      expect(transcriptionCol.className).toContain('md:w-[300px]');
      expect(transcriptionCol.className).not.toMatch(/(^|\s)w-\[300px\](\s|$)/);
    });

    it('CA1 e CA5: a área do monitor de atenção/câmera não fica restrita a coluna esmagada e usa largura flexível total', async () => {
      await renderStudentLive();

      const transcriptionHeading = screen.getByText('Transcrição ao vivo');
      const transcriptionCol = transcriptionHeading.closest('div[class*="border"]');
      const cameraCol = transcriptionCol?.previousElementSibling;

      expect(cameraCol).toBeTruthy();
      expect(cameraCol.className).toContain('w-full');
    });
  });

  describe('Tela do Professor (/teacher/classes/:id/live) — CA3, CA4 e CA5', () => {
    it('CA3: a barra de modos de monitoramento usa overflow-x-auto e flex-nowrap para não truncar botões', async () => {
      await renderTeacherLive();

      const btnFull = screen.getByRole('button', { name: 'Atenção total' });
      const modeBar = btnFull.parentElement;

      expect(modeBar).toBeTruthy();
      expect(modeBar.className).toContain('overflow-x-auto');
      expect(modeBar.className).toContain('flex-nowrap');

      // Botões devem ter whitespace-nowrap e flex-shrink-0
      expect(btnFull.className).toContain('whitespace-nowrap');
      expect(btnFull.className).toContain('flex-shrink-0');
    });

    it('CA4: o conteúdo principal empilha turma e transcrição verticalmente no mobile (flex-col md:flex-row)', async () => {
      await renderTeacherLive();

      const transcriptionHeading = screen.getByText('Transcrição');
      const transcriptionCol = transcriptionHeading.closest('div[class*="border"]');
      const mainContainer = transcriptionCol?.parentElement;

      expect(mainContainer).toBeTruthy();
      expect(mainContainer.className).toContain('flex-col');
      expect(mainContainer.className).toContain('md:flex-row');

      // Transcrição e alunos ocupam w-full no mobile
      expect(transcriptionCol.className).toContain('w-full');
      const studentsCol = transcriptionCol?.previousElementSibling;
      expect(studentsCol).toBeTruthy();
      expect(studentsCol.className).toContain('w-full');
    });
  });
});
