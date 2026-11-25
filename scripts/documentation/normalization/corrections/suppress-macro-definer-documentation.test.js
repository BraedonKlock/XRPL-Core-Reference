import { describe, expect, it } from 'vitest';
import { emptyDocumentation } from '../documentation.js';
import { variableSymbol } from '../../../../tests/helpers/symbol-builders.js';
import {
  describesMacroDefiner,
  SUPPRESS_MACRO_DEFINER_DOCUMENTATION,
  suppressMacroDefinerDocumentation,
} from './suppress-macro-definer-documentation.js';

function documented(briefText) {
  return { ...emptyDocumentation(), brief: [{ type: 'text', text: briefText }] };
}

describe(SUPPRESS_MACRO_DEFINER_DOCUMENTATION, () => {
  it('suppresses documentation written for an X-macro definer on enumerators', () => {
    const txType = variableSymbol({
      qualifiedName: 'xrpl::TxType',
      enumerators: [
        { name: 'ttPAYMENT', documentation: documented('TRANSACTION(tag, value, name, settings, fields).') },
        {
          name: 'ttESCROW_CREATE',
          documentation: documented('This transaction type creates an escrow object.'),
        },
      ],
    });
    const result = suppressMacroDefinerDocumentation([txType]);
    expect(txType.enumerators[0].documentation.suppressionReason).toMatch(/X-macro/);
    expect(txType.enumerators[1].documentation.brief).not.toBeNull();
    expect(result.applied).toHaveLength(1);
  });

  it('recognizes only configured macro invocations', () => {
    expect(describesMacroDefiner(documented('TYPED_SFIELD(name, type, value)'))).toBe(true);
    expect(describesMacroDefiner(documented('Transaction(s) that modify the vault'))).toBe(false);
  });
});
