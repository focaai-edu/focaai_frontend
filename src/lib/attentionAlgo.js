// attentionAlgo.js — núcleo COMPARTILHADO do algoritmo de atenção.
//
// Fonte única de verdade da decisão "atento vs. desatento", usada por:
//   - /room e /room-test (câmera da sala, agregado anônimo) — RoomCamera/RoomCameraTest
//   - webcam individual do aluno — hooks/useAttention.js
//
// Qualquer ajuste de threshold/pose/EAR aqui vale para TODOS os fluxos, garantindo
// que o mesmo rosto seja classificado de forma idêntica em qualquer tela.

// Thresholds por modo de monitoramento (graus para pose, razão para EAR).
export const MODE_THRESHOLDS = {
  full_attention: { yaw: 25, pitch_up: 20, pitch_down: 15, ear: 0.20 },
  activity:       { yaw: 25, pitch_up: 25, pitch_down: null, ear: 0.18 },
  exam:           { yaw: 20, pitch_up: 20, pitch_down: null, ear: 0.22 },
  break:          null,
};

export const MODE_LABELS = {
  full_attention: 'Atenção total',
  activity: 'Atividade',
  exam: 'Prova',
  break: 'Intervalo',
};

// Deriva yaw/pitch/roll (graus) da matriz de transformação facial do MediaPipe.
export function computeHeadPose(m) {
  if (!m || m.length < 16) return { yaw: 0, pitch: 0, roll: 0 };
  const RAD2DEG = 180 / Math.PI;
  const sy = Math.sqrt(m[0] * m[0] + m[1] * m[1]);
  return {
    yaw:   Math.atan2(-m[2], sy) * RAD2DEG,
    pitch: Math.atan2(m[6], m[10]) * RAD2DEG,
    roll:  Math.atan2(m[1], m[0]) * RAD2DEG,
  };
}

// Eye Aspect Ratio médio dos dois olhos a partir dos 478 landmarks.
export function computeEAR(landmarks) {
  const L = [33, 160, 158, 133, 153, 144];
  const R = [362, 385, 387, 263, 373, 380];
  function ear(idx) {
    const p = idx.map(i => landmarks[i]);
    if (p.some(x => !x)) return 1.0;
    const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
    const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
    const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
    return C === 0 ? 1.0 : (A + B) / (2 * C);
  }
  return (ear(L) + ear(R)) / 2;
}

// Decide se um rosto está desatento dado pose/EAR e o modo ativo.
// Instantâneo (por frame). Mesma decisão para /room e webcam do aluno.
export function isDistracted(yaw, pitch, ear, mode) {
  const t = MODE_THRESHOLDS[mode || 'full_attention'];
  if (!t) return false; // break — sem monitoramento
  if (Math.abs(yaw) > t.yaw) return true;
  if (t.pitch_up !== null && pitch > t.pitch_up) return true;
  if (t.pitch_down !== null && pitch < -t.pitch_down) return true;
  if (t.ear !== null && ear < t.ear) return true;
  return false;
}

// Cores do indicador de % de atenção (verde/âmbar/vermelho).
export function pctColor(pct) {
  if (pct >= 75) return { text: 'text-green-400', hex: '#22C55E', bg: 'bg-green-500/90' };
  if (pct >= 50) return { text: 'text-amber-400', hex: '#F59E0B', bg: 'bg-amber-500/90' };
  return { text: 'text-red-400', hex: '#EF4444', bg: 'bg-red-500/90' };
}
