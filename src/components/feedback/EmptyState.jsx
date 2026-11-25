import styles from './StatusMessage.module.css';

export function EmptyState({ title, headingLevel = 2, children }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className={styles.status}>
      <Heading className={styles.title}>{title}</Heading>
      {children}
    </div>
  );
}
