import styles from './HomePage.module.css';

const STATISTICS = Object.freeze([
  ['namespace', 'Namespaces'],
  ['class', 'Classes'],
  ['struct', 'Structs'],
  ['overloadSet', 'Functions and methods'],
  ['typeAlias', 'Type aliases'],
  ['enum', 'Enums'],
  ['totalSymbols', 'Symbols in total'],
]);

const numberFormat = new Intl.NumberFormat('en-US');

export function DatasetStatistics({ counts }) {
  return (
    <dl className={styles.statistics}>
      {STATISTICS.filter(([key]) => Number.isInteger(counts[key])).map(([key, label]) => (
        <div key={key} className={styles.statistic}>
          <dt>{label}</dt>
          <dd>{numberFormat.format(counts[key])}</dd>
        </div>
      ))}
    </dl>
  );
}
