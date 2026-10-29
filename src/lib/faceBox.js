import { STATUS_COLORS } from './colors';
import { STATUS_LABELS } from './labels';

/**
 * Traça um retângulo com cantos arredondados no canvas de forma compatível.
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Computa a caixa delimitadora do rosto a partir dos landmarks normalizados (0..1).
 *
 * @param {Float32Array|Array<number>} landmarks - Coordenadas normalizadas [x0, y0, x1, y1, ...]
 * @param {Object|number} dimensionsOrWidth - { width, height } ou largura numérica
 * @param {Object|number} [heightOrOptions] - Altura numérica ou objeto de opções
 * @param {Object} [maybeOptions] - { margin = 0.10, mirrored = false }
 * @returns {{ x: number, y: number, width: number, height: number }|null}
 */
export function computeFaceBox(landmarks, dimensionsOrWidth, heightOrOptions, maybeOptions) {
  if (!landmarks || landmarks.length < 2) return null;

  let width, height, options;
  if (typeof dimensionsOrWidth === 'object' && dimensionsOrWidth !== null) {
    width = dimensionsOrWidth.width;
    height = dimensionsOrWidth.height;
    options = { ...dimensionsOrWidth, ...(heightOrOptions || {}) };
  } else {
    width = dimensionsOrWidth;
    height = heightOrOptions;
    options = maybeOptions || {};
  }

  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    return null;
  }

  const margin = typeof options.margin === 'number' ? options.margin : 0.10;
  const mirrored = Boolean(options.mirrored);

  const n = Math.floor(landmarks.length / 2);
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const x = landmarks[i * 2];
    const y = landmarks[i * 2 + 1];
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    validCount++;
  }

  if (validCount === 0 || minX > maxX || minY > maxY) return null;

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const dx = rawW * margin;
  const dy = rawH * margin;

  const normMinX = Math.max(0, minX - dx);
  const normMaxX = Math.min(1, maxX + dx);
  const normMinY = Math.max(0, minY - dy);
  const normMaxY = Math.min(1, maxY + dy);

  const boxWNorm = normMaxX - normMinX;
  const boxHNorm = normMaxY - normMinY;

  // Quando o vídeo da câmera está espelhado horizontalmente (scale(-1, 1)),
  // o ponto da direita normMaxX do vídeo original é mapeado para (1 - normMaxX) na tela.
  const xNorm = mirrored ? (1 - normMaxX) : normMinX;

  return {
    x: Math.round(xNorm * width),
    y: Math.round(normMinY * height),
    width: Math.round(boxWNorm * width),
    height: Math.round(boxHNorm * height),
  };
}

/**
 * Desenha a caixa delimitadora do rosto e a etiqueta de status no canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - Contexto 2D do canvas
 * @param {{ x: number, y: number, width: number, height: number }} box - Retângulo em pixels
 * @param {'attentive'|'distracted'|'no_camera'|string} [status='attentive'] - Status de atenção
 */
export function drawFaceBox(ctx, box, status = 'attentive') {
  if (!ctx || !box) return;

  const color = STATUS_COLORS[status] || STATUS_COLORS.attentive;
  const label = STATUS_LABELS[status] || STATUS_LABELS.attentive;

  ctx.save();

  // 1. Caixa com cantos levemente arredondados e traço 3px
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, box.x, box.y, box.width, box.height, 8);
  ctx.stroke();

  // 2. Etiqueta curta com status no topo da caixa (estilo /room)
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  const textMetrics = ctx.measureText(label);
  const padX = 8;
  const badgeH = 22;
  const badgeW = Math.round(textMetrics.width + padX * 2);
  const badgeX = box.x;
  // Posiciona acima da caixa se houver espaço; caso contrário, dentro do topo da caixa
  const badgeY = box.y >= badgeH + 6 ? box.y - badgeH - 4 : box.y + 4;

  ctx.fillStyle = color;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  ctx.fill();

  // Texto de alto contraste sobre o badge colorido (dark slate #0F172A)
  ctx.fillStyle = '#0F172A';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + padX, badgeY + badgeH / 2);

  ctx.restore();
}
