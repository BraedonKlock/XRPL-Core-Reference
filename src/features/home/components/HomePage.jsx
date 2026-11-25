import { PageSection } from '../../../components/layout/PageSection.jsx';
import { SymbolList } from '../../../components/navigation/SymbolList.jsx';
import { FEATURED_SYMBOLS, SITE_NAME, SITE_TAGLINE } from '../../../config/site.js';
import { useDataset } from '../../../hooks/useDataset.js';
import { DatasetRevision } from './DatasetRevision.jsx';
import { DatasetStatistics } from './DatasetStatistics.jsx';
import styles from './HomePage.module.css';

export function HomePage() {
  const { manifest, navigation, directory } = useDataset();
  const featured = FEATURED_SYMBOLS.map((qualifiedName) =>
    directory.findByQualifiedName(qualifiedName),
  ).filter(Boolean);
  const namespaces = navigation.roots
    .filter((node) => node.kind === 'namespace')
    .map((node) => directory.get(node.path))
    .filter(Boolean);

  return (
    <div className={styles.page}>
      <title>{SITE_NAME}</title>
      <div className={styles.intro}>
        <h1 className={styles.title}>{SITE_NAME}</h1>
        <p className={styles.tagline}>{SITE_TAGLINE}</p>
        <p>
          A reference for the C++ implementation of the XRP Ledger, generated from the source code of{' '}
          {manifest.source.repository}. Browse namespaces and classes from the sidebar, or start with one of
          the core types below.
        </p>
      </div>
      {featured.length > 0 ? (
        <PageSection id="core-types" title="Core types">
          <SymbolList entries={featured} label="Core types" />
        </PageSection>
      ) : null}
      <PageSection id="namespaces" title="Namespaces">
        <SymbolList entries={namespaces} label="Top-level namespaces" />
      </PageSection>
      <PageSection id="source-revision" title="Source revision">
        <DatasetRevision manifest={manifest} />
      </PageSection>
      <PageSection id="contents" title="Contents">
        <DatasetStatistics counts={manifest.counts} />
      </PageSection>
    </div>
  );
}
