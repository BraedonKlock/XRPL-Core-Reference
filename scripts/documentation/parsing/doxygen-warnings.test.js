import { describe, expect, it } from 'vitest';
import { findUnterminatedComments, parseDoxygenWarnings, summarizeWarnings } from './doxygen-warnings.js';

const LOG = [
  '/src/rippled/include/xrpl/consensus/Validations.h:1177: warning: Reached end of file while still inside a (nested) comment. Nesting level 1 (possible line reference(s): 498)',
  "include/xrpl/protocol/TxFormats.h:44: warning: Found non-existing group 'protocol' for the command '@ingroup', ignoring command",
  'not a warning line',
].join('\n');

describe('doxygen warnings', () => {
  it('parses warnings into repository-relative locations', () => {
    const warnings = parseDoxygenWarnings(LOG, '/src/rippled');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatchObject({ file: 'include/xrpl/consensus/Validations.h', line: 1177 });
    expect(warnings[1].file).toBe('include/xrpl/protocol/TxFormats.h');
  });

  it('identifies where an unterminated comment starts', () => {
    expect(findUnterminatedComments(parseDoxygenWarnings(LOG, '/src/rippled'))).toEqual([
      { file: 'include/xrpl/consensus/Validations.h', startLine: 498 },
    ]);
  });

  it('summarizes warnings by category', () => {
    const summary = summarizeWarnings(parseDoxygenWarnings(LOG, '/src/rippled'));
    expect(summary.total).toBe(2);
    expect(Object.values(summary.byCategory).reduce((total, count) => total + count, 0)).toBe(2);
  });
});
