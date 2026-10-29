import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();
  // Direto ao painel do perfil (ou ao login), sem passar pelo redirect de "/" (#18).
  const home = user ? `/${user.role}/dashboard` : '/login';

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center p-4 sm:p-8">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 sm:p-10 max-w-sm w-full text-center shadow-sm">
        <h1 className="text-7xl font-bold text-primary dark:text-secondary m-0 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-text-primary-light dark:text-white mb-4">Página não encontrada</h2>
        <p className="text-text-secondary-light dark:text-slate-300 mb-8">A página que você procura não existe.</p>
        <Link to={home} className="inline-block px-6 py-3 rounded-lg bg-primary text-white no-underline text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-dark">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
