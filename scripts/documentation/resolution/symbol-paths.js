import { splitQualifiedName } from '../normalization/qualified-name.js';
import { compactCppText, overloadHashOf, signatureKeyOf } from './signature-key.js';

const OPERATOR_SEGMENTS = Object.freeze({
  '()': 'call',
  '[]': 'subscript',
  '->': 'arrow',
  '->*': 'arrow-member',
  '!': 'not',
  '~': 'complement',
  '==': 'equal',
  '!=': 'not-equal',
  '<': 'less',
  '<=': 'less-equal',
  '>': 'greater',
  '>=': 'greater-equal',
  '<=>': 'three-way-compare',
  '=': 'assign',
  '+': 'plus',
  '-': 'minus',
  '*': 'multiply',
  '/': 'divide',
  '%': 'modulo',
  '&': 'bitwise-and',
  '|': 'bitwise-or',
  '^': 'bitwise-xor',
  '<<': 'shift-left',
  '>>': 'shift-right',
  '&&': 'logical-and',
  '||': 'logical-or',
  '++': 'increment',
  '--': 'decrement',
  ',': 'comma',
  '+=': 'plus-assign',
  '-=': 'minus-assign',
  '*=': 'multiply-assign',
  '/=': 'divide-assign',
  '%=': 'modulo-assign',
  '&=': 'bitwise-and-assign',
  '|=': 'bitwise-or-assign',
  '^=': 'bitwise-xor-assign',
  '<<=': 'shift-left-assign',
  '>>=': 'shift-right-assign',
  new: 'new',
  'new[]': 'new-array',
  delete: 'delete',
  'delete[]': 'delete-array',
  co_await: 'co-await',
});

const OPERATOR_PREFIX = 'operator';
const OPERATOR_NAME_PATTERN = /^operator(?![A-Za-z0-9_])\s*(.*)$/;
const LITERAL_OPERATOR_PATTERN = /^""\s*([A-Za-z_][A-Za-z0-9_]*)$/;
const UNRESERVED_SEGMENT_CHARACTER = /[A-Za-z0-9_~.-]/;

export function encodePathSegment(text) {
  const compact = compactCppText(text).replace(/ /g, '_');
  return [...compact]
    .map((character) =>
      UNRESERVED_SEGMENT_CHARACTER.test(character) ? character : encodeURIComponent(character),
    )
    .join('')
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function operatorPathSegment(name) {
  const match = OPERATOR_NAME_PATTERN.exec(name);
  if (!match) {
    return null;
  }
  const operatorText = match[1].replace(/\s+/g, '');
  if (operatorText in OPERATOR_SEGMENTS) {
    return `${OPERATOR_PREFIX}-${OPERATOR_SEGMENTS[operatorText]}`;
  }
  const literal = LITERAL_OPERATOR_PATTERN.exec(match[1].trim());
  if (literal) {
    return `${OPERATOR_PREFIX}-literal-${literal[1]}`;
  }
  return `${OPERATOR_PREFIX}-conversion-${encodePathSegment(match[1])}`;
}

export function nameSegmentOf(name) {
  return operatorPathSegment(name) ?? encodePathSegment(name);
}

function qualifiedNameSegments(qualifiedName) {
  return splitQualifiedName(qualifiedName).map(nameSegmentOf);
}

export function assignSymbolPaths(symbols) {
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const pathsById = new Map();
  const pathOf = (symbol) => {
    if (pathsById.has(symbol.id)) {
      return pathsById.get(symbol.id);
    }
    const owner = symbol.ownerId ? symbolsById.get(symbol.ownerId) : null;
    const scopePath = owner ? pathOf(owner) : null;
    const baseSegments = scopePath
      ? [scopePath, nameSegmentOf(symbol.name)]
      : qualifiedNameSegments(symbol.qualifiedName);
    let path = baseSegments.join('/');
    if (symbol.kind === 'function') {
      symbol.signatureKey = signatureKeyOf(symbol);
      symbol.overloadSetPath = path;
      path = `${path}/${overloadHashOf(symbol.signatureKey)}`;
    }
    symbol.scopePath = scopePath;
    pathsById.set(symbol.id, path);
    symbol.path = path;
    return path;
  };
  symbols.forEach(pathOf);
  return pathsById;
}

export function findPathCollisions(symbols) {
  const claims = new Map();
  const claim = (path, symbol, role) => {
    claims.set(path, [...(claims.get(path) ?? []), { symbol, role }]);
  };
  for (const symbol of symbols) {
    claim(symbol.path, symbol, 'symbol');
  }
  const overloadSets = new Map();
  for (const symbol of symbols.filter((candidate) => candidate.kind === 'function')) {
    overloadSets.set(symbol.overloadSetPath, symbol);
  }
  for (const [path, symbol] of overloadSets) {
    claim(path, symbol, 'overload-set');
  }
  return [...claims]
    .filter(([, claimants]) => claimants.length > 1)
    .map(([path, claimants]) => ({
      path,
      claimants: claimants.map(({ symbol, role }) => ({
        role,
        kind: symbol.kind,
        qualifiedName: symbol.qualifiedName,
        signatureKey: symbol.signatureKey ?? null,
        location: symbol.location?.declaration ?? null,
      })),
    }));
}
