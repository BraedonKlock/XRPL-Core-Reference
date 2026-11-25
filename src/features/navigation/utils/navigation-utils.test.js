import { describe, expect, it } from 'vitest';
import { nearestNavigablePath } from './navigable-path.js';
import { toggledExpansion, withAncestorsExpanded } from './tree-expansion.js';

const KINDS = {
  xrpl: 'namespace',
  'xrpl/SHAMap': 'class',
  'xrpl/SHAMap/ConstIterator': 'class',
  'xrpl/SHAMap/fetch': 'function',
};
const directory = { get: (path) => (KINDS[path] ? { kind: KINDS[path] } : null) };

describe('navigation utilities', () => {
  it('expands every ancestor of the active path without collapsing others', () => {
    const expanded = withAncestorsExpanded(new Set(['beast']), 'xrpl/SHAMap/ConstIterator');
    expect([...expanded].sort()).toEqual(['beast', 'xrpl', 'xrpl/SHAMap']);
    const unchanged = new Set(['xrpl']);
    expect(withAncestorsExpanded(unchanged, 'xrpl/SHAMap')).toBe(unchanged);
    expect(withAncestorsExpanded(unchanged, null)).toBe(unchanged);
  });

  it('toggles a single path immutably', () => {
    const original = new Set(['xrpl']);
    expect(toggledExpansion(original, 'xrpl').has('xrpl')).toBe(false);
    expect(toggledExpansion(original, 'beast').has('beast')).toBe(true);
    expect(original.has('xrpl')).toBe(true);
  });

  it('finds the nearest namespace or class for member pages', () => {
    expect(nearestNavigablePath('xrpl/SHAMap/fetch/1234abcd', directory)).toBe('xrpl/SHAMap');
    expect(nearestNavigablePath('xrpl/SHAMap/ConstIterator', directory)).toBe('xrpl/SHAMap/ConstIterator');
    expect(nearestNavigablePath(null, directory)).toBeNull();
  });
});
