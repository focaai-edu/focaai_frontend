import { useTheme } from '../hooks/useTheme';

const OPTIONS = [
  {
    value: 'light',
    label: 'Claro',
    icon: (
      <svg data-icon="sun" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="4" />
        <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Escuro',
    icon: (
      <svg data-icon="moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    ),
  },
];

// Seletor segmentado: mostra o tema ativo (aria-pressed), não a ação (#18, V18).
export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Tema" className="px-1">
      <p aria-hidden="true" className="text-xs m-0 mb-1.5 px-2 text-white/60">Tema</p>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/10">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(opt.value)}
              className={`flex items-center justify-center gap-2 rounded-md text-sm border-none cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
                active ? 'bg-white/20 text-white font-semibold' : 'bg-transparent text-white/75 hover:text-white hover:bg-white/10'
              }`}
            >
              <span aria-hidden="true" className="w-4 h-4 flex-shrink-0">{opt.icon}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
