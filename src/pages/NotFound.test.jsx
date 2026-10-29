import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';

const auth = vi.hoisted(() => ({ value: { user: null, loading: false } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

import NotFound from './NotFound';

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>raiz</p>} />
        <Route path="/login" element={<p>tela de login</p>} />
        <Route path="/teacher/dashboard" element={<p>painel do professor</p>} />
        <Route path="/student/dashboard" element={<p>painel do aluno</p>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('404 no modo escuro (#18)', () => {
  afterEach(() => {
    cleanup();
    auth.value = { user: null, loading: false };
  });

  it('CA1: fundo #0F172A, card #1E293B, título branco e texto slate-300 no modo escuro', () => {
    const { container } = renderAt('/rota-inexistente');
    const page = container.firstChild;
    const card = page.firstChild;
    expect(page.className).toContain('dark:bg-bg-dark'); // --color-bg-dark: #0F172A
    expect(card.className).toContain('dark:bg-surface-dark'); // --color-surface-dark: #1E293B
    expect(screen.getByRole('heading', { name: 'Página não encontrada' }).className).toContain('dark:text-white');
    expect(screen.getByText('A página que você procura não existe.').className).toContain('dark:text-slate-300');
    for (const el of [page, card]) expect(el.className).not.toMatch(/(^|\s)bg-white(\s|$)/);
  });

  it.each([
    [{ name: 'Ana', role: 'teacher' }, 'painel do professor'],
    [{ name: 'Bia', role: 'student' }, 'painel do aluno'],
    [null, 'tela de login'],
  ])('CA2: "Voltar ao início" leva ao destino do perfil (%o)', (user, destino) => {
    auth.value = { user, loading: false };
    renderAt('/rota-inexistente');
    const link = screen.getByRole('link', { name: 'Voltar ao início' });
    expect(link.className).toContain('bg-primary');
    expect(link.className).toContain('text-white');
    expect(link.className).toContain('focus-visible:ring');
    fireEvent.click(link);
    expect(screen.getByText(destino)).toBeTruthy();
  });

  it('CA5: em 375px o card ocupa a largura com margem de 16px, sem largura fixa', () => {
    const { container } = renderAt('/rota-inexistente');
    const page = container.firstChild;
    const card = page.firstChild;
    expect(page.className).toMatch(/(^|\s)p-4(\s|$)/);
    expect(card.className).toContain('w-full');
    expect(card.className).toContain('max-w-sm');
    expect(card.className).not.toMatch(/(^|\s)w-\[\d+px\]/);
  });
});
