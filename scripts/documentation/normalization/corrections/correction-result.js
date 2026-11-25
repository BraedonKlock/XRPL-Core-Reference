export function createCorrectionResult(symbols) {
  return { symbols, applied: [], unresolved: [] };
}

export function recordApplied(result, symbol, detail) {
  result.applied.push({ symbolId: symbol.id, qualifiedName: symbol.qualifiedName, detail });
}

export function recordUnresolved(result, symbol, issue) {
  result.unresolved.push({ symbolId: symbol.id, qualifiedName: symbol.qualifiedName, issue });
}

export function markCorrected(symbol, correctionId) {
  if (!symbol.corrections.includes(correctionId)) {
    symbol.corrections.push(correctionId);
  }
}

export function suppressedDocumentation(reason) {
  return {
    brief: null,
    description: [],
    returns: null,
    notes: [],
    parameterDescriptions: new Map(),
    templateParameterDescriptions: new Map(),
    suppressionReason: reason,
  };
}

export function clearParameterDescriptions(symbol) {
  for (const parameter of symbol.parameters ?? []) {
    parameter.description = null;
    parameter.direction = null;
  }
}
