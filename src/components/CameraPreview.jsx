import { useEffect, useRef } from 'react';
import { computeFaceBox, drawFaceBox } from '../lib/faceBox';

function drawHUD(ctx, pose, w, h) {
  const PAD = 10, BW = 150, BH = 72;
  const bx = PAD, by = h - PAD - BH;

  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx, by, BW, BH);

  ctx.font = '10px monospace';
  const rows = [
    { label: 'Yaw  ', v: pose.yaw,   max: 30 },
    { label: 'Pitch', v: pose.pitch, max: 25 },
    { label: 'Roll ', v: pose.roll,  max: 35 },
  ];
  rows.forEach(({ label, v, max }, i) => {
    const y = by + 18 + i * 19;
    const pct = Math.min(Math.abs(v) / max, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(bx + 74, y - 9, 68, 10);
    ctx.fillStyle = pct > 0.85 ? 'rgb(239, 68, 68)' : pct > 0.6 ? 'rgb(245, 158, 11)' : 'rgb(34, 197, 94)';
    ctx.fillRect(bx + 74, y - 9, Math.round(68 * pct), 10);
    ctx.fillStyle = 'rgb(255, 255, 255)';
    ctx.fillText(`${label}: ${Math.round(v).toString().padStart(4)}°`, bx + 7, y);
  });
}

export default function CameraPreview({ videoRef, source, error, landmarksRef, poseRef, status = 'attentive' }) {
  const canvasRef = useRef(null);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!videoRef?.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    let animId;

    function draw() {
      if (video.readyState >= 2) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const { width: w, height: h } = canvas;

        // Desenha vídeo espelhado horizontalmente
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();

        // Desenha caixa delimitadora do rosto com etiqueta de status (#55)
        // Fora do espelhamento do canvas para que a etiqueta de texto não fique invertida
        const lm = landmarksRef?.current;
        if (lm && lm.length >= 2) {
          const box = computeFaceBox(lm, { width: w, height: h, mirrored: true });
          if (box) {
            drawFaceBox(ctx, box, statusRef.current);
          }
        }

        // Desenha HUD de ângulos (fora do espelhamento — posição absoluta)
        const pose = poseRef?.current;
        if (pose) drawHUD(ctx, pose, w, h);
      }
      animId = requestAnimationFrame(draw);
    }

    if (source === 'webcam') draw();
    return () => { if (animId) cancelAnimationFrame(animId); };
  }, [videoRef, source]);

  return (
    <div className="relative inline-block">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="w-full max-w-[640px] rounded-xl border-2 border-slate-700 bg-surface-dark"
        width="640"
        height="480"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
          <p role="alert" className="text-red-500 text-sm text-center p-4">{error}</p>
        </div>
      )}
      {source && !error && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-black/60 text-white text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {source === 'webcam' ? 'Webcam' : 'Câmera da sala'}
        </div>
      )}
    </div>
  );
}
