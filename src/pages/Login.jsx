import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { BrandMark, Wordmark } from '../components/AuthLayout';

// ── Mockup de dashboard (estático, Direção A flat) ────────────────────
const MOCK_STUDENTS = [
  { name: 'João',  pct: 84, color: 'var(--color-attentive)' },
  { name: 'Maria', pct: 91, color: 'var(--color-attentive)' },
  { name: 'Pedro', pct: 63, color: 'var(--color-no-camera)' },
  { name: 'Ana',   pct: 78, color: 'var(--color-attentive)' },
];

function DashboardMock() {
  return (
    <div className="relative w-full max-w-sm rounded-xl border border-slate-800 bg-surface-dark p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-secondary font-semibold m-0">Atenção da turma</p>
          <p className="text-xs text-text-secondary-dark m-0">ao vivo · 26 alunos</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          92%
        </span>
      </div>

      <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-5">
        <div className="h-full rounded-full bg-secondary w-[92%]" />
      </div>

      <div className="space-y-2.5">
        {MOCK_STUDENTS.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="text-xs text-slate-300 w-12 flex-shrink-0">{s.name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            </div>
            <span className="text-xs font-semibold tabular-nums w-8 text-right" style={{ color: s.color }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Card de métrica compacto ──────────────────────────────────────────────────
function MetricCard({ icon, label, value, className = '' }) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-surface-dark/95 px-3.5 py-2.5 shadow-sm ${className}`}>
      <p className="text-[11px] text-text-secondary-dark m-0 mb-0.5 flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>{label}
      </p>
      <p className="text-sm font-bold text-white m-0">{value}</p>
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
    <li className="flex items-center gap-3 text-slate-200 text-[15px]">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary/20 flex-shrink-0">
        <svg className="w-3 h-3 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <BrandMark size={48} />
          <Wordmark className="text-3xl" />
        </div>

        <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4 max-w-xl">
          Nenhum aluno fica para trás por ter se distraído.
        </h1>
        <p className="text-slate-300 text-base leading-relaxed max-w-lg mb-6">
          Detecte distrações <strong className="text-white">em tempo real</strong> e recupere
          automaticamente os momentos importantes da aula com <strong className="text-white">Inteligência Artificial</strong>.
        </p>

        <ul className="space-y-2.5 max-w-md list-none p-0 m-0">
          {FEATURES.map((f) => <FeatureItem key={f}>{f}</FeatureItem>)}
        </ul>
      </div>

      <div className="relative w-full max-w-md">
        <DashboardMock />
        <MetricCard icon="🎯" label="Atenção detectada" value="87%" className="absolute -top-4 -right-2" />
        <MetricCard icon="🧠" label="IA ativa" value="Resumo gerado" className="absolute top-1/2 -right-6" />
        <MetricCard icon="📚" label="Aula marcada" value="12 momentos" className="absolute -bottom-4 -left-4" />
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
      // Credencial errada tem texto fixo em pt-BR, sem depender da grafia do servidor (#19, V12).
      if (err.response?.status === 401) setError('E-mail ou senha inválidos.');
      else setError(err.response?.data?.error || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 text-text-primary-dark placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-colors text-sm';

  return (
    <AuthLayout left={<LoginMarketing />} tagline="Cada momento importa. Inclusive os que você perdeu.">
      <div className="rounded-xl border border-slate-800 bg-surface-dark p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-white mb-0.5">Acessar plataforma</h2>
        <p className="text-sm text-text-secondary-dark mb-5">Entre com sua conta para continuar.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com" autoComplete="email" className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
            <input
              id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Sua senha" autoComplete="current-password" className={inputClass}
            />
          </div>
          <button
            type="submit" disabled={submitting}
            className="w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm bg-secondary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-secondary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm mt-1"
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-slate-400">
          Não tem conta?{' '}
          <Link to="/register" className="text-secondary font-medium hover:underline">Cadastre-se</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
