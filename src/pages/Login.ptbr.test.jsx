import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const login = vi.fn();
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false, login }) }));
vi.mock('../components/AuthLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

import Login from './Login';

afterEach(cleanup);

async function submit(user) {
  await user.type(screen.getByLabelText(/E-?mail/i), 'joao@foca.ai');
  await user.type(screen.getByLabelText(/Senha/i), 'errada');
  await act(async () => { await user.click(screen.getByRole('button', { name: /Entrar/ })); });
}

describe('Login — mensagem de erro (#19 CA1, V12)', () => {
  it('credenciais incorretas (401) mostram "E-mail ou senha inválidos."', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue({ response: { status: 401, data: { error: 'Email ou senha invalidos.' } } });
    render(<MemoryRouter><Login /></MemoryRouter>);
    await submit(user);
    expect(screen.getByText('E-mail ou senha inválidos.')).toBeTruthy();
    expect(screen.queryByText(/invalidos/)).toBeNull();
  });

  it('sem resposta do servidor continua com a mensagem genérica', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('Network Error'));
    render(<MemoryRouter><Login /></MemoryRouter>);
    await submit(user);
    expect(screen.getByText('Erro ao fazer login. Tente novamente.')).toBeTruthy();
  });
});
