import { describe, expect, it } from 'vitest';
import {
  classRecord,
  functionRecord,
  namespaceRecord,
  TEST_COMMIT_SHA,
} from '../../../tests/helpers/public-records.js';
import { assembleDataset } from '../build-dataset.js';
import { checkDatasetIntegrity } from './dataset-integrity.js';

function records() {
  return [
    namespaceRecord('xrpl', { nested: ['xrpl/ApplyContext', 'xrpl/ApplyView'] }),
    classRecord('xrpl/ApplyView', { scope: 'xrpl' }),
    classRecord('xrpl/ApplyContext', {
      scope: 'xrpl',
      members: ['xrpl/ApplyContext/view/aaaaaaaa'],
    }),
    functionRecord('xrpl/ApplyContext/view', 'aaaaaaaa', {
      scope: 'xrpl/ApplyContext',
      role: 'method',
      returnType: [{ text: 'ApplyView', target: { path: 'xrpl/ApplyView', resolution: 'doxygen' } }],
    }),
  ];
}

describe('dataset integrity', () => {
  it('accepts a consistent dataset', () => {
    const result = checkDatasetIntegrity({
      commitSha: TEST_COMMIT_SHA,
      ...assembleDataset(records(), TEST_COMMIT_SHA),
    });
    expect(result.errors).toEqual([]);
    expect(result.brokenLinkCount).toBe(0);
    expect(result.symbolCount).toBe(4);
  });

  it('detects broken links', () => {
    const broken = records();
    broken[3].returnType = [{ text: 'Missing', target: { path: 'xrpl/Missing', resolution: 'doxygen' } }];
    const result = checkDatasetIntegrity({
      commitSha: TEST_COMMIT_SHA,
      ...assembleDataset(broken, TEST_COMMIT_SHA),
    });
    expect(result.brokenLinks).toEqual([
      { from: 'xrpl/ApplyContext/view/aaaaaaaa', to: 'xrpl/Missing', fragment: null },
    ]);
  });

  it('detects mixed source revisions', () => {
    const dataset = assembleDataset(records(), TEST_COMMIT_SHA);
    dataset.shards[0] = { ...dataset.shards[0], commitSha: 'f'.repeat(40) };
    const result = checkDatasetIntegrity({ commitSha: TEST_COMMIT_SHA, ...dataset });
    expect(result.errors.some((error) => error.includes('belongs to commit'))).toBe(true);
  });

  it('detects schema violations and inconsistent search rows', () => {
    const dataset = assembleDataset(records(), TEST_COMMIT_SHA);
    dataset.searchIndex.rows[0] = [...dataset.searchIndex.rows[0]];
    dataset.searchIndex.rows[0][8] = 99;
    expect(checkDatasetIntegrity({ commitSha: TEST_COMMIT_SHA, ...dataset }).errorCount).toBeGreaterThan(0);
  });
});
