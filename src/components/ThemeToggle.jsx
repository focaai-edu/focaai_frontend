import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Mudar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
      className="bg-transparent border border-white/30 rounded-lg px-3 py-2 cursor-pointer text-sm text-[#F1F5F9] flex items-center gap-2 hover:bg-white/10 transition-colors"
    >
      <span aria-hidden="true" className="text-base">{theme === 'dark' ? '☀' : '☽'}</span>
      <span className="text-xs">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
    </button>
  );
}
