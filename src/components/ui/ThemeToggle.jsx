import { THEMES, useTheme } from '../../hooks/useTheme.js';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === THEMES.dark;
  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme} aria-pressed={isDark}>
      <span aria-hidden="true">{isDark ? '☾' : '☀'}</span>
      <span className={styles.label}>Dark theme</span>
    </button>
  );
}
