// Estado de erro de carga, separado do estado vazio (#5, F33).
export default function LoadError({ onRetry, className = '' }) {
  return (
    <div role="alert" className={`py-10 text-center rounded-xl bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#334155] ${className}`}>
      <p className="text-sm text-gray-700 dark:text-[#CBD5E1] m-0 mb-3">Não foi possível carregar.</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-[#4A90D9] text-white text-sm font-semibold hover:bg-[#1B4F81] transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  );
}
