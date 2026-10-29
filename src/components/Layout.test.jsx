import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import Layout from './Layout';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'João Silva', role: 'student' }, logout: vi.fn() }),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('./ParticleField', () => ({
  default: () => <div data-testid="particle-field" />,
}));

describe('Layout — Responsividade e colapso da sidebar no mobile (#12 / V01)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('CA1 e CA6: conteúdo principal usa margem responsiva ml-0 md:ml-[240px] em vez de ml-[240px] fixo', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main.className).toContain('ml-0');
    expect(main.className).toContain('md:ml-[240px]');
    expect(main.className).not.toMatch(/(^|\s)ml-\[240px\](\s|$)/);
  });

  it('CA2: renderiza botão de menu mobile com aria-label="Abrir menu" e aria-expanded="false"', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Abrir menu' });
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('CA3: ao clicar no botão de menu, abre a gaveta com overlay e atualiza aria-expanded para true', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(button);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    const overlay = screen.getByTestId('sidebar-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.className).toContain('bg-black/50');
  });

  it('CA4: clicar no overlay fecha a gaveta e devolve foco ao botão de menu', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(button);
    expect(screen.getByTestId('sidebar-overlay')).toBeTruthy();

    const overlay = screen.getByTestId('sidebar-overlay');
    fireEvent.click(overlay);

    expect(screen.queryByTestId('sidebar-overlay')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('CA4: pressionar Escape com a gaveta aberta fecha a gaveta e devolve foco ao botão de menu', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(button);
    expect(screen.getByTestId('sidebar-overlay')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('sidebar-overlay')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('CA4: clicar em um link da sidebar fecha a gaveta no mobile', () => {
    render(
      <MemoryRouter>
        <Layout role="student">
          <div>Conteúdo</div>
        </Layout>
      </MemoryRouter>,
    );

    const button = screen.getByRole('button', { name: 'Abrir menu' });
    fireEvent.click(button);
    expect(screen.getByTestId('sidebar-overlay')).toBeTruthy();

    const navLink = screen.getByRole('link', { name: /Minhas Aulas/i });
    fireEvent.click(navLink);

    expect(screen.queryByTestId('sidebar-overlay')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
