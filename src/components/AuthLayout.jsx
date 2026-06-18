import ParticleField from './ParticleField';

// Animações compartilhadas pelas telas de auth (float dos cards, glow do logo,
// crescimento das barras, fade-in dos passos). Definidas uma vez aqui.
const styles = `
@keyframes foca-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes foca-float-2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
@keyframes foca-glow    { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.9;transform:scale(1.08)} }
@keyframes foca-bar     { from{width:0} }
@keyframes foca-rise    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@media (prefers-reduced-motion: reduce){ .foca-anim{animation:none!important} }
`;

// ── Brand mark — cérebro dentro de um anel de foco (atenção + IA) ──────────────
export function BrandMark({ size = 56 }) {
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="foca-anim absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(74,144,217,.55), transparent 70%)',
          animation: 'foca-glow 3.5s ease-in-out infinite',
        }}
      />
      <span className="absolute inset-0 rounded-full border border-[#4A90D9]/40" />
      <span className="absolute rounded-full border border-[#4A90D9]/20" style={{ inset: -7 }} />
      <img src="/cerebro.png" alt="" className="relative w-2/3 h-2/3 object-contain brightness-0 invert" />
    </div>
  );
}

// Logotipo textual reutilizável.
export function Wordmark({ className = '' }) {
  return (
    <span className={`font-bold text-white tracking-tight ${className}`}>
      foca<span className="text-[#4A90D9]">.</span>ai
    </span>
  );
}

/**
 * AuthLayout — casca visual compartilhada por Login e Register: fundo radial,
 * partículas, e o par "marketing (esquerda) + formulário (direita)" centralizado
 * num container de largura máxima.
 *
 * @param {ReactNode} left    conteúdo de marketing (esquerda, oculto no mobile)
 * @param {string}    tagline subtítulo da marca compacta exibida no mobile
 * @param {ReactNode} children card do formulário (direita)
 */
export default function AuthLayout({ left, tagline, children }) {
  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: 'radial-gradient(circle at top, #183b73, #07122f 70%)' }}
    >
      <style>{styles}</style>
      <ParticleField className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative z-10 h-full w-full max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 xl:gap-24">
        {/* Esquerda — marketing (some no mobile) */}
        <section className="hidden lg:flex flex-col justify-center gap-10 flex-1 min-w-0">
          {left}
        </section>

        {/* Direita — formulário */}
        <section className="flex items-center justify-center w-full lg:w-auto lg:flex-shrink-0">
          <div className="w-full max-w-sm lg:w-[380px]">
            {/* Marca compacta — só quando a coluna de marketing some (mobile) */}
            <div className="flex lg:hidden flex-col items-center text-center mb-8">
              <BrandMark size={56} />
              <Wordmark className="mt-3 text-3xl" />
              {tagline && <p className="text-[#94A3B8] text-sm mt-1">{tagline}</p>}
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
