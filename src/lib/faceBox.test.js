import { describe, it, expect, vi } from 'vitest';
import { computeFaceBox, drawFaceBox } from './faceBox';
import { STATUS_COLORS } from './colors';
import { STATUS_LABELS } from './labels';

describe('computeFaceBox (cálculo puro da caixa delimitadora do rosto #55)', () => {
  it('retorna null quando landmarks forem nulos, indefinidos ou vazios', () => {
    expect(computeFaceBox(null, { width: 640, height: 480 })).toBeNull();
    expect(computeFaceBox(undefined, { width: 640, height: 480 })).toBeNull();
    expect(computeFaceBox([], { width: 640, height: 480 })).toBeNull();
    expect(computeFaceBox(new Float32Array([]), { width: 640, height: 480 })).toBeNull();
    expect(computeFaceBox([NaN, NaN], { width: 640, height: 480 })).toBeNull();
  });

  it('retorna null se as dimensões forem inválidas ou zero', () => {
    const lms = new Float32Array([0.2, 0.2, 0.4, 0.4]);
    expect(computeFaceBox(lms, { width: 0, height: 480 })).toBeNull();
    expect(computeFaceBox(lms, { width: 640, height: -10 })).toBeNull();
  });

  it('calcula o retângulo em pixels com margem de 10% (sem espelhamento)', () => {
    // Face de [0.2, 0.3] a [0.4, 0.7]
    // rawWidth = 0.2, rawHeight = 0.4
    // margin 10%: dx = 0.02, dy = 0.04
    // normMinX = 0.18, normMaxX = 0.42 -> boxWidth = 0.24
    // normMinY = 0.26, normMaxY = 0.74 -> boxHeight = 0.48
    // Com width=1000, height=1000:
    // x = 180, width = 240, y = 260, height = 480
    const lms = new Float32Array([
      0.2, 0.3, // canto sup esq
      0.4, 0.3, // canto sup dir
      0.2, 0.7, // canto inf esq
      0.4, 0.7, // canto inf dir
    ]);

    const box = computeFaceBox(lms, { width: 1000, height: 1000 }, { mirrored: false });
    expect(box).toEqual({
      x: 180,
      y: 260,
      width: 240,
      height: 480,
    });
  });

  it('espelha as coordenadas horizontais quando mirrored = true (respeita espelhamento de webcam)', () => {
    // Mesma face: normMinX = 0.18, normMaxX = 0.42
    // Com mirrored = true, o ponto da direita normMaxX vira borda esquerda:
    // xNorm = 1 - 0.42 = 0.58
    // Com width=1000:
    // x = 580, width = 240 (span de 580 a 820)
    // No vídeo original não espelhado, span era 180 a 420 (1000 - 420 = 580, 1000 - 180 = 820)
    const lms = new Float32Array([
      0.2, 0.3,
      0.4, 0.7,
    ]);

    const box = computeFaceBox(lms, { width: 1000, height: 1000 }, { mirrored: true });
    expect(box).toEqual({
      x: 580,
      y: 260,
      width: 240,
      height: 480,
    });
  });

  it('funciona passando dimensões como argumentos posicionais ou objeto', () => {
    const lms = new Float32Array([0.2, 0.3, 0.4, 0.7]);
    const boxFromObj = computeFaceBox(lms, { width: 640, height: 480, mirrored: true });
    const boxFromArgs = computeFaceBox(lms, 640, 480, { mirrored: true });
    expect(boxFromObj).toEqual(boxFromArgs);
  });

  it('restringe a expansão da margem aos limites do frame [0, 1]', () => {
    // Face encostada nas bordas 0 e 1
    const lms = new Float32Array([
      0.02, 0.05,
      0.98, 0.95,
    ]);

    const box = computeFaceBox(lms, { width: 1000, height: 1000 });
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1000);
    expect(box.y + box.height).toBeLessThanOrEqual(1000);
  });
});

describe('drawFaceBox (renderização da caixa no canvas #55)', () => {
  function createMockCtx() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 45 })),
      roundRect: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textBaseline: '',
    };
  }

  it('não desenha se ctx ou box forem nulos', () => {
    const ctx = createMockCtx();
    drawFaceBox(null, { x: 10, y: 10, width: 100, height: 100 });
    drawFaceBox(ctx, null);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('desenha a caixa com traço de 3px e cor verde para status atento', () => {
    const ctx = createMockCtx();
    const box = { x: 100, y: 100, width: 200, height: 250 };
    drawFaceBox(ctx, box, 'attentive');

    expect(ctx.lineWidth).toBe(3);
    expect(ctx.strokeStyle).toBe(STATUS_COLORS.attentive);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(STATUS_LABELS.attentive, expect.any(Number), expect.any(Number));
  });

  it('desenha a caixa com cor âmbar para status desatento', () => {
    const ctx = createMockCtx();
    const box = { x: 100, y: 100, width: 200, height: 250 };
    drawFaceBox(ctx, box, 'distracted');

    expect(ctx.lineWidth).toBe(3);
    expect(ctx.strokeStyle).toBe(STATUS_COLORS.distracted);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(STATUS_LABELS.distracted, expect.any(Number), expect.any(Number));
  });

  it('desenha a caixa com cor neutra para status sem câmera', () => {
    const ctx = createMockCtx();
    const box = { x: 100, y: 100, width: 200, height: 250 };
    drawFaceBox(ctx, box, 'no_camera');

    expect(ctx.lineWidth).toBe(3);
    expect(ctx.strokeStyle).toBe(STATUS_COLORS.no_camera);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(STATUS_LABELS.no_camera, expect.any(Number), expect.any(Number));
  });
});
