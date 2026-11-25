import { Link } from 'react-router';
import { HOME_ROUTE } from '../../config/routes.js';
import { SITE_NAME } from '../../config/site.js';
import { shortCommitSha } from '../../services/documentation/source-links.js';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import logoUrl from '../../../images/images.png';
import styles from './Header.module.css';

export function Header({ source, search, isNavigationOpen, onToggleNavigation, navigationId }) {
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        aria-controls={navigationId}
        aria-expanded={isNavigationOpen}
        aria-label={isNavigationOpen ? 'Close navigation' : 'Open navigation'}
        onClick={onToggleNavigation}
      >
        <span aria-hidden="true">{'☰'}</span>
      </button>
      <Link to={HOME_ROUTE} className={styles.brand}>
        <img className={styles.logo} src={logoUrl} alt="" width="28" height="28" />
        <span className={styles.title}>{SITE_NAME}</span>
        <span className={styles.revision}>
          {source.repository}@{source.branch} {shortCommitSha(source.commitSha)}
        </span>
      </Link>
      {search}
      <div className={styles.actions}>
        <ThemeToggle />
      </div>
    </header>
  );
}
