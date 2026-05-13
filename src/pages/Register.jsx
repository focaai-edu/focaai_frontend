import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

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
    if (!name.trim()) { setError('Nome e obrigatorio.'); return; }
    if (!email.trim()) { setError('Email e obrigatorio.'); return; }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirmPassword) { setError('As senhas nao conferem.'); return; }
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

  const inputClass = "w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] placeholder-gray-400 dark:placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] transition-colors text-base";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5";

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/cerebro.png" alt="foca.ai" className="w-16 h-16 mx-auto mb-4 brightness-0 invert" />
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            foca<span className="text-[#4A90D9]">.</span>ai
          </h1>
          <p className="text-[#94A3B8] text-base">Cada momento importa. Inclusive os que voce perdeu.</p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-[#F1F5F9] mb-6">Criar Conta</h2>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimo 6 caracteres" autoComplete="new-password" className={inputClass} />
            </div>
            <div>
              <label htmlFor="confirm-password" className={labelClass}>Confirmar senha</label>
              <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" className={inputClass} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-2">Perfil</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button" onClick={() => setRole('student')}
                  className={`p-4 rounded-lg border-2 text-center font-medium transition-all ${
                    role === 'student'
                      ? 'border-[#1B4F81] bg-[#E8F0FA] dark:bg-[#1B4F81]/30 text-[#1B4F81] dark:text-[#7DB8F0]'
                      : 'border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-600 dark:text-[#94A3B8] hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">🎓</div>
                  Sou Aluno
                </button>
                <button
                  type="button" onClick={() => setRole('teacher')}
                  className={`p-4 rounded-lg border-2 text-center font-medium transition-all ${
                    role === 'teacher'
                      ? 'border-[#1B4F81] bg-[#E8F0FA] dark:bg-[#1B4F81]/30 text-[#1B4F81] dark:text-[#7DB8F0]'
                      : 'border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-600 dark:text-[#94A3B8] hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">📚</div>
                  Sou Professor
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#1B4F81] text-white font-semibold text-base hover:bg-[#164572] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {submitting ? 'Criando conta...' : 'Criar Conta'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500 dark:text-[#64748B]">
            Ja tem conta?{' '}
            <Link to="/login" className="text-[#4A90D9] font-medium hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
