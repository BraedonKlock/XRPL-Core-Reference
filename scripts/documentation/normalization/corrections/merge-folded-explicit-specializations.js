import { signatureKeyOf } from '../../resolution/signature-key.js';
import { simpleNameOf, templateBaseNameOf } from '../qualified-name.js';
import {
  createCorrectionResult,
  markCorrected,
  recordApplied,
  recordUnresolved,
} from './correction-result.js';

export const MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS = 'merge-folded-explicit-specializations';

const EMPTY_TEMPLATE_HEADER = /^\s*template\s*<\s*>\s*$/;
const INLINE_EMPTY_TEMPLATE_HEADER = /^\s*template\s*<\s*>/;
const HEADER_FILE = /\.(h|hpp|ipp)$/;

function escapeForPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isExplicitSpecializationDefinition(symbol, ownerSymbol, sourceFiles) {
  const position = symbol.location?.declaration;
  if (!position?.line || !ownerSymbol) {
    return false;
  }
  const line = sourceFiles.lineAt(position.file, position.line) ?? '';
  const previousLine = sourceFiles.lineAt(position.file, position.line - 1) ?? '';
  const ownerName = escapeForPattern(templateBaseNameOf(simpleNameOf(ownerSymbol.qualifiedName)));
  const memberName = escapeForPattern(symbol.name);
  const specializedQualifier = new RegExp(`\\b${ownerName}\\s*<[^;{]+>\\s*::\\s*${memberName}\\b`);
  const hasEmptyTemplateHeader =
    EMPTY_TEMPLATE_HEADER.test(previousLine) || INLINE_EMPTY_TEMPLATE_HEADER.test(line);
  return hasEmptyTemplateHeader && specializedQualifier.test(line);
}

function choosePrimary(group) {
  return group.find((symbol) => HEADER_FILE.test(symbol.location?.declaration.file ?? '')) ?? null;
}

function groupBySignature(symbols) {
  const groups = new Map();
  for (const symbol of symbols.filter((candidate) => candidate.kind === 'function')) {
    const key = `${symbol.ownerId}\u0000${signatureKeyOf(symbol)}`;
    groups.set(key, [...(groups.get(key) ?? []), symbol]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

export function mergeFoldedExplicitSpecializations(symbols, { sourceFiles }) {
  const result = createCorrectionResult(symbols);
  const symbolsById = new Map(symbols.map((symbol) => [symbol.id, symbol]));
  const removedIds = new Set();
  for (const group of groupBySignature(symbols)) {
    const primary = choosePrimary(group);
    const owner = symbolsById.get(group[0].ownerId);
    const specializations = group.filter((symbol) => symbol !== primary);
    const allVerified =
      primary !== null &&
      specializations.every((symbol) => isExplicitSpecializationDefinition(symbol, owner, sourceFiles));
    if (!allVerified) {
      group.forEach((symbol) =>
        recordUnresolved(
          result,
          symbol,
          'records share a signature but are not verified explicit specializations',
        ),
      );
      continue;
    }
    primary.explicitSpecializations = [
      ...(primary.explicitSpecializations ?? []),
      ...specializations.map((symbol) => ({ ...symbol.location.declaration })),
    ];
    specializations.forEach((symbol) => removedIds.add(symbol.id));
    markCorrected(primary, MERGE_FOLDED_EXPLICIT_SPECIALIZATIONS);
    recordApplied(result, primary, `attached ${specializations.length} explicit specialization definitions`);
  }
  result.symbols = symbols.filter((symbol) => !removedIds.has(symbol.id));
  for (const symbol of result.symbols) {
    if (symbol.memberIds) {
      symbol.memberIds = symbol.memberIds.filter((memberId) => !removedIds.has(memberId));
    }
  }
  return result;
}
