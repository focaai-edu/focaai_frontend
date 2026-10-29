import { Link } from 'react-router';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center p-8">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-10 max-w-sm w-full text-center shadow-sm">
        <h1 className="text-7xl font-bold text-primary dark:text-secondary m-0 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">Página não encontrada</h2>
        <p className="text-text-secondary-light dark:text-text-secondary-dark mb-8">A página que você procura não existe.</p>
        <Link to="/" className="inline-block px-6 py-3 rounded-lg bg-primary text-white no-underline text-sm font-semibold hover:bg-primary/90 transition-colors">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
