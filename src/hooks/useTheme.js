import { useCallback, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '../config/site.js';

export const THEMES = Object.freeze({ light: 'light', dark: 'dark' });

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? THEMES.dark : THEMES.light;
}

function storedTheme() {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return Object.values(THEMES).includes(value) ? value : null;
}

export function initialTheme() {
  return document.documentElement.dataset.theme ?? storedTheme() ?? systemTheme();
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === THEMES.dark ? THEMES.light : THEMES.dark;
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
