import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import AuthLayout, { BrandMark, Wordmark } from '../components/AuthLayout';

// ── "Como funciona" — 3 passos (conta a história sem poluir) ───────────────────
const STEPS = [
  { icon: '🎥', title: 'A câmera detecta a atenção', desc: 'Webcam ou câmera da sala, processada no próprio dispositivo.' },
  { icon: '🧠', title: 'A IA transcreve e resume', desc: 'Cada momento de distração vira um resumo do que foi perdido.' },
  { icon: '📚', title: 'O aluno recupera o conteúdo', desc: 'Nada importante fica para trás, mesmo nos lapsos de atenção.' },
];

function HowItWorks() {
  return (
    <ol className="space-y-2.5 max-w-md list-none p-0 m-0">
      {STEPS.map((s, i) => (
        <li
          key={s.title}
          className="foca-anim flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md px-3.5 py-2.5"
          style={{ boxShadow: '0 12px 30px rgba(0,0,0,.25)', animation: 'foca-rise .5s ease-out both', animationDelay: `${i * 0.12}s` }}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#4A90D9]/15 text-base flex-shrink-0">{s.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white m-0 mb-0.5">{s.title}</p>
            <p className="text-xs text-[#94A3B8] m-0 leading-snug">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function RegisterMarketing() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <BrandMark size={48} />
        <Wordmark className="text-2xl" />
      </div>

      <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-3 max-w-xl">
        Crie sua conta e não deixe nenhum aluno para trás.
      </h1>
      <p className="text-[#CBD5E1] text-base leading-relaxed max-w-lg mb-6">
        Leva menos de um minuto. Comece a monitorar a atenção da turma e a
        recuperar os momentos perdidos com <strong className="text-white">Inteligência Artificial</strong>.
      </p>

      <HowItWorks />
    </div>
  );
}

export default function Register() {
  const { user, loading, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={`/${user.role}/dashboard`} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Nome é obrigatório.'); return; }
    if (!email.trim()) { setError('Email é obrigatório.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas não conferem.'); return; }
    if (!role) { setError('Selecione um perfil (Aluno ou Professor).'); return; }
    setSubmitting(true);
    try {
      await register(name, email, password, role);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-lg border border-white/10 bg-white/5 text-[#F1F5F9] placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/40 focus:border-[#4A90D9]/60 transition-colors text-sm';
  const labelClass = 'block text-sm font-medium text-[#CBD5E1] mb-1';

  const roleBtn = (active) =>
    `p-2.5 rounded-lg border text-center text-sm font-medium transition-all ${
      active
        ? 'border-[#4A90D9] bg-[#4A90D9]/15 text-[#7DB8F0]'
        : 'border-white/10 bg-white/5 text-[#94A3B8] hover:border-white/25'
    }`;

  return (
    <AuthLayout left={<RegisterMarketing />} tagline="Crie sua conta em menos de um minuto.">
      <div
        className="rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-2xl p-6"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}
      >
        <h2 className="text-lg font-semibold text-white mb-0.5">Criar conta</h2>
        <p className="text-sm text-[#94A3B8] mb-5">Comece a usar a plataforma agora.</p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="name" className={labelClass}>Nome completo</label>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" autoComplete="name" className={inputClass} />
          </div>
          <div>
            <label htmlFor="reg-email" className={labelClass}>Email</label>
            <input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoComplete="email" className={inputClass} />
          </div>
          <div>
            <label htmlFor="reg-password" className={labelClass}>Senha</label>
            <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" className={inputClass} />
          </div>
          <div>
            <label htmlFor="confirm-password" className={labelClass}>Confirmar senha</label>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" className={inputClass} />
          </div>

          <div>
            <p className={labelClass}>Perfil</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setRole('student')} className={roleBtn(role === 'student')}>
                <div className="text-xl mb-0.5">🎓</div>
                Sou Aluno
              </button>
              <button type="button" onClick={() => setRole('teacher')} className={roleBtn(role === 'teacher')}>
                <div className="text-xl mb-0.5">📚</div>
                Sou Professor
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={submitting}
            className="foca-anim w-full py-2.5 px-4 rounded-lg text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 mt-1"
            style={{ background: 'linear-gradient(90deg,#2563eb,#3b82f6)', boxShadow: '0 10px 24px rgba(37,99,235,.35)' }}
          >
            {submitting ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-[#64748B]">
          Já tem conta?{' '}
          <Link to="/login" className="text-[#7DB8F0] font-medium hover:underline">Entrar</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
