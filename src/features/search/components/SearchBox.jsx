import { useDeferredValue, useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { searchUrl, symbolUrl } from '../../../config/routes.js';
import { useSearchEngine } from '../hooks/useSearchEngine.js';
import styles from './SearchBox.module.css';
import { SearchResultContent, searchResultClassName } from './SearchResultItem.jsx';

const SUGGESTION_LIMIT = 10;
const SHORTCUT_KEY = '/';

function isTypingTarget(element) {
  return (
    element instanceof HTMLElement &&
    (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName))
  );
}

export function SearchBox() {
  const engine = useSearchEngine();
  const navigate = useNavigate();
  const inputReference = useRef(null);
  const listboxId = useId();
  const [query, setQuery] = useState('');
  const [isOpen, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const deferredQuery = useDeferredValue(query);
  const { results, total } = engine.search(deferredQuery, { limit: SUGGESTION_LIMIT });
  const hasQuery = deferredQuery.trim().length > 0;
  const isExpanded = isOpen && hasQuery;

  useEffect(() => {
    const focusOnShortcut = (event) => {
      if (event.key === SHORTCUT_KEY && !event.ctrlKey && !event.metaKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        inputReference.current?.focus();
      }
    };
    window.addEventListener('keydown', focusOnShortcut);
    return () => window.removeEventListener('keydown', focusOnShortcut);
  }, []);

  const reset = () => {
    setQuery('');
    setOpen(false);
    setActiveIndex(-1);
    inputReference.current?.blur();
  };

  const goTo = (url) => {
    reset();
    navigate(url);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp' && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === 'Enter' && query.trim()) {
      event.preventDefault();
      const active = results[activeIndex];
      goTo(active ? symbolUrl(active.entry.path) : searchUrl(query.trim()));
    } else if (event.key === 'Escape') {
      reset();
    }
  };

  const optionId = (index) => `${listboxId}-option-${index}`;

  return (
    <div className={styles.search} role="search">
      <span className={styles.icon} aria-hidden="true">
        {'⌕'}
      </span>
      <input
        ref={inputReference}
        className={styles.input}
        type="search"
        placeholder="Search classes, methods, types…  ( / )"
        aria-label="Search the reference"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isExpanded}
        aria-controls={listboxId}
        aria-activedescendant={isExpanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {isExpanded ? (
        <div className={styles.panel} onMouseDown={(event) => event.preventDefault()}>
          {results.length === 0 ? (
            <p className={styles.empty}>No symbols match “{deferredQuery.trim()}”.</p>
          ) : (
            <ul id={listboxId} className={styles.options} role="listbox" aria-label="Search suggestions">
              {results.map((result, index) => (
                <li
                  key={result.entry.path}
                  id={optionId(index)}
                  className={styles.option}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <Link
                    to={symbolUrl(result.entry.path)}
                    className={searchResultClassName}
                    tabIndex={-1}
                    onClick={reset}
                  >
                    <SearchResultContent result={result} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {total > results.length ? (
            <Link
              className={styles.footer}
              to={searchUrl(deferredQuery.trim())}
              tabIndex={-1}
              onClick={reset}
            >
              See all {total.toLocaleString('en-US')} results
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
