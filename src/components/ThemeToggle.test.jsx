import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { THEME_KEY } from '../lib/theme';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Ana Lima', role: 'teacher' }, logout: vi.fn() }),
}));

import ThemeToggle from './ThemeToggle';
import Sidebar from './Sidebar';

const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

describe('seletor de tema (#18, V18)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    document.documentElement.classList.remove('dark');
  });
  afterEach(cleanup);

  it('mostra o tema ativo, não a ação: em modo escuro "Escuro" está marcado e não existe "Modo Claro"', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(<ThemeToggle />);
    expect(screen.getByRole('group', { name: 'Tema' })).toBeTruthy();
    expect(pressed('Escuro')).toBe('true');
    expect(pressed('Claro')).toBe('false');
    expect(screen.queryByText(/Modo Claro|Modo Escuro/)).toBeNull();
  });

  it('cada opção tem o próprio ícone: sol em "Claro", lua em "Escuro"', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Claro' }).querySelector('[data-icon="sun"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escuro' }).querySelector('[data-icon="moon"]')).toBeTruthy();
  });

  it('escolher "Escuro" aplica a classe dark no <html>, grava a escolha e move a marcação', () => {
    render(<ThemeToggle />);
    expect(pressed('Claro')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(pressed('Escuro')).toBe('true');
    expect(pressed('Claro')).toBe('false');
  });

  it('sem escolha gravada, segue o sistema e não grava nada', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    render(<ThemeToggle />);
    expect(pressed('Escuro')).toBe('true');
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('a sidebar usa o seletor no rodapé', () => {
    localStorage.setItem(THEME_KEY, 'dark');
    render(<MemoryRouter><Sidebar role="teacher" /></MemoryRouter>);
    expect(screen.getByRole('group', { name: 'Tema' })).toBeTruthy();
    expect(pressed('Escuro')).toBe('true');
    expect(screen.queryByText(/Modo Claro|Modo Escuro/)).toBeNull();
  });
});
