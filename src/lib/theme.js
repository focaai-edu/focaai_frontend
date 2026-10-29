// Tema claro/escuro (#18). O script inline do <head> em index.html repete a
// regra de initialTheme() para pôr a classe `dark` antes do primeiro paint;
// theme.test.js trava a paridade entre os dois.
export const THEME_KEY = 'foca-theme-preference';

// Escolha gravada pelo usuário; sem ela (ou com storage bloqueado), o sistema.
export function initialTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    // storage bloqueado (modo privado): segue a preferência do sistema
  }
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // sem storage, a escolha vale só nesta aba
  }
}
