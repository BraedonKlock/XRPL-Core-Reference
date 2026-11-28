import { describe, expect, it } from 'vitest';
import { createSymbolDirectory } from '../../../services/documentation/symbol-directory.js';
import { buildNotesCatalog } from './notes-catalog.js';

const COLUMNS = [
  'path',
  'name',
  'qualifiedName',
  'kind',
  'role',
  'scope',
  'category',
  'brief',
  'shard',
  'overloads',
];
const DIRECTORY = createSymbolDirectory({
  columns: COLUMNS,
  shards: ['shard'],
  rows: [
    ['xrpl/STTx', 'STTx', 'xrpl::STTx', 'class', null, 'xrpl', 'production', null, 0, null],
    ['xrpl/isXRP', 'isXRP', 'xrpl::isXRP', 'function', 'function', 'xrpl', 'production', null, 0, 7],
  ],
});

const ASSET = 'xrpl::isXRP(Asset const&)';
const ISSUE = 'xrpl::isXRP(Issue const&)';

function note(symbol, extra = {}) {
  return { schemaVersion: 2, symbol, purpose: `About ${symbol}`, ...extra };
}

function example(title, signature) {
  return { ...(signature ? { signature } : {}), title, code: `${title}();` };
}

const functionRecord = (signatureKey) => ({ kind: 'function', qualifiedName: 'xrpl::isXRP', signatureKey });
const titles = (examples) => examples.map((entry) => entry.title);

describe('developer notes catalog', () => {
  it('shares one entry across the overload set and every overload', async () => {
    const catalog = await buildNotesCatalog({
      '/developer-notes/isXRP.json': note('xrpl::isXRP', {
        examples: [example('assetOne', ASSET), example('issueOne', ISSUE), example('assetTwo', ASSET)],
      }),
    });
    const onOverloadSet = catalog.notesFor({ record: null, entry: { qualifiedName: 'xrpl::isXRP' } });
    expect(onOverloadSet.entry.purpose).toBe('About xrpl::isXRP');
    expect(onOverloadSet.examples).toEqual([]);
    const onAsset = catalog.notesFor({ record: functionRecord(ASSET) });
    expect(onAsset.entry).toBe(onOverloadSet.entry);
    expect(titles(onAsset.examples)).toEqual(['assetOne', 'assetTwo']);
    expect(titles(catalog.notesFor({ record: functionRecord(ISSUE) }).examples)).toEqual(['issueOne']);
    const onCurrency = catalog.notesFor({ record: functionRecord('xrpl::isXRP(Currency const&)') });
    expect(onCurrency.entry.purpose).toBe('About xrpl::isXRP');
    expect(onCurrency.examples).toEqual([]);
  });

  it('shows every unsigned example on a class page', async () => {
    const catalog = await buildNotesCatalog({
      '/developer-notes/STTx.json': note('xrpl::STTx', { examples: [example('first'), example('second')] }),
    });
    const notes = catalog.notesFor({ record: { kind: 'class', qualifiedName: 'xrpl::STTx' } });
    expect(titles(notes.examples)).toEqual(['first', 'second']);
  });

  it('returns nothing for symbols without notes', async () => {
    const catalog = await buildNotesCatalog({ '/developer-notes/STTx.json': note('xrpl::STTx') });
    expect(catalog.notesFor({ record: { kind: 'class', qualifiedName: 'xrpl::STObject' } })).toEqual({
      entry: null,
      examples: [],
    });
    expect(catalog.notesFor({ record: functionRecord(ASSET) })).toEqual({ entry: null, examples: [] });
  });

  it('ignores invalid and old-format entries and keeps the first duplicate in path order', async () => {
    const catalog = await buildNotesCatalog({
      '/developer-notes/z.json': note('xrpl::STTx', { purpose: 'second' }),
      '/developer-notes/a.json': note('xrpl::STTx', { purpose: 'first' }),
      '/developer-notes/bad.json': { schemaVersion: 2, symbol: 'xrpl::STObject' },
      '/developer-notes/old.json': { schemaVersion: 1, symbol: 'xrpl::isXRP', notes: { purpose: 'Old.' } },
    });
    expect(catalog.size).toBe(1);
    const { entry } = catalog.notesFor({ record: { kind: 'class', qualifiedName: 'xrpl::STTx' } });
    expect(entry.purpose).toBe('first');
  });

  it('resolves symbol links to classes, overload sets and single overloads', async () => {
    const catalog = await buildNotesCatalog({
      '/developer-notes/a.json': note('xrpl::STTx', { importantNotes: `See [it](symbol:${ASSET}).` }),
    });
    expect(catalog.resolve('xrpl::STTx', DIRECTORY)).toBe('xrpl/STTx');
    expect(catalog.resolve('xrpl::isXRP', DIRECTORY)).toBe('xrpl/isXRP');
    expect(catalog.resolve(ASSET, DIRECTORY)).toBe('xrpl/isXRP/6b2a4439');
    expect(catalog.resolve('xrpl::Gone', DIRECTORY)).toBeNull();
    expect(catalog.resolve('xrpl::gone(int)', DIRECTORY)).toBeNull();
    expect(catalog.resolve('xrpl::STTx::method(int)', DIRECTORY)).toBeNull();
  });

  it('links an overload to its overload set when hashing is unavailable', async () => {
    const catalog = await buildNotesCatalog(
      { '/developer-notes/a.json': note('xrpl::STTx', { purpose: `See [it](symbol:${ASSET}).` }) },
      null,
    );
    expect(catalog.resolve(ASSET, DIRECTORY)).toBe('xrpl/isXRP');
  });
});
