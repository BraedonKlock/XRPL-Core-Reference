import { attributesOf, childrenOf, isTextNode, tagNameOf, textOf } from '../parsing/xml-tree.js';

function appendText(tokens, text) {
  const last = tokens.at(-1);
  if (last && last.refId === undefined) {
    last.text += text;
  } else {
    tokens.push({ text });
  }
}

export function normalizeTypeSpacing(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/<\s+/g, '<')
    .replace(/\s+>/g, '>')
    .replace(/\s+,/g, ',')
    .replace(/,(?=[^\s])/g, ', ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+(&&|&|\*)/g, '$1')
    .replace(/\s+\.\.\./g, '...');
}

function collapseWhitespace(text) {
  return text.replace(/\s+/g, ' ');
}

function finalizeTokens(tokens, normalizeText) {
  const normalized = tokens
    .map((token) => (token.refId === undefined ? { text: normalizeText(token.text) } : token))
    .filter((token) => token.text.length > 0);
  if (normalized.length === 0) {
    return [];
  }
  if (normalized[0].refId === undefined) {
    normalized[0] = { text: normalized[0].text.trimStart() };
  }
  const lastIndex = normalized.length - 1;
  if (normalized[lastIndex].refId === undefined) {
    normalized[lastIndex] = { text: normalized[lastIndex].text.trimEnd() };
  }
  return normalized.filter((token) => token.text.length > 0);
}

function expressionOf(node, normalizeText) {
  if (!node) {
    return [];
  }
  const tokens = [];
  const visit = (child) => {
    if (isTextNode(child)) {
      appendText(tokens, textOf(child));
      return;
    }
    if (tagNameOf(child) === 'ref') {
      tokens.push({ text: textOf(child), refId: attributesOf(child).refid });
      return;
    }
    childrenOf(child).forEach(visit);
  };
  childrenOf(node).forEach(visit);
  return finalizeTokens(tokens, normalizeText);
}

export function typeExpressionOf(node) {
  return expressionOf(node, normalizeTypeSpacing);
}

export function valueExpressionOf(node) {
  return expressionOf(node, collapseWhitespace);
}

export function optionalTypeExpressionOf(node) {
  const expression = typeExpressionOf(node);
  return expression.length > 0 ? expression : null;
}

export function optionalValueExpressionOf(node) {
  const expression = valueExpressionOf(node);
  return expression.length > 0 ? expression : null;
}

export function textToken(text) {
  return { text };
}

export function expressionText(expression) {
  return (expression ?? []).map((token) => token.text).join('');
}

export function joinExpressions(parts) {
  const tokens = [];
  for (const part of parts) {
    for (const token of typeof part === 'string' ? [textToken(part)] : part) {
      if (token.text.length === 0) {
        continue;
      }
      if (token.refId === undefined && tokens.at(-1)?.refId === undefined && tokens.length > 0) {
        tokens[tokens.length - 1] = { text: tokens.at(-1).text + token.text };
      } else {
        tokens.push({ ...token });
      }
    }
  }
  return tokens;
}
