import { expressionText } from '../type-expression.js';
import {
  createCorrectionResult,
  markCorrected,
  recordApplied,
  recordUnresolved,
} from './correction-result.js';

export const SPLIT_TRAILING_REQUIRES_CLAUSE = 'split-trailing-requires-clause';

const OPENING = new Set(['<', '(', '[', '{']);
const CLOSING = new Set(['>', ')', ']', '}']);
const REQUIRES_KEYWORD = 'requires';

export function findTopLevelRequiresOffset(text) {
  let depth = 0;
  for (let position = 0; position < text.length; position += 1) {
    const character = text[position];
    if (OPENING.has(character)) {
      depth += 1;
    } else if (CLOSING.has(character)) {
      depth = Math.max(0, depth - 1);
    } else if (
      depth === 0 &&
      text.startsWith(REQUIRES_KEYWORD, position) &&
      !/[A-Za-z0-9_]/.test(text[position - 1] ?? ' ') &&
      !/[A-Za-z0-9_]/.test(text[position + REQUIRES_KEYWORD.length] ?? ' ')
    ) {
      return position;
    }
  }
  return -1;
}

export function splitExpressionAt(expression, offset) {
  const before = [];
  const after = [];
  let consumed = 0;
  for (const token of expression) {
    const start = consumed;
    consumed += token.text.length;
    if (consumed <= offset) {
      before.push(token);
    } else if (start >= offset) {
      after.push(token);
    } else if (token.refId !== undefined) {
      return null;
    } else {
      before.push({ text: token.text.slice(0, offset - start) });
      after.push({ text: token.text.slice(offset - start) });
    }
  }
  return { before, after };
}

function trimExpression(expression) {
  const tokens = expression.map((token) => ({ ...token }));
  if (tokens[0] && tokens[0].refId === undefined) {
    tokens[0].text = tokens[0].text.trimStart();
  }
  const last = tokens.at(-1);
  if (last && last.refId === undefined) {
    last.text = last.text.trimEnd();
  }
  return tokens.filter((token) => token.text.length > 0);
}

export function splitTrailingRequiresClause(symbols) {
  const result = createCorrectionResult(symbols);
  for (const symbol of symbols) {
    if (symbol.kind !== 'function' || !symbol.returnType) {
      continue;
    }
    const offset = findTopLevelRequiresOffset(expressionText(symbol.returnType));
    if (offset < 0) {
      continue;
    }
    if (symbol.requiresClause) {
      recordUnresolved(
        result,
        symbol,
        'return type contains a requires clause while a separate requires clause exists',
      );
      continue;
    }
    const split = splitExpressionAt(symbol.returnType, offset);
    if (!split) {
      recordUnresolved(result, symbol, 'requires clause boundary falls inside a linked token');
      continue;
    }
    const clause = trimExpression(split.after);
    clause[0] = { ...clause[0], text: clause[0].text.slice(REQUIRES_KEYWORD.length).trimStart() };
    symbol.returnType = trimExpression(split.before);
    symbol.requiresClause = trimExpression(clause.filter((token) => token.text.length > 0));
    markCorrected(symbol, SPLIT_TRAILING_REQUIRES_CLAUSE);
    recordApplied(
      result,
      symbol,
      `moved "requires ${expressionText(symbol.requiresClause)}" out of the return type`,
    );
  }
  return result;
}
