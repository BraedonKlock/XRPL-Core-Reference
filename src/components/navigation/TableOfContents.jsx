import styles from './TableOfContents.module.css';

export function TableOfContents({ sections }) {
  return (
    <nav className={styles.contents} aria-label="On this page">
      <div className={styles.heading}>On this page</div>
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.title}</a>
            {section.count ? <span className={styles.count}> {section.count}</span> : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
