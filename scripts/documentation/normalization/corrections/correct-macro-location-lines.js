import {
  X_MACRO_DEFINERS,
  X_MACRO_FILE_EXTENSION,
  X_MACRO_TOKEN_PASTE_PREFIXES,
} from '../../config/pipeline-config.js';
import {
  createCorrectionResult,
  markCorrected,
  recordApplied,
  recordUnresolved,
} from './correction-result.js';

export const CORRECT_MACRO_LOCATION_LINES = 'correct-macro-location-lines';

const PASTED_SUFFIX_START = /^[A-Z0-9_]/;
const MAX_INVOCATION_SPAN = 200;
const INVOCATION_START = new RegExp(`^\\s*(${X_MACRO_DEFINERS.join('|')})\\s*\\(`);

export function macroInvocationNamesOf(symbolName) {
  const pastedSuffixes = X_MACRO_TOKEN_PASTE_PREFIXES.filter((prefix) => symbolName.startsWith(prefix))
    .map((prefix) => symbolName.slice(prefix.length))
    .filter((suffix) => PASTED_SUFFIX_START.test(suffix));
  return [symbolName, ...pastedSuffixes];
}

function lineMentionsAnyName(lineText, names) {
  return names.some((name) => new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(lineText ?? ''));
}

function codeWithoutStringsAndComments(lineText) {
  return lineText.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/.*$/, '');
}

function lineWhereParenthesesClose(file, startLine, endLine, sourceFiles) {
  let depth = 0;
  for (let line = startLine; line <= endLine; line += 1) {
    for (const character of codeWithoutStringsAndComments(sourceFiles.lineAt(file, line) ?? '')) {
      if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
        if (depth === 0) {
          return line;
        }
      }
    }
  }
  return null;
}

export function findInvocationEndingBefore(position, names, sourceFiles) {
  const lastLine = position.line - 1;
  for (let line = lastLine; line >= Math.max(1, position.line - MAX_INVOCATION_SPAN); line -= 1) {
    const text = sourceFiles.lineAt(position.file, line) ?? '';
    if (!INVOCATION_START.test(text)) {
      continue;
    }
    const closesJustBefore =
      lineWhereParenthesesClose(position.file, line, lastLine, sourceFiles) === lastLine;
    return lineMentionsAnyName(text, names) && closesJustBefore ? line : null;
  }
  return null;
}

export function verifyMacroLine(position, names, sourceFiles) {
  if (lineMentionsAnyName(sourceFiles.lineAt(position.file, position.line), names)) {
    return { status: 'verified', line: position.line };
  }
  const invocationLine = findInvocationEndingBefore(position, names, sourceFiles);
  if (invocationLine !== null) {
    return { status: 'corrected', line: invocationLine };
  }
  return { status: 'unverifiable', line: null };
}

function isMacroPosition(position) {
  return Boolean(position?.line) && position.file.endsWith(X_MACRO_FILE_EXTENSION);
}

export function correctMacroLocationLines(symbols, { sourceFiles }) {
  const result = createCorrectionResult(symbols);
  for (const symbol of symbols) {
    if (!symbol.location) {
      continue;
    }
    const names = macroInvocationNamesOf(symbol.name);
    for (const positionKey of ['declaration', 'definition']) {
      const position = symbol.location[positionKey];
      if (!isMacroPosition(position)) {
        continue;
      }
      const outcome = verifyMacroLine(position, names, sourceFiles);
      if (outcome.status === 'verified') {
        continue;
      }
      symbol.location = { ...symbol.location, [positionKey]: { ...position, line: outcome.line } };
      if (positionKey === 'definition' && outcome.line === null) {
        symbol.location = { ...symbol.location, definition: null };
      }
      markCorrected(symbol, CORRECT_MACRO_LOCATION_LINES);
      if (outcome.status === 'corrected') {
        recordApplied(
          result,
          symbol,
          `${positionKey} line ${position.line} corrected to ${outcome.line} in ${position.file}`,
        );
      } else {
        recordUnresolved(
          result,
          symbol,
          `${positionKey} line ${position.line} in ${position.file} does not mention the symbol; line removed`,
        );
      }
    }
  }
  return result;
}
