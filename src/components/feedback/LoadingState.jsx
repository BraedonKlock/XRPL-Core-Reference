import styles from './StatusMessage.module.css';

export function LoadingState({ label }) {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <div className={styles.row}>
        <span className={styles.spinner} aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
