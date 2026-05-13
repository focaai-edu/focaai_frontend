import { useEffect, useRef } from 'react';

// MediaPipe FaceMesh contour index sets
const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];
const LEFT_EYE  = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
const RIGHT_EYE = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398];
const LIPS      = [61,146,91,181,84,17,314,405,321,375,291,308,324,318,402,317,14,87,178,88,95];
const L_BROW    = [55,65,52,53,46];
const R_BROW    = [285,295,282,283,276];
const NOSE      = [168,6,197,195,5,4,1,19,94];

function pt(buf, i, w, h) {
  return [buf[i * 2] * w, buf[i * 2 + 1] * h];
}

function contour(ctx, buf, w, h, indices, color, lw, close = true) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  const [x0, y0] = pt(buf, indices[0], w, h);
  ctx.moveTo(x0, y0);
  for (let i = 1; i < indices.length; i++) {
    const [x, y] = pt(buf, indices[i], w, h);
    ctx.lineTo(x, y);
  }
  if (close) ctx.closePath();
  ctx.stroke();
}

function drawMesh(ctx, buf, w, h) {
  const n = buf.length / 2;
  ctx.fillStyle = 'rgba(200,200,200,0.7)';
  for (let i = 0; i < n; i++) {
    const [x, y] = pt(buf, i, w, h);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  contour(ctx, buf, w, h, FACE_OVAL, 'rgba(200,200,200,0.5)',  1.5);
  contour(ctx, buf, w, h, LEFT_EYE,  'rgba(50,220,100,0.95)', 1.8);
  contour(ctx, buf, w, h, RIGHT_EYE, 'rgba(50,220,100,0.95)', 1.8);
  contour(ctx, buf, w, h, LIPS,      'rgba(50,220,100,0.85)', 1.5);
  contour(ctx, buf, w, h, L_BROW,    'rgba(50,220,100,0.9)',  1.8, false);
  contour(ctx, buf, w, h, R_BROW,    'rgba(50,220,100,0.9)',  1.8, false);
  contour(ctx, buf, w, h, NOSE,      'rgba(50,220,100,0.75)', 1.2, false);
}

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
    ctx.fillStyle = pct > 0.85 ? '#ef4444' : pct > 0.6 ? '#f59e0b' : '#22c55e';
    ctx.fillRect(bx + 74, y - 9, Math.round(68 * pct), 10);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${label}: ${Math.round(v).toString().padStart(4)}°`, bx + 7, y);
  });
}

export default function CameraPreview({ videoRef, source, error, landmarksRef, poseRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!videoRef?.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;

    function draw() {
      if (video.readyState >= 2) {
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        const { width: w, height: h } = canvas;

        // Draw mirrored video + face mesh (inside mirror transform)
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        const lm = landmarksRef?.current;
        if (lm) drawMesh(ctx, lm, w, h);
        ctx.restore();

        // Draw angle HUD (outside mirror transform — absolute position)
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
        className="w-full max-w-[640px] rounded-xl border-2 border-gray-200 bg-[#1E293B]"
        width="640"
        height="480"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-xl">
          <p className="text-red-500 text-sm text-center p-4">{error}</p>
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
