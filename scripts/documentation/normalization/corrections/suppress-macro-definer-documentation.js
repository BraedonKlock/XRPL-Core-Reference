import { X_MACRO_DEFINERS } from '../../config/pipeline-config.js';
import {
  createCorrectionResult,
  markCorrected,
  recordApplied,
  suppressedDocumentation,
} from './correction-result.js';

export const SUPPRESS_MACRO_DEFINER_DOCUMENTATION = 'suppress-macro-definer-documentation';

const SUPPRESSION_REASON = 'Doxygen attached the documentation of an X-macro definition to this symbol.';
const MACRO_INVOCATION_PREFIX = new RegExp(`^\\s*(${X_MACRO_DEFINERS.join('|')})\\s*\\(`);

function briefText(documentation) {
  return (documentation.brief ?? []).map((inline) => inline.text).join('');
}

export function describesMacroDefiner(documentation) {
  return MACRO_INVOCATION_PREFIX.test(briefText(documentation));
}

export function suppressMacroDefinerDocumentation(symbols) {
  const result = createCorrectionResult(symbols);
  for (const symbol of symbols) {
    if (describesMacroDefiner(symbol.documentation)) {
      symbol.documentation = suppressedDocumentation(SUPPRESSION_REASON);
      markCorrected(symbol, SUPPRESS_MACRO_DEFINER_DOCUMENTATION);
      recordApplied(result, symbol, 'suppressed documentation describing an X-macro definer');
    }
    for (const enumerator of symbol.enumerators ?? []) {
      if (describesMacroDefiner(enumerator.documentation)) {
        enumerator.documentation = suppressedDocumentation(SUPPRESSION_REASON);
        markCorrected(symbol, SUPPRESS_MACRO_DEFINER_DOCUMENTATION);
        recordApplied(
          result,
          symbol,
          `suppressed X-macro definer documentation on enumerator ${enumerator.name}`,
        );
      }
    }
  }
  return result;
}
