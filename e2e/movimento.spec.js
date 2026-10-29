// e2e #11 — cenários com movimento real. Aguardam os clipes gravados pelo dono;
// quando existirem em e2e/fixtures/*.mp4, viram testes como os de frente.spec.js.
import { test } from '@playwright/test';

const WAITING = 'aguarda clipes reais (gravador em localhost:8765)';

test.describe('cenários com movimento real', () => {
  test.skip(true, WAITING);
  test('CA6: virar ~45° → Desatento → Atento', async () => {});
  test('CA7/CA8: cabeça para baixo em full_attention → Desatento; em exam → só Atento', async () => {});
  test('CA9: olhos fechados → Desatento → Atento', async () => {});
  test('CA13: validação dos valores de cada trecho do roteiro', async () => {});
});
