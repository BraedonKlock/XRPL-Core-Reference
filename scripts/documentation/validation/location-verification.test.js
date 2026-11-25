import { describe, expect, it } from 'vitest';
import { functionRecord } from '../../../tests/helpers/public-records.js';
import { createInMemorySourceFileReader } from '../parsing/source-files.js';
import { verifySourceLocations } from './location-verification.js';

const SOURCE = createInMemorySourceFileReader({
  'a.h': [
    'class A',
    '{',
    '    [[nodiscard]] ApplyView const&',
    '    view() const;',
    '    bool',
    '    operator==(A const&) const;',
    '};',
  ].join('\n'),
});

function at(name, line, overrides = {}) {
  return functionRecord(`x/${name}`, '00000000', {
    name,
    location: { declaration: { file: 'a.h', line }, definition: null },
    ...overrides,
  });
}

describe('location verification', () => {
  it('classifies exact, nearby, unavailable and missing locations', () => {
    const result = verifySourceLocations(
      [
        at('view', 4),
        at('view', 3),
        at('operator==', 6, { role: 'operator' }),
        at('missing', 1),
        at('view', null),
        { ...at('view', 1), location: { declaration: { file: 'none.h', line: 1 }, definition: null } },
      ],
      SOURCE,
    );
    expect(result.outcomes).toEqual({
      exact: 2,
      nearby: 1,
      wide: 0,
      notFound: 1,
      lineUnavailable: 1,
      missingFile: 1,
    });
    expect(result.notFoundExamples).toEqual([
      { path: 'x/missing/00000000', kind: 'function', file: 'a.h', line: 1 },
    ]);
  });
});
