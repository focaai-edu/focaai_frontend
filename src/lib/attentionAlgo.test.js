import { describe, it, expect } from 'vitest';
import { isDistracted, computeHeadPose } from './attentionAlgo';

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
