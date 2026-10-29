// Estado de erro de carga, separado do estado vazio (#5, F33).
export default function LoadError({ onRetry, className = '' }) {
  return (
    <div role="alert" className={`py-10 text-center rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark ${className}`}>
      <p className="text-sm text-slate-700 dark:text-slate-300 m-0 mb-3">Não foi possível carregar.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:bg-primary transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  );
}
