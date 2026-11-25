import { isClassLikeKind } from '../normalization/doxygen-symbols.js';
import { simpleNameOf, templateBaseNameOf } from '../normalization/qualified-name.js';

export const SCOPE_RESOLUTION = 'scope';

const IDENTIFIER_PATTERN = /[A-Za-z_][A-Za-z0-9_]*/g;
const QUALIFYING_PREFIX = /(::|\.|->)\s*$/;

function classBaseName(symbol) {
  return templateBaseNameOf(simpleNameOf(symbol.qualifiedName));
}

function enclosingClassChain(symbol, symbolsById) {
  const chain = [];
  let owner = symbolsById.get(symbol.ownerId);
  while (owner && isClassLikeKind(owner.kind)) {
    chain.push(owner);
    owner = symbolsById.get(owner.ownerId);
  }
  return chain;
}

function templateParameterNames(symbol) {
  return (symbol.templateParameters ?? []).map((parameter) => parameter.name).filter(Boolean);
}

function declaredNamesOf(classSymbol, symbolsById) {
  return [...(classSymbol.memberIds ?? []), ...(classSymbol.innerIds ?? [])]
    .map((id) => symbolsById.get(id))
    .filter(Boolean)
    .map((declared) => (isClassLikeKind(declared.kind) ? classBaseName(declared) : declared.name));
}

function scopeNamesIncludingBases(classSymbol, symbolsById, visited = new Set()) {
  if (visited.has(classSymbol.id)) {
    return { names: new Set(), isComplete: true };
  }
  visited.add(classSymbol.id);
  const names = new Set([
    ...declaredNamesOf(classSymbol, symbolsById),
    ...templateParameterNames(classSymbol),
  ]);
  let isComplete = true;
  for (const base of classSymbol.baseClasses ?? []) {
    const baseSymbol = base.refId ? symbolsById.get(base.refId) : null;
    if (!baseSymbol) {
      isComplete = false;
      continue;
    }
    names.add(classBaseName(baseSymbol));
    const inherited = scopeNamesIncludingBases(baseSymbol, symbolsById, visited);
    inherited.names.forEach((name) => names.add(name));
    isComplete &&= inherited.isComplete;
  }
  return { names, isComplete };
}

export function createScopeResolver(symbolsById) {
  const scopeNamesCache = new Map();
  const scopeNamesOf = (classSymbol) => {
    if (!scopeNamesCache.has(classSymbol.id)) {
      scopeNamesCache.set(classSymbol.id, scopeNamesIncludingBases(classSymbol, symbolsById));
    }
    return scopeNamesCache.get(classSymbol.id);
  };
  return (memberSymbol, identifier) => {
    if (templateParameterNames(memberSymbol).includes(identifier)) {
      return null;
    }
    const chain = enclosingClassChain(memberSymbol, symbolsById);
    for (const classSymbol of chain) {
      if (classBaseName(classSymbol) === identifier) {
        return classSymbol;
      }
      const scope = scopeNamesOf(classSymbol);
      if (!scope.isComplete || scope.names.has(identifier)) {
        return null;
      }
    }
    return null;
  };
}

function linkTextToken(token, precedingText, resolveIdentifier) {
  const pieces = [];
  let cursor = 0;
  for (const match of token.text.matchAll(IDENTIFIER_PATTERN)) {
    const contextBefore = precedingText + token.text.slice(0, match.index);
    const target = QUALIFYING_PREFIX.test(contextBefore) ? null : resolveIdentifier(match[0]);
    if (!target) {
      continue;
    }
    if (match.index > cursor) {
      pieces.push({ text: token.text.slice(cursor, match.index) });
    }
    pieces.push({ text: match[0], refId: target.id, resolution: SCOPE_RESOLUTION });
    cursor = match.index + match[0].length;
  }
  if (pieces.length === 0) {
    return [token];
  }
  if (cursor < token.text.length) {
    pieces.push({ text: token.text.slice(cursor) });
  }
  return pieces;
}

export function linkScopeReferencesInExpression(expression, resolveIdentifier) {
  if (!expression) {
    return { expression, linked: 0 };
  }
  const linkedTokens = [];
  let precedingText = '';
  let linked = 0;
  for (const token of expression) {
    if (token.refId !== undefined) {
      linkedTokens.push(token);
    } else {
      const pieces = linkTextToken(token, precedingText, resolveIdentifier);
      linked += pieces.filter((piece) => piece.resolution === SCOPE_RESOLUTION).length;
      linkedTokens.push(...pieces);
    }
    precedingText += token.text;
  }
  return { expression: linkedTokens, linked };
}

function typeExpressionHolders(symbol) {
  const holders = [];
  if (symbol.returnType) {
    holders.push([symbol, 'returnType']);
  }
  if (symbol.type) {
    holders.push([symbol, 'type']);
  }
  for (const parameter of symbol.parameters ?? []) {
    holders.push([parameter, 'type']);
  }
  return holders;
}

export function resolveFriendClassRedirects(friendClassSymbols, symbolsById) {
  const resolveForScope = createScopeResolver(symbolsById);
  const redirects = new Map();
  for (const friendClass of friendClassSymbols) {
    const target = resolveForScope(friendClass, templateBaseNameOf(friendClass.name));
    if (target) {
      redirects.set(friendClass.id, { targetId: target.id, resolution: SCOPE_RESOLUTION });
    }
  }
  return redirects;
}

export function linkScopeReferences(symbols, symbolsById) {
  const resolveForScope = createScopeResolver(symbolsById);
  let linked = 0;
  for (const symbol of symbols) {
    if (!isClassLikeKind(symbolsById.get(symbol.ownerId)?.kind)) {
      continue;
    }
    const resolveIdentifier = (identifier) => resolveForScope(symbol, identifier);
    for (const [holder, field] of typeExpressionHolders(symbol)) {
      const result = linkScopeReferencesInExpression(holder[field], resolveIdentifier);
      holder[field] = result.expression;
      linked += result.linked;
    }
  }
  return { linked };
}
