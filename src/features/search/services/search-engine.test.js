import { describe, expect, it } from 'vitest';
import { createLazySearchEngine, createSearchEngine, MATCH_TIERS, parseQuery } from './search-engine.js';

function entry(qualifiedName, kind, overrides = {}) {
  const name = qualifiedName.split('::').at(-1);
  return {
    path: qualifiedName.replaceAll('::', '/'),
    name,
    qualifiedName,
    kind,
    role: null,
    scope: null,
    brief: null,
    overloads: 1,
    ...overrides,
  };
}

const ENTRIES = [
  entry('xrpl::ApplyContext', 'class'),
  entry('xrpl::ApplyContext::ApplyContext', 'function', { role: 'constructor' }),
  entry('xrpl::ApplyContext::view', 'function', { role: 'method', overloads: 2 }),
  entry('xrpl::ApplyContext::view_', 'variable'),
  entry('xrpl::detail::ApplyContextHelper', 'class'),
  entry('xrpl::ApplyViewContext', 'struct'),
  entry('xrpl::Payment', 'class'),
  entry('xrpl::transactions::Payment', 'class'),
  entry('xrpl::jss::Payment', 'variable'),
  entry('xrpl::preflight', 'function'),
  entry('xrpl::Batch::preflight', 'function', { role: 'method' }),
  entry('xrpl::TER', 'typeAlias'),
  entry('xrpl::PreclaimResult::ter', 'variable'),
  entry('beast::Journal', 'class'),
];

const engine = createSearchEngine(ENTRIES);
const names = (query, options) =>
  engine.search(query, options).results.map((result) => result.entry.qualifiedName);

describe('search engine', () => {
  it('ranks exact names above partial matches', () => {
    expect(names('ApplyContext').slice(0, 3)).toEqual([
      'xrpl::ApplyContext',
      'xrpl::ApplyContext::ApplyContext',
      'xrpl::detail::ApplyContextHelper',
    ]);
  });

  it('prefers types over members with the same name, then shorter qualified names', () => {
    expect(names('Payment')).toEqual(['xrpl::Payment', 'xrpl::transactions::Payment', 'xrpl::jss::Payment']);
  });

  it('ranks the exact-case match first', () => {
    expect(names('TER')[0]).toBe('xrpl::TER');
    expect(names('ter')[0]).toBe('xrpl::PreclaimResult::ter');
  });

  it('matches fully and partially qualified names', () => {
    expect(names('xrpl::ApplyContext::view')).toEqual([
      'xrpl::ApplyContext::view',
      'xrpl::ApplyContext::view_',
    ]);
    expect(names('ApplyContext::view')).toEqual(['xrpl::ApplyContext::view', 'xrpl::ApplyContext::view_']);
    expect(names('applycontext :: VIEW')[0]).toBe('xrpl::ApplyContext::view');
  });

  it('matches word starts inside camel-case names', () => {
    const result = engine
      .search('Context')
      .results.find((candidate) => candidate.entry.name === 'ApplyViewContext');
    expect(result).toMatchObject({ tier: MATCH_TIERS.nameWordStart, highlight: { start: 9, length: 7 } });
  });

  it('filters by kind and namespace', () => {
    expect(names('preflight', { kindFilter: 'functions' })).toEqual([
      'xrpl::preflight',
      'xrpl::Batch::preflight',
    ]);
    expect(names('Payment', { kindFilter: 'types' })).toEqual([
      'xrpl::Payment',
      'xrpl::transactions::Payment',
    ]);
    expect(names('Journal', { scopePath: 'xrpl' })).toEqual([]);
    expect(names('Journal', { scopePath: 'beast' })).toEqual(['beast::Journal']);
  });

  it('reports totals, limits results and ignores empty queries', () => {
    const limited = engine.search('a', { limit: 2 });
    expect(limited.results).toHaveLength(2);
    expect(limited.total).toBeGreaterThan(2);
    expect(engine.search('   ').results).toEqual([]);
    expect(engine.search('zzzz').total).toBe(0);
  });

  it('normalizes queries', () => {
    expect(parseQuery('  xrpl ::  STTx ')).toMatchObject({
      text: 'xrpl::STTx',
      isQualified: true,
      nameTerm: 'STTx',
    });
  });
});

describe('lazy search engine', () => {
  it('builds the index only when the first real query arrives', () => {
    let loads = 0;
    const lazy = createLazySearchEngine(() => {
      loads += 1;
      return ENTRIES;
    });
    expect(lazy.search('   ').results).toEqual([]);
    expect(lazy.isBuilt).toBe(false);
    expect(lazy.search('Payment').results[0].entry.qualifiedName).toBe('xrpl::Payment');
    lazy.search('TER');
    expect(loads).toBe(1);
    expect(lazy.isBuilt).toBe(true);
  });
});
