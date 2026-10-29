import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dialog from './Dialog';

afterEach(cleanup);

function Harness({ onCloseSpy = () => {} }) {
  const [open, setOpen] = useState(false);
  const close = () => { onCloseSpy(); setOpen(false); };
  return (
    <div>
      <button type="button">Antes</button>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <button type="button">Depois</button>
      {open && (
        <Dialog titleId="t" onClose={close}>
          <h2 id="t">Nova Aula</h2>
          <input aria-label="Título" />
          <button type="button" disabled>Desabilitado</button>
          <button type="button" onClick={close}>Cancelar</button>
          <button type="button">Salvar</button>
        </Dialog>
      )}
    </div>
  );
}

describe('Dialog (#16 CA1–CA3)', () => {
  it('CA1: role="dialog", aria-modal e aria-labelledby apontando para o título', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Nova Aula' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('t');
  });

  it('CA2: ao abrir, o foco entra no diálogo; Tab e Shift+Tab ficam presos dentro dele', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    expect(screen.getByLabelText('Título')).toBe(document.activeElement);
    for (let i = 0; i < 7; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Desabilitado' }));
    screen.getByLabelText('Título').focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Salvar' }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText('Título'));
  });

  it('CA3: Escape fecha e devolve o foco a quem abriu', async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<Harness onCloseSpy={spy} />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.keyboard('{Escape}');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }));
  });

  it('CA3: fechar por um botão de dentro também devolve o foco', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }));
  });

  it('diálogo aninhado: Escape fecha só o de cima, e o foco volta para dentro do de baixo', async () => {
    const user = userEvent.setup();
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return (
        <>
          {outer && (
            <Dialog titleId="o" onClose={() => setOuter(false)}>
              <h2 id="o">Configurações</h2>
              <button type="button" onClick={() => setInner(true)}>Adicionar câmera</button>
            </Dialog>
          )}
          {inner && (
            <Dialog titleId="i" onClose={() => setInner(false)}>
              <h2 id="i">Nova câmera</h2>
              <input aria-label="Nome" />
            </Dialog>
          )}
        </>
      );
    }
    render(<Nested />);
    await user.click(screen.getByRole('button', { name: 'Adicionar câmera' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Nome'));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Nova câmera' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Configurações' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Adicionar câmera' }));
  });

  it('CA3: com um campo autoFocus, o foco ainda volta para quem abriu', async () => {
    const user = userEvent.setup();
    function WithAutoFocus() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Abrir</button>
          {open && (
            <Dialog titleId="a" onClose={() => setOpen(false)}>
              <h2 id="a">Nova Aula</h2>
              <input aria-label="Título" autoFocus />
            </Dialog>
          )}
        </>
      );
    }
    render(<WithAutoFocus />);
    await user.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Título'));
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir' }));
  });
});
