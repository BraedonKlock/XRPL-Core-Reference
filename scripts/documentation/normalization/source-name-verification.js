import { macroInvocationNamesOf } from './corrections/correct-macro-location-lines.js';
import { templateBaseNameOf } from './qualified-name.js';

export const WIDE_LINE_TOLERANCE = 3;
const OPERATOR_TOKEN = 'operator';
const OPERATOR_ROLES = new Set(['operator', 'conversion']);

function escapeForPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function expectedSourceNames(symbol) {
  if (
    symbol.kind === 'function' &&
    (OPERATOR_ROLES.has(symbol.role) || symbol.name.startsWith(OPERATOR_TOKEN))
  ) {
    return [OPERATOR_TOKEN];
  }
  return macroInvocationNamesOf(templateBaseNameOf(symbol.name.replace(/^~/, '')));
}

export function findNameOffset(sourceFiles, file, line, names, tolerance = WIDE_LINE_TOLERANCE) {
  const patterns = names.map(
    (name) => new RegExp(`(^|[^A-Za-z0-9_])${escapeForPattern(name)}([^A-Za-z0-9_]|$)`),
  );
  for (let offset = 0; offset <= tolerance; offset += 1) {
    const candidates = offset === 0 ? [line] : [line - offset, line + offset];
    for (const candidate of candidates) {
      const text = sourceFiles.lineAt(file, candidate);
      if (text !== null && patterns.some((pattern) => pattern.test(text))) {
        return offset;
      }
    }
  }
  return null;
}
