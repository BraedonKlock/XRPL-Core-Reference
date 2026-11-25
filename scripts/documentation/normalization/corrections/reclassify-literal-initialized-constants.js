import { expressionText, joinExpressions } from '../type-expression.js';
import { createCorrectionResult, markCorrected, recordApplied } from './correction-result.js';

export const RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS = 'reclassify-literal-initialized-constants';

const STRING_LITERAL = /^(u8|u|U|L)?"(?:[^"\\]|\\.)*"$/;
const CHARACTER_LITERAL = /^(u8|u|U|L)?'(?:[^'\\]|\\.)+'$/;
const NUMERIC_LITERAL =
  /^[-+]?(0[xX][0-9a-fA-F']+|0[bB][01']+|\d[\d']*(\.[\d']*)?([eE][-+]?\d+)?)[uUlLfFzZ]*$/;
const KEYWORD_LITERALS = new Set(['true', 'false', 'nullptr']);
const FUNCTION_ROLES_ELIGIBLE = new Set(['function', 'method']);

export function isLiteralText(text) {
  const trimmed = text.trim();
  return (
    STRING_LITERAL.test(trimmed) ||
    CHARACTER_LITERAL.test(trimmed) ||
    NUMERIC_LITERAL.test(trimmed) ||
    KEYWORD_LITERALS.has(trimmed)
  );
}

export function isLiteralInitializedConstant(symbol) {
  return (
    symbol.kind === 'function' &&
    FUNCTION_ROLES_ELIGIBLE.has(symbol.role) &&
    symbol.returnType !== null &&
    symbol.templateParameters === null &&
    symbol.parameters.length > 0 &&
    symbol.parameters.every(
      (parameter) =>
        parameter.name === null &&
        parameter.defaultValue === null &&
        isLiteralText(expressionText(parameter.type)),
    )
  );
}

function initializerOf(parameters) {
  const separated = parameters.flatMap((parameter, position) =>
    position > 0 ? [', ', parameter.type] : [parameter.type],
  );
  return joinExpressions(['(', ...separated, ')']);
}

function toVariable(symbol) {
  return {
    id: symbol.id,
    kind: 'variable',
    name: symbol.name,
    qualifiedName: symbol.qualifiedName,
    ownerId: symbol.ownerId,
    access: symbol.access,
    documentation: symbol.documentation,
    location: symbol.location,
    corrections: [...symbol.corrections],
    origin: symbol.origin,
    type: symbol.returnType,
    initializer: initializerOf(symbol.parameters),
    bitfield: null,
    qualifiers: {
      isStatic: symbol.qualifiers.isStatic,
      isConstexpr: symbol.qualifiers.isConstexpr,
      isMutable: false,
    },
  };
}

export function reclassifyLiteralInitializedConstants(symbols) {
  const result = createCorrectionResult([]);
  for (const symbol of symbols) {
    if (!isLiteralInitializedConstant(symbol)) {
      result.symbols.push(symbol);
      continue;
    }
    const variable = toVariable(symbol);
    markCorrected(variable, RECLASSIFY_LITERAL_INITIALIZED_CONSTANTS);
    recordApplied(
      result,
      variable,
      `function with literal argument list ${symbol.origin.argsString} reclassified as variable`,
    );
    result.symbols.push(variable);
  }
  return result;
}
