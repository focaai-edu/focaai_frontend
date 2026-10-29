import { chromium } from '@playwright/test';
import { buildClips } from './clips.js';
import { assertChromium } from './env.js';

export default function globalSetup() {
  // Falha cedo, com a instrução, se o navegador não estiver instalado (#40).
  assertChromium(process.env.E2E_CHROMIUM || chromium.executablePath());
  buildClips();
}
