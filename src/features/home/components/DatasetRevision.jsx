import { commitUrl } from '../../../services/documentation/source-links.js';
import styles from './HomePage.module.css';

function formatDate(isoDate) {
  return new Date(isoDate).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function DatasetRevision({ manifest }) {
  const { source, generation } = manifest;
  return (
    <dl className={styles.facts}>
      <dt>Repository</dt>
      <dd>
        <a href={source.webUrl} rel="noreferrer">
          {source.repository}
        </a>
      </dd>
      <dt>Branch</dt>
      <dd>{source.branch}</dd>
      <dt>Commit</dt>
      <dd>
        <a className={styles.mono} href={commitUrl(source)} rel="noreferrer">
          {source.commitSha}
        </a>
      </dd>
      <dt>Committed</dt>
      <dd>{formatDate(source.commitDate)}</dd>
      <dt>Generated</dt>
      <dd>
        {formatDate(generation.generatedAt)} with Doxygen {generation.extractor.version.split(' ')[0]}
      </dd>
    </dl>
  );
}
