import { commitUrl, shortCommitSha } from '../../services/documentation/source-links.js';
import styles from './Footer.module.css';

export function Footer({ source, generatedAt, upstreamLicenseUrl }) {
  return (
    <footer className={styles.footer}>
      <p>
        Documents{' '}
        <a className="inline-link" href={source.webUrl} rel="noreferrer">
          {source.repository}
        </a>{' '}
        on <strong>{source.branch}</strong> at{' '}
        <a className={`${styles.commit} inline-link`} href={commitUrl(source)} rel="noreferrer">
          {shortCommitSha(source.commitSha)}
        </a>
        , generated {new Date(generatedAt).toISOString().slice(0, 10)}.
      </p>
      <p>
        A community-maintained project, not affiliated with or endorsed by the XRPL Foundation. Documentation
        content is derived from rippled and distributed under the{' '}
        <a className="inline-link" href={upstreamLicenseUrl} rel="noreferrer">
          rippled ISC License
        </a>
        .
      </p>
    </footer>
  );
}
