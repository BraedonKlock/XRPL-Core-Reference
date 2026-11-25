import { ATTACH_DEDUCTION_GUIDES, attachDeductionGuides } from './attach-deduction-guides.js';
import { CORRECT_MACRO_LOCATION_LINES, correctMacroLocationLines } from './correct-macro-location-lines.js';
import {
  MERGE_DUPLICATE_MEMBER_RECORDS,
  mergeDuplicateMemberRecords,
} from './merge-duplicate-member-records.js';
import {
  MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS,
  mergeFoldedExplicitSpecializations,
} from './merge-folded-explicit-specializations.js';
import {
  MERGE_MISPARSED_VARIABLE_DEFINITIONS,
  mergeMisparsedVariableDefinitions,
} from './merge-misparsed-variable-definitions.js';
import {
  RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS,
  reclassifyLiteralInitializedConstants,
} from './reclassify-literal-initialized-constants.js';
import {
  REMOVE_UNVERIFIABLE_LOCATION_LINES,
  removeUnverifiableLocationLines,
} from './remove-unverifiable-location-lines.js';
import {
  SPLIT_TRAILING_REQUIRES_CLAUSE,
  splitTrailingRequiresClause,
} from './split-trailing-requires-clause.js';
import {
  SUPPRESS_MACRO_DEFINER_DOCUMENTATION,
  suppressMacroDefinerDocumentation,
} from './suppress-macro-definer-documentation.js';
import {
  SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION,
  suppressUnterminatedCommentDocumentation,
} from './suppress-unterminated-comment-documentation.js';

export const DOXYGEN_CORRECTIONS = Object.freeze([
  {
    id: MERGE_DUPLICATE_MEMBER_RECORDS,
    limitation: 'Template members declared in-class and defined out-of-class are emitted twice with one id.',
    apply: mergeDuplicateMemberRecords,
  },
  {
    id: ATTACH_DEDUCTION_GUIDES,
    limitation:
      'Class template argument deduction guides are parsed as free functions named after the class.',
    apply: attachDeductionGuides,
  },
  {
    id: MERGE_MISPARSED_VARIABLE_DEFINITIONS,
    limitation: 'Out-of-line variable definitions with direct-initialization also appear as functions.',
    apply: mergeMisparsedVariableDefinitions,
  },
  {
    id: RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS,
    limitation: 'Direct-initialized constants with literal arguments are parsed as function declarations.',
    apply: reclassifyLiteralInitializedConstants,
  },
  {
    id: SPLIT_TRAILING_REQUIRES_CLAUSE,
    limitation: 'A trailing requires clause after a trailing return type is folded into the return type.',
    apply: splitTrailingRequiresClause,
  },
  {
    id: MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS,
    limitation: 'Explicit member specializations defined out-of-line are folded onto the primary template.',
    apply: mergeFoldedExplicitSpecializations,
  },
  {
    id: CORRECT_MACRO_LOCATION_LINES,
    limitation: 'Symbols expanded from .macro include files report shifted or unrelated line numbers.',
    apply: correctMacroLocationLines,
  },
  {
    id: SUPPRESS_MACRO_DEFINER_DOCUMENTATION,
    limitation: 'Documentation written for an X-macro definition is attached to the first expansion.',
    apply: suppressMacroDefinerDocumentation,
  },
  {
    id: SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION,
    limitation: 'An unterminated comment in upstream source shifts documentation onto the wrong symbols.',
    apply: suppressUnterminatedCommentDocumentation,
  },
  {
    id: REMOVE_UNVERIFIABLE_LOCATION_LINES,
    limitation: 'Doxygen occasionally reports a declaration line that does not contain the symbol.',
    apply: removeUnverifiableLocationLines,
  },
]);

export function applyCorrections(symbols, context, corrections = DOXYGEN_CORRECTIONS) {
  let current = symbols;
  const report = [];
  for (const correction of corrections) {
    const result = correction.apply(current, context);
    current = result.symbols;
    report.push({
      id: correction.id,
      limitation: correction.limitation,
      applied: result.applied.length,
      unresolved: result.unresolved.length,
      appliedExamples: result.applied.slice(0, 10),
      unresolvedItems: result.unresolved,
    });
  }
  return { symbols: current, report };
}
