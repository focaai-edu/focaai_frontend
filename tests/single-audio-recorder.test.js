// @vitest-environment node
// #4 CA6 (F26): a gravação de áudio existe num lugar só (useAudioChunks).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(js|jsx)$/.test(name) && !/\.test\.(js|jsx)$/.test(name) ? [p] : [];
  });
}

describe('gravação de áudio única (#4 CA6)', () => {
  it('nenhuma página cria MediaRecorder por conta própria', () => {
    const offenders = sources(join(root, 'src/pages')).filter((f) => readFileSync(f, 'utf8').includes('new MediaRecorder'));
    expect(offenders).toEqual([]);
  });

  it('as duas telas que gravam usam useAudioChunks', () => {
    for (const page of ['src/pages/teacher/ClassLive.jsx', 'src/pages/room/RoomCamera.jsx']) {
      expect(readFileSync(join(root, page), 'utf8')).toContain('useAudioChunks(');
    }
  });
});
