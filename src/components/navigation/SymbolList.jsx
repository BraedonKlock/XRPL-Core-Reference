import { Link } from 'react-router';
import { symbolUrl } from '../../config/routes.js';
import { kindLabelOf } from '../../utils/symbol-kinds.js';
import styles from './SymbolList.module.css';

export function SymbolList({ entries, label }) {
  return (
    <ul className={styles.list} aria-label={label}>
      {entries.map((entry) => (
        <li key={entry.path} className={styles.item}>
          <span className={styles.name}>
            <Link to={symbolUrl(entry.path)}>{entry.name}</Link>
            <span className={styles.kind}>
              {kindLabelOf(entry)}
              {entry.overloads > 1 ? ` \u00b7 ${entry.overloads} overloads` : ''}
            </span>
          </span>
          <span className={styles.summary}>{entry.brief ?? ''}</span>
        </li>
      ))}
    </ul>
  );
}
