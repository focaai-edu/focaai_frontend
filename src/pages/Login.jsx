import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { BrandMark, Wordmark } from '../components/AuthLayout';

// ── Mockup de dashboard (estático) — mostra o produto em si ────────────────────
const MOCK_STUDENTS = [
  { name: 'João',  pct: 84, color: '#22C55E' },
  { name: 'Maria', pct: 91, color: '#22C55E' },
  { name: 'Pedro', pct: 63, color: '#F59E0B' },
  { name: 'Ana',   pct: 78, color: '#22C55E' },
];

function DashboardMock() {
  return (
    <div
      className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md p-5"
      style={{ boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#7DB8F0] font-semibold m-0">Atenção da turma</p>
          <p className="text-xs text-[#94A3B8] m-0">ao vivo · 26 alunos</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 foca-anim" style={{ animation: 'foca-glow 2s ease-in-out infinite' }} />
          92%
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden mb-5">
        <div
          className="foca-anim h-full rounded-full"
          style={{ width: '92%', background: 'linear-gradient(90deg,#22C55E,#4A90D9)', animation: 'foca-bar 1.4s ease-out' }}
        />
      </div>

      <div className="space-y-2.5">
        {MOCK_STUDENTS.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="text-xs text-[#CBD5E1] w-12 flex-shrink-0">{s.name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="foca-anim h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color, animation: 'foca-bar 1.6s ease-out' }} />
            </div>
            <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: s.color }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card de métrica flutuante ──────────────────────────────────────────────────
function FloatCard({ icon, label, value, className = '', anim = 'foca-float', delay = '0s' }) {
  return (
    <div
      className={`foca-anim rounded-xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-md px-4 py-3 ${className}`}
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,.35)', animation: `${anim} 6s ease-in-out infinite`, animationDelay: delay }}
    >
      <p className="text-[11px] text-[#94A3B8] m-0 mb-0.5 flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>{label}
      </p>
      <p className="text-base font-bold text-white m-0">{value}</p>
    </div>
  );
}

const FEATURES = [
  'Detecta distrações em tempo real',
  'Resume automaticamente os momentos perdidos',
  'Acompanhamento da turma ao vivo',
];

function FeatureItem({ children }) {
  return (
    <li className="flex items-center gap-3 text-[#E2E8F0] text-[15px]">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#4A90D9]/20 flex-shrink-0">
        <svg className="w-3 h-3 text-[#7DB8F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
      {children}
    </li>
  );
}

function LoginMarketing() {
  return (
    <>
      <div>
        <div className="flex items-center gap-3 mb-8">
          <BrandMark size={52} />
          <Wordmark className="text-3xl" />
        </div>

        <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-5 max-w-xl">
          Nenhum aluno fica para trás por ter se distraído.
        </h1>
        <p className="text-[#CBD5E1] text-lg leading-relaxed max-w-lg mb-8">
          Detecte distrações <strong className="text-white">em tempo real</strong> e recupere
          automaticamente os momentos importantes da aula com <strong className="text-white">Inteligência Artificial</strong>.
        </p>

        <ul className="space-y-3 max-w-md">
          {FEATURES.map((f) => <FeatureItem key={f}>{f}</FeatureItem>)}
        </ul>
      </div>

      <div className="relative w-full max-w-md">
        <DashboardMock />
        <FloatCard icon="🎯" label="Atenção detectada" value="87%" className="absolute -top-6 -right-4 xl:right-0" anim="foca-float" delay="0s" />
        <FloatCard icon="🧠" label="IA ativa" value="Resumo gerado" className="absolute top-1/3 -right-10 xl:-right-12" anim="foca-float-2" delay="1.2s" />
        <FloatCard icon="📚" label="Aula marcada" value="12 momentos" className="absolute -bottom-6 -left-6" anim="foca-float" delay="0.6s" />
      </div>
    </>
  );
}

export default function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-lg border border-white/10 bg-white/5 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/40 focus:border-[#4A90D9]/60 transition-colors text-sm';

  return (
    <AuthLayout left={<LoginMarketing />} tagline="Cada momento importa. Inclusive os que você perdeu.">
      <div
        className="rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl p-6"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}
      >
        <h2 className="text-lg font-semibold text-white mb-0.5">Acessar plataforma</h2>
        <p className="text-sm text-[#94A3B8] mb-5">Entre com sua conta para continuar.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#CBD5E1] mb-1">Email</label>
            <input
              id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#CBD5E1] mb-1">Senha</label>
            <input
              id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Sua senha" autoComplete="current-password" className={inputClass}
            />
          </div>
          <button
            type="submit" disabled={submitting}
            className="foca-anim w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 mt-1"
            style={{ background: 'linear-gradient(90deg,#2563eb,#3b82f6)', boxShadow: '0 10px 24px rgba(37,99,235,.35)' }}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-[#64748B]">
          Não tem conta?{' '}
          <Link to="/register" className="text-[#7DB8F0] font-medium hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
