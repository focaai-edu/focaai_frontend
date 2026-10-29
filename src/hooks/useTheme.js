import { useState, useEffect, useCallback } from 'react';
import { initialTheme, applyTheme, saveTheme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Só a escolha explícita é gravada; sem ela, o tema segue o sistema (#18).
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'dark' || newTheme === 'light') {
      saveTheme(newTheme);
      setThemeState(newTheme);
    }
  }, []);

  return { theme, setTheme };
}
