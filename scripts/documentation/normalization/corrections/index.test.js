import { describe, expect, it } from 'vitest';
import { applyCorrections, DOXYGEN_CORRECTIONS } from './index.js';

describe('correction registry', () => {
  it('registers every correction once with a documented limitation', () => {
    const ids = DOXYGEN_CORRECTIONS.map((correction) => correction.id);
    expect(new Set(ids).size).toBe(ids.length);
    DOXYGEN_CORRECTIONS.forEach((correction) => expect(correction.limitation.length).toBeGreaterThan(20));
  });

  it('applies corrections in order and reports counts', () => {
    const calls = [];
    const corrections = ['first', 'second'].map((id) => ({
      id,
      limitation: `limitation for ${id}`,
      apply: (symbols) => {
        calls.push(id);
        return { symbols: [...symbols, id], applied: [{ symbolId: id }], unresolved: [] };
      },
    }));
    const { symbols, report } = applyCorrections([], {}, corrections);
    expect(calls).toEqual(['first', 'second']);
    expect(symbols).toEqual(['first', 'second']);
    expect(report.map((entry) => [entry.id, entry.applied, entry.unresolved])).toEqual([
      ['first', 1, 0],
      ['second', 1, 0],
    ]);
  });
});
