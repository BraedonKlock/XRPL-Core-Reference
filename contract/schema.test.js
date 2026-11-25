import { describe, expect, it } from 'vitest';
import { classRecord, functionRecord } from '../tests/helpers/public-records.js';
import { commitShaSchema, inlineSchema, symbolPathSchema, symbolSchema, typeTokenSchema } from './schema.js';

describe('documentation data contract', () => {
  it('accepts valid symbol records', () => {
    expect(symbolSchema.safeParse(classRecord('xrpl/ApplyContext', { scope: 'xrpl' })).success).toBe(true);
    expect(symbolSchema.safeParse(functionRecord('xrpl/ApplyContext/view', 'aaaaaaaa')).success).toBe(true);
  });

  it('rejects records with unknown fields or kinds', () => {
    expect(symbolSchema.safeParse({ ...classRecord('xrpl/A'), extra: true }).success).toBe(false);
    expect(symbolSchema.safeParse({ ...classRecord('xrpl/A'), kind: 'module' }).success).toBe(false);
  });

  it('requires full commit SHAs and relative paths', () => {
    expect(commitShaSchema.safeParse('c2534ff').success).toBe(false);
    expect(symbolPathSchema.safeParse('/xrpl/STTx').success).toBe(false);
    expect(symbolPathSchema.safeParse('xrpl//STTx').success).toBe(false);
    expect(symbolPathSchema.safeParse('xrpl/STTx').success).toBe(true);
  });

  it('requires link inlines to carry resolved targets', () => {
    expect(inlineSchema.safeParse({ type: 'link', text: 'STTx' }).success).toBe(false);
    expect(
      inlineSchema.safeParse({
        type: 'link',
        text: 'STTx',
        target: { path: 'xrpl/STTx', resolution: 'doxygen' },
      }).success,
    ).toBe(true);
    expect(typeTokenSchema.safeParse({ text: 'STTx', refId: 'classxrpl_1_1STTx' }).success).toBe(false);
  });
});
