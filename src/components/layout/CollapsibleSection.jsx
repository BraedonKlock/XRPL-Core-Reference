import { useState } from 'react';
import sectionStyles from './PageSection.module.css';
import styles from './CollapsibleSection.module.css';

export function CollapsibleSection({ id, title, description = null, children }) {
  const [isOpen, setOpen] = useState(false);
  const headingId = `${id}-heading`;
  const contentId = `${id}-content`;
  return (
    <section id={id} className={sectionStyles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={sectionStyles.heading}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => setOpen((open) => !open)}
        >
          <span className={`${styles.chevron} ${isOpen ? styles.open : ''}`} aria-hidden="true" />
          {title}
        </button>
      </h2>
      {description ? <p className={styles.description}>{description}</p> : null}
      <div id={contentId} className={styles.content} hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
