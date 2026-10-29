// ── Brand mark — cérebro com estilo clean flat (Direção A) ──────────────
export function BrandMark({ size = 56 }) {
  return (
    <div
      className="relative flex items-center justify-center rounded-2xl bg-primary-900/60 border border-slate-700/60"
      style={{ width: size, height: size }}
    >
      <img src="/cerebro.png" alt="" className="w-3/5 h-3/5 object-contain brightness-0 invert" />
    </div>
  );
}

// Logotipo textual reutilizável com token semântico text-secondary.
export function Wordmark({ className = '' }) {
  return (
    <span className={`font-bold text-white tracking-tight ${className}`}>
      foca<span className="text-secondary">.</span>ai
    </span>
  );
}

/**
 * AuthLayout — layout de autenticação na Direção A (Foco Total / flat):
 * fundo sólido sem partículas ou gradientes cósmicos, superfícies neutras.
 */
export default function AuthLayout({ left, tagline, children }) {
  return (
    <div className="relative min-h-screen bg-bg-dark flex flex-col justify-center">
      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-10 py-8 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 xl:gap-24">
        {/* Esquerda — marketing / contexto (some no mobile) */}
        {left && (
          <section className="hidden lg:flex flex-col justify-center gap-8 flex-1 min-w-0">
            {left}
          </section>
        )}

        {/* Direita — formulário */}
        <section className="flex items-center justify-center w-full lg:w-auto lg:flex-shrink-0">
          <div className="w-full max-w-sm lg:w-[380px]">
            {/* Marca compacta — só quando a coluna da esquerda some (mobile) */}
            <div className="flex lg:hidden flex-col items-center text-center mb-8">
              <BrandMark size={56} />
              <Wordmark className="mt-3 text-3xl" />
              {tagline && <p className="text-text-secondary-dark text-sm mt-1">{tagline}</p>}
            </div>
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
