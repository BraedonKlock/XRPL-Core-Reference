import { hasDocumentationContent } from '../documentation.js';
import {
  createCorrectionResult,
  markCorrected,
  recordApplied,
  recordUnresolved,
} from './correction-result.js';

export const MERGE_MISPARSED_VARIABLE_DEFINITIONS = 'merge-misparsed-variable-definitions';

const NAMESPACE_SCOPED_OWNER_KINDS = new Set(['namespace', 'global']);

function twinKeyOf(symbol) {
  return `${symbol.ownerId ?? ''}\u0000${symbol.qualifiedName}`;
}

function isNamespaceScopedFunction(symbol) {
  return (
    symbol.kind === 'function' &&
    symbol.role === 'function' &&
    symbol.templateParameters === null &&
    NAMESPACE_SCOPED_OWNER_KINDS.has(symbol.origin.ownerKind)
  );
}

function samePosition(left, right) {
  return Boolean(left && right) && left.file === right.file && left.line === right.line;
}

export function sharesVariablePosition(misparsedFunction, variable) {
  const functionPosition = misparsedFunction.location?.declaration;
  return (
    samePosition(functionPosition, variable.location?.declaration) ||
    samePosition(functionPosition, variable.location?.definition)
  );
}

function mergeIntoVariable(variable, misparsedFunction) {
  const functionPosition = misparsedFunction.location.declaration;
  if (!variable.location.definition && !samePosition(functionPosition, variable.location.declaration)) {
    variable.location = {
      ...variable.location,
      definition: { file: functionPosition.file, line: functionPosition.line, endLine: null },
    };
  }
  if (
    !hasDocumentationContent(variable.documentation) &&
    hasDocumentationContent(misparsedFunction.documentation)
  ) {
    variable.documentation = misparsedFunction.documentation;
  }
}

export function mergeMisparsedVariableDefinitions(symbols) {
  const result = createCorrectionResult([]);
  const variablesByTwinKey = new Map(
    symbols.filter((symbol) => symbol.kind === 'variable').map((variable) => [twinKeyOf(variable), variable]),
  );
  for (const symbol of symbols) {
    const variable = isNamespaceScopedFunction(symbol)
      ? variablesByTwinKey.get(twinKeyOf(symbol))
      : undefined;
    if (!variable) {
      result.symbols.push(symbol);
      continue;
    }
    if (!sharesVariablePosition(symbol, variable)) {
      recordUnresolved(
        result,
        symbol,
        'function shares its name with a variable in the same scope but not its source position',
      );
      result.symbols.push(symbol);
      continue;
    }
    mergeIntoVariable(variable, symbol);
    markCorrected(variable, MERGE_MISPARSED_VARIABLE_DEFINITIONS);
    recordApplied(
      result,
      variable,
      `removed function record ${symbol.origin.argsString} duplicating the variable definition`,
    );
  }
  return result;
}
