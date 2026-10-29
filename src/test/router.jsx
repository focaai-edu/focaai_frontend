// Renderiza rotas num data router em memória (necessário para useBlocker).
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

// No jsdom, o AbortSignal vem do jsdom e o Request vem do Node, que recusa esse
// signal ao navegar. Nos testes, o Request é criado sem ele.
if (!globalThis.Request.__fakeSignalSafe) {
  const NodeRequest = globalThis.Request;
  class SignalSafeRequest extends NodeRequest {
    constructor(input, init = {}) {
      const { signal, ...rest } = init; // eslint-disable-line no-unused-vars
      super(input, rest);
    }
  }
  SignalSafeRequest.__fakeSignalSafe = true;
  globalThis.Request = SignalSafeRequest;
}

export function renderRoutes(routes, initialPath) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(<RouterProvider router={router} />);
  return { ...utils, router };
}
