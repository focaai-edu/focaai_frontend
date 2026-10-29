import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLatestRequest } from './useLatestRequest';

describe('useLatestRequest (#35 CA9, F23)', () => {
  it('com duas requisições, só a mais nova é a válida, mesmo respondendo antes', async () => {
    const { result } = renderHook(() => useLatestRequest());
    const applied = [];
    const run = async (label, ms) => {
      const req = result.current();
      await new Promise((r) => setTimeout(r, ms));
      if (req.isLatest()) applied.push(label);
    };
    // a 1ª responde por último: não pode sobrescrever a 2ª.
    await Promise.all([run('primeira', 30), run('segunda', 5)]);
    expect(applied).toEqual(['segunda']);
  });

  it('uma requisição sozinha é sempre a mais nova', async () => {
    const { result } = renderHook(() => useLatestRequest());
    const req = result.current();
    expect(req.isLatest()).toBe(true);
  });
});
