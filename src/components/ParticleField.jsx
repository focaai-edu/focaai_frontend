import { useRef, useEffect } from 'react';

/**
 * ParticleField — rede de pontos luminosos que se movem lentamente e se conectam
 * por linhas quando próximos (efeito "constelação"). Dá a sensação imediata de
 * IA/análise sem nenhuma dependência: canvas puro, ~70 partículas.
 *
 * Respeita prefers-reduced-motion: desenha um quadro estático e não anima.
 */
export default function ParticleField({ className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf, w = 0, h = 0, dots = [];

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, w * DPR);
      canvas.height = Math.max(1, h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const count = Math.min(75, Math.max(24, Math.floor((w * h) / 14000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      }));
    };

    const draw = (animate) => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        if (animate) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > w) a.vx *= -1;
          if (a.y < 0 || a.y > h) a.vy *= -1;
        }
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            ctx.strokeStyle = `rgba(74,144,217,${(1 - dist / 120) * 0.18})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.shadowColor = 'rgba(74,144,217,0.8)';
      ctx.shadowBlur = 6;
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125,184,240,0.7)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      if (animate) raf = requestAnimationFrame(() => draw(true));
    };

    resize();
    draw(!reduced);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
