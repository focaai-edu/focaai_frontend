import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    // O e2e (Playwright, e2e/) roda à parte com `npm run test:e2e` (#11).
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
