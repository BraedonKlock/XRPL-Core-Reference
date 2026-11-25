import { hasDocumentationContent } from '../documentation.js';
import { createCorrectionResult, markCorrected, recordApplied } from './correction-result.js';

export const MERGE_DUPLICATE_MEMBER_RECORDS = 'merge-duplicate-member-records';

function definitionPositionOf(record) {
  if (record.location?.definition) {
    return record.location.definition;
  }
  const declaration = record.location?.declaration;
  return declaration?.line ? { file: declaration.file, line: declaration.line, endLine: null } : null;
}

function mergeInto(primary, duplicate) {
  const definition = definitionPositionOf(duplicate);
  if (definition && primary.location) {
    primary.location = { ...primary.location, definition };
  }
  if (!hasDocumentationContent(primary.documentation) && hasDocumentationContent(duplicate.documentation)) {
    primary.documentation = duplicate.documentation;
    if (primary.parameters && duplicate.parameters) {
      primary.parameters = primary.parameters.map((parameter, position) => ({
        ...parameter,
        description: duplicate.parameters[position]?.description ?? null,
        direction: duplicate.parameters[position]?.direction ?? null,
      }));
    }
  }
  if (primary.qualifiers && duplicate.qualifiers) {
    primary.qualifiers = {
      ...primary.qualifiers,
      isNodiscard: primary.qualifiers.isNodiscard || duplicate.qualifiers.isNodiscard,
    };
  }
}

export function mergeDuplicateMemberRecords(symbols) {
  const result = createCorrectionResult([]);
  const primariesById = new Map();
  for (const symbol of symbols) {
    const primary = primariesById.get(symbol.id);
    if (!primary) {
      primariesById.set(symbol.id, symbol);
      result.symbols.push(symbol);
      continue;
    }
    if (primary.kind !== symbol.kind || primary.qualifiedName !== symbol.qualifiedName) {
      throw new Error(
        `Doxygen id ${symbol.id} identifies different symbols: ${primary.kind} ${primary.qualifiedName} and ${symbol.kind} ${symbol.qualifiedName}`,
      );
    }
    mergeInto(primary, symbol);
    markCorrected(primary, MERGE_DUPLICATE_MEMBER_RECORDS);
    recordApplied(
      result,
      primary,
      `merged duplicate record at ${symbol.location?.declaration.file}:${symbol.location?.declaration.line}`,
    );
  }
  for (const symbol of result.symbols) {
    if (symbol.memberIds) {
      symbol.memberIds = [...new Set(symbol.memberIds)];
    }
  }
  return result;
}
