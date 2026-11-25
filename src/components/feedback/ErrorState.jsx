import styles from './StatusMessage.module.css';

export function ErrorState({ title, error, children }) {
  return (
    <div className={`${styles.status} ${styles.error}`} role="alert">
      <h2 className={styles.title}>{title}</h2>
      {children}
      {error ? <p className={styles.details}>{error.message}</p> : null}
    </div>
  );
}
