import { useDeferredValue } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '../../../components/feedback/EmptyState.jsx';
import { symbolUrl } from '../../../config/routes.js';
import { SITE_NAME } from '../../../config/site.js';
import { useDataset } from '../../../hooks/useDataset.js';
import { useSearchEngine } from '../hooks/useSearchEngine.js';
import { KIND_FILTERS } from '../services/search-engine.js';
import styles from './SearchPage.module.css';
import { SearchResultContent, searchResultClassName } from './SearchResultItem.jsx';

const RESULT_LIMIT = 100;
const KIND_OPTIONS = Object.freeze([
  ['', 'All'],
  ['types', 'Types'],
  ['functions', 'Functions'],
  ['variables', 'Variables'],
  ['namespaces', 'Namespaces'],
]);

function scopeOptions(navigation) {
  return navigation.roots
    .filter((node) => node.kind === 'namespace')
    .map((node) => ({ path: node.path, name: node.name }));
}

export function SearchPage() {
  const { navigation } = useDataset();
  const engine = useSearchEngine();
  const [parameters, setParameters] = useSearchParams();
  const query = parameters.get('q') ?? '';
  const kind = Object.hasOwn(KIND_FILTERS, parameters.get('kind') ?? '') ? parameters.get('kind') : '';
  const scope = parameters.get('scope') ?? '';
  const deferredQuery = useDeferredValue(query);
  const { results, total } = engine.search(deferredQuery, {
    kindFilter: kind || null,
    scopePath: scope || null,
    limit: RESULT_LIMIT,
  });

  const update = (changes) => {
    const next = new URLSearchParams(parameters);
    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    setParameters(next, { replace: true });
  };

  return (
    <div className={styles.page}>
      <title>{query ? `Search: ${query} – ${SITE_NAME}` : `Search – ${SITE_NAME}`}</title>
      <h1 className={styles.title}>Search</h1>
      <form className={styles.form} role="search" onSubmit={(event) => event.preventDefault()}>
        <label className={`${styles.field} ${styles.queryField}`}>
          Name or qualified name
          <input
            className={styles.input}
            type="search"
            value={query}
            placeholder="ApplyContext, preflight, xrpl::STTx::getTxnType…"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => update({ q: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          Namespace
          <select
            className={styles.select}
            value={scope}
            onChange={(event) => update({ scope: event.target.value })}
          >
            <option value="">All namespaces</option>
            {scopeOptions(navigation).map((option) => (
              <option key={option.path} value={option.path}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </form>
      <fieldset className={styles.filters}>
        <legend>Kind</legend>
        {KIND_OPTIONS.map(([value, label]) => (
          <label key={value || 'all'} className={styles.chip}>
            <input
              type="radio"
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => update({ kind: value })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {deferredQuery.trim() === '' ? (
        <EmptyState title="Search the rippled C++ reference">
          <p>Type a class, method, field or fully qualified name. Exact matches are listed first.</p>
        </EmptyState>
      ) : null}
      {deferredQuery.trim() !== '' && total === 0 ? (
        <EmptyState title="No matching symbols">
          <p>Check the spelling, remove filters, or search for part of the name.</p>
        </EmptyState>
      ) : null}
      {total > 0 ? (
        <>
          <p className={styles.summary} aria-live="polite">
            {total > results.length
              ? `Showing the best ${results.length} of ${total.toLocaleString('en-US')} matches`
              : `${total.toLocaleString('en-US')} ${total === 1 ? 'match' : 'matches'}`}
          </p>
          <ol className={styles.results} aria-label="Search results">
            {results.map((result) => (
              <li key={result.entry.path}>
                <Link to={symbolUrl(result.entry.path)} className={searchResultClassName}>
                  <SearchResultContent result={result} />
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
