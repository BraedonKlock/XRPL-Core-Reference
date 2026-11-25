import { kindLabelOf } from '../../../utils/symbol-kinds.js';
import { HighlightedText } from './HighlightedText.jsx';
import styles from './SearchResultItem.module.css';

export function overloadLabel(entry) {
  return entry.overloads > 1 ? ` · ${entry.overloads} overloads` : '';
}

export function SearchResultContent({ result }) {
  const { entry, highlight } = result;
  return (
    <>
      <span className={styles.name}>
        <HighlightedText text={entry.name} highlight={highlight} />
      </span>
      <span className={styles.kind}>
        {kindLabelOf(entry)}
        {overloadLabel(entry)}
      </span>
      {entry.scope ? <span className={styles.scope}>{entry.scope}</span> : null}
      {entry.brief ? <span className={styles.brief}>{entry.brief}</span> : null}
    </>
  );
}

export const searchResultClassName = styles.result;
