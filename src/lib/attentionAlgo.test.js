import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { isDistracted, computeHeadPose, computeEAR } from './attentionAlgo';

// Frame atento de referência: cabeça reta e olhos abertos.
const ATTENTIVE = { yaw: 0, pitch: 0, ear: 0.3 };

function decide(overrides, mode) {
  const f = { ...ATTENTIVE, ...overrides };
  return isDistracted(f.yaw, f.pitch, f.ear, mode);
}

describe('isDistracted (RF03/RF04)', () => {
  // [modo, yaw máx., pitch p/ cima máx., pitch p/ baixo máx. (null = permitido), EAR mín.]
  const cases = [
    ['full_attention', 25, 20, 15, 0.2],
    ['activity', 25, 25, null, 0.18],
    ['exam', 20, 20, null, 0.22],
  ];

  describe.each(cases)('modo %s', (mode, yaw, pitchUp, pitchDown, ear) => {
    it('frame reto e olhos abertos é atento', () => {
      expect(decide({}, mode)).toBe(false);
    });

    it('yaw acima do limite é desatento, nos dois lados', () => {
      expect(decide({ yaw: yaw }, mode)).toBe(false);
      expect(decide({ yaw: yaw + 1 }, mode)).toBe(true);
      expect(decide({ yaw: -(yaw + 1) }, mode)).toBe(true);
    });

    it('pitch para cima acima do limite é desatento', () => {
      expect(decide({ pitch: pitchUp }, mode)).toBe(false);
      expect(decide({ pitch: pitchUp + 1 }, mode)).toBe(true);
    });

    it('pitch para baixo segue a regra do modo', () => {
      if (pitchDown === null) {
        expect(decide({ pitch: -60 }, mode)).toBe(false);
      } else {
        expect(decide({ pitch: -pitchDown }, mode)).toBe(false);
        expect(decide({ pitch: -(pitchDown + 1) }, mode)).toBe(true);
      }
    });

    it('EAR abaixo do limite é desatento', () => {
      expect(decide({ ear: ear }, mode)).toBe(false);
      expect(decide({ ear: ear - 0.01 }, mode)).toBe(true);
    });
  });

  it('intervalo (break) é sempre atento', () => {
    expect(decide({ yaw: 90, pitch: -90, ear: 0 }, 'break')).toBe(false);
  });
});

describe('computeHeadPose (RF01)', () => {
  it('matriz identidade dá yaw, pitch e roll iguais a 0', () => {
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const pose = computeHeadPose(identity);
    expect(pose.yaw).toBeCloseTo(0);
    expect(pose.pitch).toBeCloseTo(0);
    expect(pose.roll).toBeCloseTo(0);
  });

  it.each([[undefined], [null], [[]], [[1, 0, 0]]])('entrada %j devolve zeros sem lançar erro', (m) => {
    expect(computeHeadPose(m)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });
});

// Matriz 4×4 column-major de uma rotação 3×3 (r[linha][coluna]).
function columnMajor(r) {
  return [
    r[0][0], r[1][0], r[2][0], 0,
    r[0][1], r[1][1], r[2][1], 0,
    r[0][2], r[1][2], r[2][2], 0,
    0, 0, 0, 1,
  ];
}
const rad = (deg) => (deg * Math.PI) / 180;
// Rotação em torno do eixo vertical (virar para os lados).
function rotY(deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return columnMajor([[c, 0, s], [0, 1, 0], [-s, 0, c]]);
}
// Rotação em torno do eixo lateral (inclinar para cima/baixo).
function rotX(deg) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return columnMajor([[1, 0, 0], [0, c, -s], [0, s, c]]);
}

describe('computeHeadPose com rotação conhecida (RF01, #8 CA10)', () => {
  it('30° no eixo vertical dá |yaw| = 30, pitch e roll em 0', () => {
    const pose = computeHeadPose(rotY(30));
    expect(Math.abs(Math.abs(pose.yaw) - 30)).toBeLessThan(0.5);
    expect(Math.abs(pose.pitch)).toBeLessThan(0.5);
    expect(Math.abs(pose.roll)).toBeLessThan(0.5);
  });

  it('−20° no eixo lateral (cabeça para baixo) dá pitch = −20', () => {
    const pose = computeHeadPose(rotX(-20));
    expect(Math.abs(pose.pitch - -20)).toBeLessThan(0.5);
    expect(Math.abs(pose.yaw)).toBeLessThan(0.5);
  });
});

// 478 landmarks com os dois olhos no formato pedido: largura 1 e altura `ratio`.
function eyes(ratio) {
  const lm = Array.from({ length: 478 }, () => ({ x: 0, y: 0 }));
  for (const [p0, p1, p2, p3, p4, p5] of [[33, 160, 158, 133, 153, 144], [362, 385, 387, 263, 373, 380]]) {
    lm[p0] = { x: 0, y: 0 };
    lm[p3] = { x: 1, y: 0 };
    lm[p1] = { x: 0.3, y: -ratio / 2 };
    lm[p5] = { x: 0.3, y: ratio / 2 };
    lm[p2] = { x: 0.7, y: -ratio / 2 };
    lm[p4] = { x: 0.7, y: ratio / 2 };
  }
  return lm;
}

describe('computeEAR (RF02, #8 CA11/CA12)', () => {
  it('olhos abertos dão 0,3 e fechados dão 0,05', () => {
    expect(Math.abs(computeEAR(eyes(0.3)) - 0.3)).toBeLessThan(0.01);
    expect(Math.abs(computeEAR(eyes(0.05)) - 0.05)).toBeLessThan(0.01);
  });

  it('landmark de olho ausente conta como olho aberto (1.0)', () => {
    const lm = eyes(0.05);
    delete lm[160];
    // esquerdo vira 1.0, direito continua 0.05
    expect(Math.abs(computeEAR(lm) - (1.0 + 0.05) / 2)).toBeLessThan(0.01);
  });

  it('largura zero (p0 = p3) conta como olho aberto, sem lançar erro', () => {
    const lm = eyes(0.05);
    lm[133] = { ...lm[33] };
    expect(Math.abs(computeEAR(lm) - (1.0 + 0.05) / 2)).toBeLessThan(0.01);
  });
});

describe('worker e attentionAlgo calculam igual (#8 CA13)', () => {
  // O worker é um script clássico servido de public/; roda aqui num contexto vm.
  const code = readFileSync(resolve(process.cwd(), 'public/attention-worker.js'), 'utf8');
  const ctx = vm.createContext({ self: {}, console });
  vm.runInContext(code, ctx);

  it.each([
    ['identidade', rotY(0)],
    ['yaw 30°', rotY(30)],
    ['yaw −40°', rotY(-40)],
    ['pitch −20°', rotX(-20)],
    ['pitch 25°', rotX(25)],
  ])('pose: %s', (_, m) => {
    const a = computeHeadPose(m), b = ctx.computeHeadPose(m);
    for (const k of ['yaw', 'pitch', 'roll']) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.01);
  });

  it.each([[0.3], [0.05]])('EAR com razão %s', (ratio) => {
    expect(Math.abs(computeEAR(eyes(ratio)) - ctx.computeEAR(eyes(ratio)))).toBeLessThan(0.01);
  });
});
