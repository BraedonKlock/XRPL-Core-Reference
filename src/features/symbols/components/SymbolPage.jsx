import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router';
import { EmptyState } from '../../../components/feedback/EmptyState.jsx';
import { ErrorState } from '../../../components/feedback/ErrorState.jsx';
import { LoadingState } from '../../../components/feedback/LoadingState.jsx';
import { PageSection } from '../../../components/layout/PageSection.jsx';
import { Breadcrumbs } from '../../../components/navigation/Breadcrumbs.jsx';
import { TableOfContents } from '../../../components/navigation/TableOfContents.jsx';
import { symbolPathFromPathname } from '../../../config/routes.js';
import { SITE_NAME } from '../../../config/site.js';
import { useDataset } from '../../../hooks/useDataset.js';
import { kindLabelOf } from '../../../utils/symbol-kinds.js';
import { useSymbolRecords } from '../hooks/useSymbolRecords.js';
import { breadcrumbItemsFor } from '../utils/breadcrumbs.js';
import { overloadSetSections, sectionsForRecord } from './symbol-sections.jsx';
import { SymbolHeader } from './SymbolHeader.jsx';
import styles from './SymbolPage.module.css';

const MINIMUM_SECTIONS_FOR_CONTENTS = 4;

function useScrollToHash(isReady) {
  const { hash } = useLocation();
  useEffect(() => {
    if (isReady && hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView?.();
    }
  }, [isReady, hash]);
}

function SymbolArticle({ symbol }) {
  const { directory, manifest } = useDataset();
  const symbolsByPath = useMemo(
    () => new Map(symbol.shardSymbols.map((record) => [record.path, record])),
    [symbol.shardSymbols],
  );
  const subject = symbol.record ?? symbol.entry;
  const sections = symbol.record
    ? sectionsForRecord(symbol.record, {
        directory,
        symbolsByPath,
        overloads: symbol.overloads,
        source: manifest.source,
      })
    : overloadSetSections(symbol.overloads);
  const showsContents = sections.length >= MINIMUM_SECTIONS_FOR_CONTENTS;
  useScrollToHash(true);

  return (
    <div className={`${styles.layout} ${showsContents ? styles.withContents : ''}`}>
      <article className={styles.page}>
        <title>{`${subject.qualifiedName} ${kindLabelOf(subject)} – ${SITE_NAME}`}</title>
        <Breadcrumbs items={breadcrumbItemsFor(symbol.record?.path ?? symbol.entry.path, directory)} />
        <SymbolHeader entry={symbol.entry} record={symbol.record} source={manifest.source} />
        {sections.map((pageSection) => (
          <PageSection key={pageSection.id} id={pageSection.id} title={pageSection.title}>
            {pageSection.content}
          </PageSection>
        ))}
      </article>
      {showsContents ? (
        <aside className={styles.contents}>
          <TableOfContents sections={sections} />
        </aside>
      ) : null}
    </div>
  );
}

function SymbolContent({ symbolPath }) {
  const { directory } = useDataset();
  const symbol = useSymbolRecords(symbolPath);

  if (symbol.status === 'not-found') {
    return (
      <EmptyState title="Symbol not found">
        <p>
          <code>{symbolPath}</code> is not part of the dataset for this rippled commit.
        </p>
      </EmptyState>
    );
  }
  if (symbol.status === 'ready') {
    return <SymbolArticle symbol={symbol} />;
  }
  return (
    <>
      <Breadcrumbs items={breadcrumbItemsFor(symbolPath, directory)} />
      {symbol.status === 'loading' ? (
        <LoadingState label={`Loading ${symbol.entry.qualifiedName}…`} />
      ) : (
        <ErrorState title={`${symbol.entry.qualifiedName} could not be loaded`} error={symbol.error} />
      )}
    </>
  );
}

export function SymbolPage() {
  const location = useLocation();
  const symbolPath = symbolPathFromPathname(location.pathname);
  return <SymbolContent key={symbolPath} symbolPath={symbolPath} />;
}
