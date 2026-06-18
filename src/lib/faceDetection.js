// faceDetection.js — detecção de rostos com TILING, compartilhada entre a /room
// (ao vivo) e a /room-teste (imagem estática). Fonte ÚNICA da estratégia de
// detecção, assim como attentionAlgo.js é a fonte única da classificação.
//
// POR QUÊ TILING: o detector short-range do FaceLandmarker não acha rostos
// pequenos numa cena ampla (sala cheia). Dividimos a imagem numa grade NxN com
// sobreposição e rodamos o MESMO modelo em cada pedaço (o rosto fica grande em
// relação ao pedaço → detectável); depois juntamos tudo e removemos duplicatas
// por IoU/contenção. Com grid=1 vira uma única detecção da imagem inteira
// (comportamento leve, ~custo de 1 detect()).
//
// IMPORTANTE: o landmarker precisa ter sido criado com runningMode 'IMAGE'
// (usa fl.detect(), não detectForVideo()).

// Área de interseção de dois boxes normalizados {x,y,w,h}.
function interArea(a, b) {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ix * iy;
}
// IoU clássico.
function iou(a, b) {
  const inter = interArea(a, b);
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}
// Sobreposição relativa ao MENOR box — pega contenção (cabelo dentro/colado no
// rosto) que o IoU não pega quando os tamanhos são muito diferentes.
function overlapMin(a, b) {
  const inter = interArea(a, b);
  const minArea = Math.min(a.w * a.h, b.w * b.h);
  return minArea > 0 ? inter / minArea : 0;
}

/**
 * Detecta rostos com tiling.
 *
 * @param {FaceLandmarker} fl       landmarker em runningMode 'IMAGE'
 * @param {CanvasImageSource} source <video>, <img> ou canvas já desenhável
 * @param {number} W                largura natural da fonte (px)
 * @param {number} H                altura natural da fonte (px)
 * @param {number} grid             N da grade NxN (1 = sem tiling)
 * @param {HTMLCanvasElement} capture canvas scratch p/ desenhar cada pedaço
 * @returns {{ faces: Array<{lm, mat, box}>, raw: number }}
 *          faces: rostos ÚNICOS (box em coords normalizadas da imagem inteira);
 *          raw: nº de candidatos antes do dedupe (diagnóstico).
 */
export function detectFacesTiled(fl, source, W, H, grid, capture) {
  const ctx = capture.getContext('2d');

  // Detecta numa sub-região [sx,sy,sw,sh] (px da fonte), ampliando o pedaço para
  // o modelo. Devolve faces com landmarks BRUTOS (tile-normalizados, p/ pose/EAR)
  // + box em coords normalizadas da IMAGEM INTEIRA (p/ desenho/dedupe).
  const detectRegion = (sx, sy, sw, sh) => {
    const scale = Math.max(1, 480 / Math.min(sw, sh));
    const cw = Math.round(sw * scale), ch = Math.round(sh * scale);
    capture.width = cw;
    capture.height = ch;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, cw, ch);
    let res;
    try { res = fl.detect(capture); } catch { return []; }
    const mats = res.facialTransformationMatrixes || [];
    const lms  = res.faceLandmarks || [];
    const n = Math.max(mats.length, lms.length);
    const out = [];
    for (let k = 0; k < n; k++) {
      const lm = lms[k], mat = mats[k];
      let box = null;
      if (lm?.length) {
        const xs = lm.map(p => (sx + p.x * sw) / W);
        const ys = lm.map(p => (sy + p.y * sh) / H);
        box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      }
      out.push({ lm, mat, box });
    }
    return out;
  };

  // 1) imagem inteira (pega rostos grandes/próximos)
  let candidates = detectRegion(0, 0, W, H);
  // 2) grade NxN com 30% de sobreposição (pega rostos pequenos)
  if (grid > 1) {
    const baseW = W / grid, baseH = H / grid;
    const ovx = baseW * 0.3, ovy = baseH * 0.3;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const sx = Math.max(0, Math.round(c * baseW - ovx));
        const sy = Math.max(0, Math.round(r * baseH - ovy));
        const ex = Math.min(W, Math.round((c + 1) * baseW + ovx));
        const ey = Math.min(H, Math.round((r + 1) * baseH + ovy));
        candidates = candidates.concat(detectRegion(sx, sy, ex - sx, ey - sy));
      }
    }
  }

  // NMS guloso: maior primeiro; descarta detecção que sobrepõe (IoU > 0.3) OU
  // está contida (overlapMin > 0.6) numa já mantida. Mata "rosto + cabelo" e o
  // mesmo rosto pego no full + em vários tiles.
  const unique = [];
  candidates
    .filter(f => f.box)
    .sort((a, b) => (b.box.w * b.box.h) - (a.box.w * a.box.h))
    .forEach(f => {
      const dup = unique.some(u => iou(u.box, f.box) > 0.3 || overlapMin(u.box, f.box) > 0.6);
      if (!dup) unique.push(f);
    });

  return { faces: unique, raw: candidates.length };
}

// Nº de chamadas detect() para uma dada grade (diagnóstico de custo).
export function tileCount(grid) {
  return 1 + (grid > 1 ? grid * grid : 0);
}
