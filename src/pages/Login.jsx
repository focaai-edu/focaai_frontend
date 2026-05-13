import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';

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
          <h2 className="text-xl font-semibold text-gray-900 dark:text-[#F1F5F9] mb-6">Entrar</h2>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 text-sm" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">Email</label>
              <input
                id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] placeholder-gray-400 dark:placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] transition-colors text-base"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-[#CBD5E1] mb-1.5">Senha</label>
              <input
                id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Sua senha" autoComplete="current-password"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-[#334155] bg-white dark:bg-[#0F172A] text-gray-900 dark:text-[#F1F5F9] placeholder-gray-400 dark:placeholder-[#475569] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/30 focus:border-[#4A90D9] transition-colors text-base"
              />
            </div>
            <button
              type="submit" disabled={submitting}
              className="w-full py-3 px-4 rounded-lg bg-[#1B4F81] text-white font-semibold text-base hover:bg-[#164572] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {submitting ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-gray-500 dark:text-[#64748B]">
            Nao tem conta?{' '}
            <Link to="/register" className="text-[#4A90D9] font-medium hover:underline">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
