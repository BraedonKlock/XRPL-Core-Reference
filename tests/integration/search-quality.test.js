import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';
import { createSearchEngine } from '../../src/features/search/services/search-engine.js';
import { createSymbolDirectory } from '../../src/services/documentation/symbol-directory.js';

const POINTER = join(PROJECT_PATHS.datasetOutputDirectory, 'current.json');
const MAX_QUERY_MILLISECONDS = 50;

describe.skipIf(!existsSync(POINTER))('search over the full generated dataset', () => {
  let engine;

  beforeAll(() => {
    const { commitSha } = JSON.parse(readFileSync(POINTER, 'utf8'));
    const searchIndex = JSON.parse(
      readFileSync(join(PROJECT_PATHS.datasetOutputDirectory, commitSha, 'search-index.json'), 'utf8'),
    );
    engine = createSearchEngine(createSymbolDirectory(searchIndex).entries());
  });

  it.each([
    ['STTx', 'xrpl::STTx'],
    ['ApplyContext', 'xrpl::ApplyContext'],
    ['ReadView', 'xrpl::ReadView'],
    ['Payment', 'xrpl::Payment'],
    ['TER', 'xrpl::TER'],
    ['SHAMap', 'xrpl::SHAMap'],
    ['xrpl::STTx::getTxnType', 'xrpl::STTx::getTxnType'],
  ])('ranks %s first as %s', (query, expected) => {
    expect(engine.search(query, { limit: 1 }).results[0].entry.qualifiedName).toBe(expected);
  });

  it.each(['preflight', 'preclaim', 'doApply'])('finds every %s override', (query) => {
    const { total, results } = engine.search(query, { kindFilter: 'functions', limit: 200 });
    expect(total).toBeGreaterThan(70);
    expect(
      results.every(
        (result) => result.entry.name === query || !result.entry.name.startsWith(query) || result.tier < 100,
      ),
    ).toBe(true);
  });

  it('answers typical queries quickly', () => {
    engine.search('warm up');
    for (const query of ['a', 'Apply', 'preflight', 'xrpl::ApplyContext::view', 'context']) {
      const started = performance.now();
      engine.search(query);
      expect(performance.now() - started).toBeLessThan(MAX_QUERY_MILLISECONDS);
    }
  });
});
