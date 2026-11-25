import { describe, expect, it } from 'vitest';
import {
  classRecord,
  documented,
  functionRecord,
  namespaceRecord,
  TEST_COMMIT_SHA,
  variableRecord,
} from '../../../tests/helpers/public-records.js';
import {
  assignShards,
  briefPreviewOf,
  buildNavigation,
  buildRelationships,
  buildSearchIndex,
  shardIdOf,
} from './dataset-assembly.js';

function smallCorpus() {
  const xrpl = namespaceRecord('xrpl', { nested: ['xrpl/ApplyContext', 'xrpl/detail'] });
  const detail = namespaceRecord('xrpl/detail', { scope: 'xrpl' });
  const applyContext = classRecord('xrpl/ApplyContext', {
    scope: 'xrpl',
    documentation: documented('State information when applying a tx.'),
    baseClasses: [{ name: 'std::exception', target: null, access: 'public', isVirtual: false }],
  });
  const view = functionRecord('xrpl/ApplyContext/view', 'aaaaaaaa', {
    scope: 'xrpl/ApplyContext',
    role: 'method',
  });
  const viewConst = functionRecord('xrpl/ApplyContext/view', 'bbbbbbbb', {
    scope: 'xrpl/ApplyContext',
    role: 'method',
    documentation: documented('Read-only view.'),
  });
  const toString = functionRecord('xrpl/to_string', 'cccccccc', { scope: 'xrpl' });
  return [xrpl, detail, applyContext, view, viewConst, toString];
}

describe('dataset assembly', () => {
  it('places class members in the class shard and namespace members with their namespace', () => {
    const records = smallCorpus();
    const { shardIdByPath, shards } = assignShards(records);
    expect(shardIdByPath.get('xrpl/ApplyContext/view/aaaaaaaa')).toBe(shardIdOf('xrpl/ApplyContext'));
    expect(shardIdByPath.get('xrpl/to_string/cccccccc')).toBe(shardIdOf('xrpl'));
    expect(shards.reduce((total, shard) => total + shard.symbols.length, 0)).toBe(records.length);
  });

  it('buckets large namespaces by member name while keeping overloads together', () => {
    const members = Array.from({ length: 450 }, (_, position) =>
      variableRecord(`xrpl/v${position}`, { scope: 'xrpl' }),
    );
    const overloads = [
      functionRecord('xrpl/apply', '11111111', { scope: 'xrpl' }),
      functionRecord('xrpl/apply', '22222222', { scope: 'xrpl' }),
    ];
    const { shardIdByPath } = assignShards([namespaceRecord('xrpl'), ...members, ...overloads]);
    expect(shardIdByPath.get('xrpl/v1')).toBe(shardIdOf('xrpl@v'));
    expect(shardIdByPath.get('xrpl/apply/11111111')).toBe(shardIdOf('xrpl@a'));
    expect(shardIdByPath.get('xrpl/apply/22222222')).toBe(shardIdByPath.get('xrpl/apply/11111111'));
  });

  it('indexes overload sets once with their overload count', () => {
    const records = smallCorpus();
    const { shards, shardIdByPath } = assignShards(records);
    const index = buildSearchIndex(records, {
      shardIdByPath,
      shardIds: shards.map((shard) => shard.shard),
      commitSha: TEST_COMMIT_SHA,
    });
    const viewRow = index.rows.find((row) => row[0] === 'xrpl/ApplyContext/view');
    expect(viewRow).toEqual([
      'xrpl/ApplyContext/view',
      'view',
      'xrpl::ApplyContext::view',
      'function',
      'method',
      'xrpl::ApplyContext',
      'production',
      'Read-only view.',
      expect.any(Number),
      2,
    ]);
    expect(index.shards[viewRow[8]]).toBe(shardIdOf('xrpl/ApplyContext'));
    expect(index.rows.map((row) => row[0])).toEqual([...index.rows.map((row) => row[0])].sort());
  });

  it('builds a namespace and class navigation tree', () => {
    const navigation = buildNavigation(smallCorpus(), { commitSha: TEST_COMMIT_SHA });
    expect(navigation.roots).toHaveLength(1);
    expect(navigation.roots[0].children.map((child) => [child.kind, child.name])).toEqual([
      ['namespace', 'detail'],
      ['class', 'ApplyContext'],
    ]);
  });

  it('records inheritance, including unresolved external bases', () => {
    const relationships = buildRelationships(smallCorpus(), { commitSha: TEST_COMMIT_SHA });
    expect(relationships.inheritance).toEqual([
      {
        derived: 'xrpl/ApplyContext',
        base: null,
        baseName: 'std::exception',
        access: 'public',
        isVirtual: false,
      },
    ]);
  });

  it('truncates long brief previews', () => {
    expect(briefPreviewOf(documented('x'.repeat(400)))).toHaveLength(160);
    expect(briefPreviewOf({ brief: null })).toBeNull();
  });
});
