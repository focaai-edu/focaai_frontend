// Clipes da câmera falsa (#11). Gera .y4m (yuv420p, 640x480, 15 fps) em e2e/.cache a
// partir de fixtures, com o ffmpeg do pacote ffmpeg-static. O Chromium recusa .y4m
// que não seja 4:2:0 (NotFoundError no getUserMedia), por isso o cabeçalho é conferido.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';

export const E2E_DIR = new URL('.', import.meta.url).pathname;
export const CACHE_DIR = join(E2E_DIR, '.cache');
const FACE = join(E2E_DIR, 'fixtures', 'face.jpg');
const OUT = ['-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe'];

// Clipes sintéticos a partir da foto: [nome, segmentos [tipo, segundos]].
export const SYNTHETIC = {
  frente: [['face', 20]],
  fora: [['face', 8], ['empty', 10], ['face', 12]],
};

export const clipPath = (name) => join(CACHE_DIR, `${name}.y4m`);

function segmentArgs(segments) {
  const inputs = [];
  const filters = [];
  segments.forEach(([kind, secs], i) => {
    if (kind === 'face') inputs.push('-loop', '1', '-t', String(secs), '-i', FACE);
    else inputs.push('-f', 'lavfi', '-t', String(secs), '-i', 'color=c=gray:s=640x480:r=15');
    filters.push(`[${i}:v]scale=640:480,fps=15,format=yuv420p,setsar=1[v${i}]`);
  });
  const concat = segments.map((_, i) => `[v${i}]`).join('') + `concat=n=${segments.length}:v=1[out]`;
  return [...inputs, '-filter_complex', `${filters.join(';')};${concat}`, '-map', '[out]'];
}

export function assertYuv420(path) {
  const fd = openSync(path, 'r');
  const head = Buffer.alloc(80);
  readSync(fd, head, 0, 80, 0);
  closeSync(fd);
  const line = head.toString('latin1').split('\n')[0];
  if (!/ C420/.test(line)) throw new Error(`fixture ${path}: formato de pixel deve ser yuv420p (cabeçalho: ${line})`);
}

export function buildClips() {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const [name, segments] of Object.entries(SYNTHETIC)) {
    const out = clipPath(name);
    // Só refaz se a foto mudou depois do .y4m.
    if (!existsSync(out) || statSync(out).mtimeMs < statSync(FACE).mtimeMs) {
      execFileSync(ffmpeg, ['-loglevel', 'error', '-y', ...segmentArgs(segments), ...OUT, out]);
    }
    assertYuv420(out);
  }
}
