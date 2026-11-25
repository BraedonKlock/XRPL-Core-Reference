import { categorizeSourceFile } from '../config/source-categories.js';
import { isAnonymousQualifiedName } from './qualified-name.js';

export const EXCLUSION_REASONS = Object.freeze({
  preprocessorMacro: 'preprocessor-macro',
  unsupportedKind: 'unsupported-member-kind',
  anonymousNamespace: 'anonymous-namespace',
  phantomNamespace: 'phantom-namespace',
  noSourceLocation: 'no-source-location',
  outsideCategories: 'outside-included-categories',
  ownerExcluded: 'owner-excluded',
  friendClassRelationship: 'friend-class-relationship',
});

function intrinsicExclusionReason(symbol, includedCategories) {
  if (symbol.kind === 'macro') {
    return EXCLUSION_REASONS.preprocessorMacro;
  }
  if (symbol.kind === 'unsupported') {
    return EXCLUSION_REASONS.unsupportedKind;
  }
  if (isAnonymousQualifiedName(symbol.qualifiedName)) {
    return EXCLUSION_REASONS.anonymousNamespace;
  }
  if (!symbol.location) {
    return symbol.kind === 'namespace'
      ? EXCLUSION_REASONS.phantomNamespace
      : EXCLUSION_REASONS.noSourceLocation;
  }
  if (!includedCategories.includes(symbol.category)) {
    return EXCLUSION_REASONS.outsideCategories;
  }
  return null;
}

function attachFriendClass(friendSymbol, symbolsById) {
  const owner = symbolsById.get(friendSymbol.ownerId);
  if (owner?.friendClasses) {
    owner.friendClasses.push({ name: friendSymbol.name, refId: friendSymbol.friendRefId ?? friendSymbol.id });
  }
}

export function assignCategories(symbols) {
  for (const symbol of symbols) {
    symbol.category = symbol.location ? categorizeSourceFile(symbol.location.declaration.file) : null;
  }
  return symbols;
}

export function applyExclusions(symbols, { includedCategories }) {
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const excludedReasons = new Map();
  for (const symbol of symbols) {
    if (symbol.kind === 'friendClass') {
      attachFriendClass(symbol, symbolsById);
      excludedReasons.set(symbol.id, EXCLUSION_REASONS.friendClassRelationship);
      continue;
    }
    const reason = intrinsicExclusionReason(symbol, includedCategories);
    if (reason) {
      excludedReasons.set(symbol.id, reason);
    }
  }
  const isOwnerExcluded = (symbol) => {
    let ownerId = symbol.ownerId;
    while (ownerId) {
      if (excludedReasons.has(ownerId)) {
        return true;
      }
      ownerId = symbolsById.get(ownerId)?.ownerId ?? null;
    }
    return false;
  };
  for (const symbol of symbols) {
    if (!excludedReasons.has(symbol.id) && isOwnerExcluded(symbol)) {
      excludedReasons.set(symbol.id, EXCLUSION_REASONS.ownerExcluded);
    }
  }
  const kept = symbols.filter((symbol) => !excludedReasons.has(symbol.id));
  const keptIds = new Set(kept.map((symbol) => symbol.id));
  for (const symbol of kept) {
    if (symbol.memberIds) {
      symbol.memberIds = symbol.memberIds.filter((memberId) => keptIds.has(memberId));
    }
    if (symbol.innerIds) {
      symbol.innerIds = symbol.innerIds.filter((innerId) => keptIds.has(innerId));
    }
  }
  const excluded = symbols
    .filter((symbol) => excludedReasons.has(symbol.id))
    .map((symbol) => ({
      id: symbol.id,
      qualifiedName: symbol.qualifiedName,
      kind: symbol.kind,
      reason: excludedReasons.get(symbol.id),
    }));
  const friendClassSymbols = symbols.filter((symbol) => symbol.kind === 'friendClass');
  return { symbols: kept, excluded, excludedReasons, friendClassSymbols };
}
