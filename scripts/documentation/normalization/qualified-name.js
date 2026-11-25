const OPENING_BRACKETS = new Set(['<', '(', '[', '{']);
const CLOSING_BRACKETS = new Set(['>', ')', ']', '}']);
const SCOPE_SEPARATOR = '::';
const OPERATOR_KEYWORD = 'operator';

function operatorStartIndex(qualifiedName) {
  const match = /(?:^|::)(operator)(?![A-Za-z0-9_])/.exec(qualifiedName);
  return match ? match.index + match[0].length - OPERATOR_KEYWORD.length : -1;
}

export function splitQualifiedName(qualifiedName) {
  const operatorIndex = operatorStartIndex(qualifiedName);
  const scanned = operatorIndex >= 0 ? qualifiedName.slice(0, operatorIndex) : qualifiedName;
  const parts = [];
  let depth = 0;
  let current = '';
  for (let position = 0; position < scanned.length; position += 1) {
    const character = scanned[position];
    if (OPENING_BRACKETS.has(character)) {
      depth += 1;
    } else if (CLOSING_BRACKETS.has(character)) {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && scanned.startsWith(SCOPE_SEPARATOR, position)) {
      parts.push(current.trim());
      current = '';
      position += SCOPE_SEPARATOR.length - 1;
      continue;
    }
    current += character;
  }
  if (operatorIndex >= 0) {
    return [...parts, qualifiedName.slice(operatorIndex).trim()];
  }
  parts.push(current.trim());
  return parts;
}

export function simpleNameOf(qualifiedName) {
  return splitQualifiedName(qualifiedName).at(-1);
}

export function templateBaseNameOf(name) {
  const bracketIndex = name.indexOf('<');
  return (bracketIndex >= 0 ? name.slice(0, bracketIndex) : name).trim();
}

export function isTemplateSpecializationName(name) {
  return !name.startsWith(OPERATOR_KEYWORD) && name.includes('<');
}

export function isAnonymousQualifiedName(qualifiedName) {
  return splitQualifiedName(qualifiedName).some((part) => part.startsWith('@'));
}
