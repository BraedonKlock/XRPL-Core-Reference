import { hasDocumentationContent } from '../documentation.js';
import {
  clearParameterDescriptions,
  createCorrectionResult,
  markCorrected,
  recordApplied,
  suppressedDocumentation,
} from './correction-result.js';

export const SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION = 'suppress-unterminated-comment-documentation';

function suppressionReasonFor(region) {
  return `An unterminated documentation comment starting at ${region.file}:${region.startLine} makes Doxygen's attribution unreliable from that line onward.`;
}

function affectedRegion(symbol, regions) {
  const position = symbol.location?.declaration;
  if (!position?.line) {
    return null;
  }
  return regions.find((region) => region.file === position.file && position.line >= region.startLine) ?? null;
}

export function suppressUnterminatedCommentDocumentation(symbols, { unterminatedComments }) {
  const result = createCorrectionResult(symbols);
  for (const symbol of symbols) {
    const region = affectedRegion(symbol, unterminatedComments);
    if (!region) {
      continue;
    }
    const enumeratorsWithDocs = (symbol.enumerators ?? []).filter((enumerator) =>
      hasDocumentationContent(enumerator.documentation),
    );
    if (!hasDocumentationContent(symbol.documentation) && enumeratorsWithDocs.length === 0) {
      continue;
    }
    const reason = suppressionReasonFor(region);
    symbol.documentation = suppressedDocumentation(reason);
    clearParameterDescriptions(symbol);
    enumeratorsWithDocs.forEach((enumerator) => {
      enumerator.documentation = suppressedDocumentation(reason);
    });
    markCorrected(symbol, SUPPRESS_UNTERMINATED_COMMENT_DOCUMENTATION);
    recordApplied(result, symbol, `suppressed documentation after ${region.file}:${region.startLine}`);
  }
  return result;
}
