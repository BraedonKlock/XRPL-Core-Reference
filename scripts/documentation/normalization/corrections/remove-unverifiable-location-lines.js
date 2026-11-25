import { expectedSourceNames, findNameOffset } from '../source-name-verification.js';
import { createCorrectionResult, markCorrected, recordUnresolved } from './correction-result.js';

export const REMOVE_UNVERIFIABLE_LOCATION_LINES = 'remove-unverifiable-location-lines';

const SKIPPED_KINDS = new Set(['namespace', 'friendClass', 'macro', 'unsupported']);

export function removeUnverifiableLocationLines(symbols, { sourceFiles }) {
  const result = createCorrectionResult(symbols);
  for (const symbol of symbols) {
    const declaration = symbol.location?.declaration;
    if (SKIPPED_KINDS.has(symbol.kind) || !declaration?.line || !sourceFiles.exists(declaration.file)) {
      continue;
    }
    if (
      findNameOffset(sourceFiles, declaration.file, declaration.line, expectedSourceNames(symbol)) !== null
    ) {
      continue;
    }
    symbol.location = { ...symbol.location, declaration: { file: declaration.file, line: null } };
    markCorrected(symbol, REMOVE_UNVERIFIABLE_LOCATION_LINES);
    recordUnresolved(
      result,
      symbol,
      `declaration line ${declaration.line} in ${declaration.file} does not mention the symbol within 3 lines; line removed`,
    );
  }
  return result;
}
