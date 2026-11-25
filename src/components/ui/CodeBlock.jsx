import styles from './CodeBlock.module.css';

export function CodeBlock({ children, label }) {
  return (
    <pre className={styles.code} aria-label={label}>
      <code>{children}</code>
    </pre>
  );
}
