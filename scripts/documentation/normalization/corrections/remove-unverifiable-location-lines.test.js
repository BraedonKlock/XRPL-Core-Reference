import { describe, expect, it } from 'vitest';
import { createInMemorySourceFileReader } from '../../parsing/source-files.js';
import { functionSymbol, location } from '../../../../tests/helpers/symbol-builders.js';
import {
  REMOVE_UNVERIFIABLE_LOCATION_LINES,
  removeUnverifiableLocationLines,
} from './remove-unverifiable-location-lines.js';

const FILE = 'include/xrpl/protocol/MPTAmount.h';
const SOURCE = createInMemorySourceFileReader({
  [FILE]: [
    'constexpr MPTAmount::value_type',
    'MPTAmount::value() const',
    '{',
    '    return value_;',
    '}',
    '',
    '',
    '',
    '',
  ].join('\n'),
});

describe(REMOVE_UNVERIFIABLE_LOCATION_LINES, () => {
  it('removes a declaration line that does not mention the symbol nearby', () => {
    const misplaced = functionSymbol({
      name: 'operator<<',
      role: 'function',
      qualifiedName: 'xrpl::operator<<',
      location: location(FILE, 2),
    });
    const result = removeUnverifiableLocationLines([misplaced], { sourceFiles: SOURCE });
    expect(misplaced.location.declaration).toEqual({ file: FILE, line: null });
    expect(misplaced.corrections).toEqual([REMOVE_UNVERIFIABLE_LOCATION_LINES]);
    expect(result.unresolved).toHaveLength(1);
  });

  it('keeps lines within the tolerance window', () => {
    const value = functionSymbol({
      name: 'value',
      role: 'method',
      qualifiedName: 'xrpl::MPTAmount::value',
      location: location(FILE, 4),
    });
    removeUnverifiableLocationLines([value], { sourceFiles: SOURCE });
    expect(value.location.declaration.line).toBe(4);
  });

  it('skips files that are not available and relationship-only records', () => {
    const missing = functionSymbol({ qualifiedName: 'xrpl::missing', location: location('missing.h', 3) });
    const friendClass = {
      ...functionSymbol({ qualifiedName: 'xrpl::Friend', location: location(FILE, 2) }),
      kind: 'friendClass',
    };
    expect(
      removeUnverifiableLocationLines([missing, friendClass], { sourceFiles: SOURCE }).unresolved,
    ).toHaveLength(0);
  });
});
