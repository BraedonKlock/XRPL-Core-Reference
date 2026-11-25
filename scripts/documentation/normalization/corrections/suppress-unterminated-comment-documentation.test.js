import { describe, expect, it } from 'vitest';
import { emptyDocumentation } from '../documentation.js';
import { functionSymbol, location, parameter } from '../../../../tests/helpers/symbol-builders.js';
import {
  SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION,
  suppressUnterminatedCommentDocumentation,
} from './suppress-unterminated-comment-documentation.js';

const VALIDATIONS = 'include/xrpl/consensus/Validations.h';
const REGIONS = [{ file: VALIDATIONS, startLine: 498 }];

function documentedMethod(name, line) {
  return functionSymbol({
    qualifiedName: `xrpl::Validations::${name}`,
    documentation: {
      ...emptyDocumentation(),
      brief: [{ type: 'text', text: 'Iterate current validations.' }],
    },
    parameters: [parameter('F&&', 'f', { description: [{ type: 'text', text: 'Invocable' }] })],
    location: location(VALIDATIONS, line),
  });
}

describe(SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION, () => {
  it('suppresses documentation from the unterminated comment onward', () => {
    const before = documentedMethod('trie', 480);
    const after = documentedMethod('byLedger', 555);
    const result = suppressUnterminatedCommentDocumentation([before, after], {
      unterminatedComments: REGIONS,
    });
    expect(before.documentation.brief).not.toBeNull();
    expect(after.documentation.brief).toBeNull();
    expect(after.documentation.suppressionReason).toMatch(/Validations\.h:498/);
    expect(after.parameters[0].description).toBeNull();
    expect(after.corrections).toEqual([SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION]);
    expect(result.applied).toHaveLength(1);
  });

  it('does nothing for undocumented symbols or other files', () => {
    const undocumented = functionSymbol({ qualifiedName: 'x', location: location(VALIDATIONS, 600) });
    const otherFile = { ...documentedMethod('other', 600), location: location('include/xrpl/Other.h', 600) };
    expect(
      suppressUnterminatedCommentDocumentation([undocumented, otherFile], { unterminatedComments: REGIONS })
        .applied,
    ).toHaveLength(0);
  });
});
