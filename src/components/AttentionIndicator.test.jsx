import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AttentionIndicator from './AttentionIndicator';

afterEach(cleanup);

describe('AttentionIndicator', () => {
  it('mostra o rótulo do status', () => {
    render(<AttentionIndicator status="no_camera" />);
    expect(screen.getByText('Sem câmera')).toBeTruthy();
  });

  it('status desconhecido cai em "Desconectado"', () => {
    render(<AttentionIndicator status="xyz" />);
    expect(screen.getByText('Desconectado')).toBeTruthy();
  });
});
