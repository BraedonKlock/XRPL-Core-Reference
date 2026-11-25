import { describe, expect, it } from 'vitest';
import { SEARCH_INDEX_COLUMNS } from '../../../contract/constants.js';
import { ancestorPathsOf, createSymbolDirectory, parentPathOf } from './symbol-directory.js';

const INDEX = {
  columns: [...SEARCH_INDEX_COLUMNS],
  shards: ['aaaa', 'bbbb'],
  rows: [
    ['xrpl', 'xrpl', 'xrpl', 'namespace', null, null, 'production', null, 0, 1],
    [
      'xrpl/ApplyContext',
      'ApplyContext',
      'xrpl::ApplyContext',
      'class',
      null,
      'xrpl',
      'production',
      'State information when applying a tx.',
      1,
      1,
    ],
    [
      'xrpl/ApplyContext/view',
      'view',
      'xrpl::ApplyContext::view',
      'function',
      'method',
      'xrpl::ApplyContext',
      'production',
      null,
      1,
      2,
    ],
  ],
};

describe('symbol directory', () => {
  const directory = createSymbolDirectory(INDEX);

  it('maps rows to entries with shard ids', () => {
    expect(directory.get('xrpl/ApplyContext')).toMatchObject({
      kind: 'class',
      shard: 'bbbb',
      brief: 'State information when applying a tx.',
    });
    expect(directory.findByQualifiedName('xrpl::ApplyContext').path).toBe('xrpl/ApplyContext');
    expect(directory.size).toBe(3);
  });

  it('resolves overload paths through their overload set', () => {
    expect(directory.resolve('xrpl/ApplyContext/view')).toMatchObject({ overloadPath: null });
    expect(directory.resolve('xrpl/ApplyContext/view/8ca9df3f')).toMatchObject({
      entry: { path: 'xrpl/ApplyContext/view' },
      overloadPath: 'xrpl/ApplyContext/view/8ca9df3f',
    });
    expect(directory.resolve('xrpl/ApplyContext/notAHash')).toBeNull();
    expect(directory.resolve('xrpl/Unknown')).toBeNull();
  });

  it('computes parent and ancestor paths', () => {
    expect(parentPathOf('xrpl')).toBeNull();
    expect(ancestorPathsOf('xrpl/SHAMap/ConstIterator')).toEqual(['xrpl', 'xrpl/SHAMap']);
  });
});
