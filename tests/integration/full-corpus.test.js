import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeExtraction, resolveSymbols } from '../../scripts/documentation/build-dataset.js';
import { PROJECT_PATHS } from '../../scripts/documentation/config/pipeline-config.js';

const PINNED_COMMIT = 'c2534ff9c84422e00711da31629a76f3f59feb98';
const EXTRACTION = join(PROJECT_PATHS.extractionsDirectory, PINNED_COMMIT);
const hasLocalExtraction =
  existsSync(join(EXTRACTION, 'xml', 'index.xml')) && existsSync(PROJECT_PATHS.sourceCheckout);

describe.skipIf(!hasLocalExtraction)('full rippled corpus at the pinned commit', () => {
  let records;
  let resolved;

  beforeAll(() => {
    resolved = resolveSymbols(
      normalizeExtraction({
        extractionDirectory: EXTRACTION,
        sourceRoot: PROJECT_PATHS.sourceCheckout,
        includedCategories: ['production'],
      }),
    );
    records = resolved.records;
  });

  const byQualifiedName = (qualifiedName) =>
    records.filter((record) => record.qualifiedName === qualifiedName);

  it('has no URL collisions', () => {
    expect(resolved.pathCollisions).toEqual([]);
  });

  it('resolves STTx bases to their documented classes', () => {
    const [sttx] = byQualifiedName('xrpl::STTx');
    expect(sttx.baseClasses.map((base) => base.target?.path)).toEqual([
      'xrpl/STObject',
      'xrpl/CountedObject',
    ]);
  });

  it('distinguishes the Payment transactor from the generated builder', () => {
    const payments = records.filter((record) => record.name === 'Payment' && record.kind === 'class');
    expect(payments.map((record) => record.path).sort()).toEqual([
      'xrpl/Payment',
      'xrpl/transactions/Payment',
    ]);
  });

  it('keeps every transactor preflight as its own addressable overload', () => {
    const preflights = records.filter((record) => record.name === 'preflight' && record.kind === 'function');
    expect(preflights.length).toBeGreaterThan(70);
    expect(new Set(preflights.map((record) => record.path)).size).toBe(preflights.length);
  });

  it('resolves every structured reference except unresolvable friend declarations', () => {
    expect(Object.keys(resolved.referenceStatistics.unresolvedByReason).sort()).toEqual(
      expect.arrayContaining(['friend-class-relationship']),
    );
    expect(resolved.referenceStatistics.unresolvedByReason['unknown-target'] ?? 0).toBeLessThanOrEqual(1);
  });
});
